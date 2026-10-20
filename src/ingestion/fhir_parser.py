"""
FHIR Parser for Synthea synthetic patient records.
Extracts FHIR resources (Patient, Condition, Encounter, Observation, MedicationRequest, AllergyIntolerance, CarePlan).
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, date
import json

from src.ingestion.schema_normalizer import (
    NormalizedEHRProfile,
    PatientDemographics,
    AsthmaHistory,
    EncounterSummary,
    MedicationRecord,
    AllergyRecord,
    CarePlanSummary,
    HistoricalLabMeasurement,
    LabReportItem,
    ImagingRecord,
)

ASTHMA_SNOMED_CODES = {
    "195967001": "Asthma",
    "233678006": "Childhood asthma",
    "413839001": "Chronic asthma",
    "161527007": "History of asthma",
    "278860009": "Asthmatic attack",
    "89155008": "Intrinsic asthma",
    "56968009": "Extrinsic asthma",
}

ASSOCIATED_CONDITIONS = {
    "61582004": "Allergic rhinitis",
    "24079001": "Atopic dermatitis (eczema)",
    "444814009": "Allergy to pollen",
    "390952000": "Dust allergy",
}


def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        # Handles 2026-09-18 or 2026-09-18T10:00:00Z
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.strptime(date_str[:10], "%Y-%m-%d")
        except Exception:
            return None


class FHIRParser:
    """Parses a Synthea FHIR bundle or resource collection into a NormalizedEHRProfile."""

    @staticmethod
    def parse_bundle(bundle_data: Dict[str, Any]) -> NormalizedEHRProfile:
        entries = bundle_data.get("entry", [])
        resources_by_type: Dict[str, List[Dict[str, Any]]] = {}

        for entry in entries:
            res = entry.get("resource", {})
            res_type = res.get("resourceType")
            if res_type:
                resources_by_type.setdefault(res_type, []).append(res)

        # 1. Parse Patient
        patient_res = resources_by_type.get("Patient", [{}])[0]
        patient_id = patient_res.get("id", "UNKNOWN_PATIENT")
        birth_date_raw = patient_res.get("birthDate")
        parsed_birth = None
        age = None
        if birth_date_raw:
            try:
                b_dt = datetime.strptime(birth_date_raw, "%Y-%m-%d").date()
                parsed_birth = b_dt
                today = date.today()
                age = today.year - b_dt.year - ((today.month, today.day) < (b_dt.month, b_dt.day))
            except Exception:
                pass

        # Extract name
        name_entries = patient_res.get("name", [])
        parsed_name = None
        if name_entries:
            parsed_name = name_entries[0].get("text")
            if not parsed_name:
                given = " ".join(name_entries[0].get("given", []))
                family = name_entries[0].get("family", "")
                parsed_name = f"{given} {family}".strip()

        # Extract address / city
        addr_entries = patient_res.get("address", [])
        parsed_city = None
        if addr_entries:
            c = addr_entries[0].get("city")
            s = addr_entries[0].get("state")
            if c and s:
                parsed_city = f"{c}, {s}"
            elif c:
                parsed_city = c

        demographics = PatientDemographics(
            patient_id=patient_id,
            name=parsed_name,
            birth_date=parsed_birth,
            age=age,
            gender=patient_res.get("gender", "unknown"),
            city=parsed_city
        )

        # 2. Parse Conditions (Asthma & comorbidities)
        conditions = resources_by_type.get("Condition", [])
        has_asthma = False
        asthma_code = None
        asthma_desc = None
        asthma_date = None
        associated = []
        exacerbation_count = 0

        for cond in conditions:
            code_obj = cond.get("code", {})
            codings = code_obj.get("coding", [])
            text_desc = code_obj.get("text", "")

            for coding in codings:
                code_val = str(coding.get("code", ""))
                display = coding.get("display", text_desc)

                # Check asthma
                if code_val in ASTHMA_SNOMED_CODES or "asthma" in display.lower() or "asthma" in text_desc.lower():
                    has_asthma = True
                    asthma_code = code_val or "J45.909"
                    asthma_desc = display or ASTHMA_SNOMED_CODES.get(code_val, "Asthma")
                    onset_str = cond.get("onsetDateTime") or cond.get("recordedDate")
                    if onset_str:
                        asthma_date = parse_date(onset_str)

                # Check exacerbation mentions
                if "attack" in display.lower() or "exacerbation" in display.lower() or code_val == "278860009":
                    exacerbation_count += 1

                # Check associated conditions
                if code_val in ASSOCIATED_CONDITIONS:
                    associated.append(ASSOCIATED_CONDITIONS[code_val])
                elif "rhinitis" in display.lower():
                    associated.append("Allergic rhinitis")
                elif "eczema" in display.lower():
                    associated.append("Eczema")

        # 3. Parse Encounters
        encounters_raw = resources_by_type.get("Encounter", [])
        encounters: List[EncounterSummary] = []
        emergency_count = 0
        inpatient_count = 0

        for enc in encounters_raw:
            enc_class = enc.get("class", {})
            enc_type_code = enc_class.get("code", enc_class.get("display", "ambulatory")).lower()
            period = enc.get("period", {})
            start_t = parse_date(period.get("start"))
            end_t = parse_date(period.get("end"))
            reason = enc.get("reasonCode", [{}])[0].get("text", "")

            if "emergency" in enc_type_code or "urgent" in enc_type_code:
                emergency_count += 1
            if "inpatient" in enc_type_code or "hospital" in enc_type_code:
                inpatient_count += 1

            encounters.append(EncounterSummary(
                id=enc.get("id", str(len(encounters))),
                encounter_type=enc_type_code,
                start_time=start_t,
                end_time=end_t,
                reason_text=reason
            ))

        # 4. Parse Medications
        med_requests = resources_by_type.get("MedicationRequest", [])
        medications: List[MedicationRecord] = []
        for mr in med_requests:
            med_concept = mr.get("medicationCodeableConcept", {})
            med_name = med_concept.get("text")
            med_code = None
            if not med_name and med_concept.get("coding"):
                med_name = med_concept["coding"][0].get("display", "Unknown Medication")
                med_code = med_concept["coding"][0].get("code")
            med_name = med_name or "Unknown Medication"
            authored_on = parse_date(mr.get("authoredOn"))

            medications.append(MedicationRecord(
                id=mr.get("id", str(len(medications))),
                name=med_name,
                code=med_code,
                status=mr.get("status", "unknown"),
                prescribed_date=authored_on
            ))

        # 5. Parse Allergies
        allergy_raw = resources_by_type.get("AllergyIntolerance", [])
        allergies: List[AllergyRecord] = []
        for al in allergy_raw:
            substance = al.get("code", {}).get("text")
            if not substance and al.get("code", {}).get("coding"):
                substance = al["code"]["coding"][0].get("display", "Unknown Substance")
            substance = substance or "Unknown Allergen"

            allergies.append(AllergyRecord(
                id=al.get("id", str(len(allergies))),
                substance=substance,
                criticality=al.get("criticality", "unknown"),
                recorded_date=parse_date(al.get("recordedDate"))
            ))

        # 6. Parse Care Plans
        cp_raw = resources_by_type.get("CarePlan", [])
        care_plans: List[CarePlanSummary] = []
        for cp in cp_raw:
            cat = cp.get("category", [{}])[0].get("text", "Asthma Care Plan")
            care_plans.append(CarePlanSummary(
                id=cp.get("id", str(len(care_plans))),
                title=cat,
                status=cp.get("status", "active"),
                start_date=parse_date(cp.get("period", {}).get("start"))
            ))

        # 7. Historical measurements & Lab reports
        obs_raw = resources_by_type.get("Observation", [])
        measurements: List[HistoricalLabMeasurement] = []
        lab_reports: List[LabReportItem] = []
        clinical_pb_pef = None

        for o in obs_raw:
            code_text = o.get("code", {}).get("text", "")
            if not code_text and o.get("code", {}).get("coding"):
                code_text = o["code"]["coding"][0].get("display", "")
            loinc = None
            if o.get("code", {}).get("coding"):
                loinc = o["code"]["coding"][0].get("code")

            val_quant = o.get("valueQuantity", {})
            val = val_quant.get("value")
            unit = val_quant.get("unit", "")
            t_stamp = parse_date(o.get("effectiveDateTime")) or datetime.utcnow()

            # Reference range & status
            ref_ranges = o.get("referenceRange", [])
            ref_str = ""
            status = "normal"
            if ref_ranges:
                low_val = ref_ranges[0].get("low", {}).get("value")
                high_val = ref_ranges[0].get("high", {}).get("value")
                if low_val is not None and high_val is not None:
                    ref_str = f"{low_val} - {high_val}"
                    if val is not None:
                        if val < low_val:
                            status = "low"
                        elif val > high_val:
                            status = "high"
                elif high_val is not None:
                    ref_str = f"< {high_val}"
                    if val is not None and val > high_val:
                        status = "high"
                elif low_val is not None:
                    ref_str = f"> {low_val}"
                    if val is not None and val < low_val:
                        status = "low"

            # Check abnormal flag from interpretation
            interp = o.get("interpretation", [{}])[0].get("coding", [{}])[0].get("code", "").upper()
            if interp in ["H", "HH", "HIGH"]:
                status = "high"
            elif interp in ["L", "LL", "LOW"]:
                status = "low"
            elif interp in ["A", "AA", "ABNORMAL"]:
                status = "abnormal"

            if val is not None:
                if "personal best" in code_text.lower():
                    clinical_pb_pef = float(val)

                measurements.append(HistoricalLabMeasurement(
                    name=code_text or "Clinical Observation",
                    value=float(val),
                    unit=unit,
                    timestamp=t_stamp,
                    loinc_code=loinc
                ))

                # Identify if this observation is a diagnostic lab result
                category = o.get("category", [{}])[0].get("coding", [{}])[0].get("code", "")
                is_lab = category == "laboratory" or any(k in code_text.lower() for k in [
                    "eosinophil", "ige", "crp", "c-reactive", "vitamin d", "iga", "wbc", "hematology"
                ])
                if is_lab:
                    lab_reports.append(LabReportItem(
                        test_name=code_text or "Laboratory Test",
                        value=float(val),
                        unit=unit,
                        reference_range=ref_str or "Standard",
                        status=status,
                        observation_date=t_stamp,
                        source="Clinical Diagnostic Laboratory",
                        loinc_code=loinc
                    ))

        # 8. DiagnosticReport (Direct lab report summaries)
        diag_reports_raw = resources_by_type.get("DiagnosticReport", [])
        for dr in diag_reports_raw:
            dr_code = dr.get("code", {}).get("text", "")
            dr_date = parse_date(dr.get("effectiveDateTime")) or datetime.utcnow()
            for result_ref in dr.get("result", []):
                # If custom display or text exists
                test_label = result_ref.get("display")
                if test_label and not any(lr.test_name == test_label for lr in lab_reports):
                    lab_reports.append(LabReportItem(
                        test_name=test_label,
                        value=result_ref.get("value", 0.0),
                        unit=result_ref.get("unit", ""),
                        reference_range=result_ref.get("referenceRange", "Standard"),
                        status=result_ref.get("status", "normal"),
                        observation_date=dr_date,
                        source="Diagnostic Report"
                    ))

        # 9. ImagingStudy (CT scans, X-rays)
        imaging_studies_raw = resources_by_type.get("ImagingStudy", [])
        imaging_records: List[ImagingRecord] = []
        for im in imaging_studies_raw:
            im_id = im.get("id", str(len(imaging_records)))
            modality = "CT"
            if im.get("modality"):
                modality = im["modality"][0].get("code", "CT")
            study_date = parse_date(im.get("started"))
            desc = im.get("description", "")
            impression = ""
            slices = im.get("numberOfInstances")

            imaging_records.append(ImagingRecord(
                id=im_id,
                modality=modality,
                body_site=im.get("bodySite", {}).get("display", "Chest / Thorax"),
                study_date=study_date,
                findings=desc,
                impression=impression,
                slice_count=slices,
                is_synthetic_demonstration=True
            ))

        asthma_history = AsthmaHistory(
            has_asthma_diagnosis=has_asthma,
            diagnosis_code=asthma_code,
            diagnosis_description=asthma_desc,
            diagnosis_date=asthma_date,
            associated_conditions=list(set(associated)),
            documented_exacerbation_count=exacerbation_count,
            emergency_visits_count=emergency_count,
            hospitalizations_count=inpatient_count,
            clinical_personal_best_pef=clinical_pb_pef
        )

        return NormalizedEHRProfile(
            patient_id=patient_id,
            demographics=demographics,
            asthma_history=asthma_history,
            encounters=encounters,
            medications=medications,
            allergies=allergies,
            care_plans=care_plans,
            historical_measurements=measurements,
            lab_reports=lab_reports,
            imaging_records=imaging_records,
            provenance_source="Synthea FHIR Export",
            is_demo_profile=False
        )
