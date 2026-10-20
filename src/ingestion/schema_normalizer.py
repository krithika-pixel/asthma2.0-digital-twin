"""
Normalized Internal EHR Patient Schema.
Decouples the digital twin from raw FHIR or proprietary hospital formats.
Explicitly avoids fabricating missing clinical attributes.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, date
from pydantic import BaseModel, Field


class EncounterSummary(BaseModel):
    id: str
    encounter_type: str  # ambulatory, emergency, inpatient, urgentcare
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    reason_code: Optional[str] = None
    reason_text: Optional[str] = None


class MedicationRecord(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    status: str = "unknown"  # active, completed, stopped, unknown
    prescribed_date: Optional[datetime] = None
    dosage_instruction: Optional[str] = None


class AllergyRecord(BaseModel):
    id: str
    substance: str
    criticality: str = "unknown"  # low, high, unable-to-assess, unknown
    reaction: Optional[str] = None
    recorded_date: Optional[datetime] = None


class CarePlanSummary(BaseModel):
    id: str
    title: str
    status: str = "active"
    start_date: Optional[datetime] = None


class HistoricalLabMeasurement(BaseModel):
    name: str
    value: float
    unit: str
    timestamp: datetime
    loinc_code: Optional[str] = None


class PatientDemographics(BaseModel):
    patient_id: str
    name: Optional[str] = None
    birth_date: Optional[date] = None
    age: Optional[int] = None
    gender: str = "unknown"  # male, female, other, unknown
    ethnicity: Optional[str] = None
    city: Optional[str] = None


class AsthmaHistory(BaseModel):
    has_asthma_diagnosis: bool = False
    diagnosis_code: Optional[str] = None
    diagnosis_description: Optional[str] = None
    diagnosis_date: Optional[datetime] = None
    associated_conditions: List[str] = Field(default_factory=list)  # e.g., Allergic rhinitis, Eczema
    documented_exacerbation_count: int = 0
    emergency_visits_count: int = 0
    hospitalizations_count: int = 0
    clinical_personal_best_pef: Optional[float] = None  # None unless explicitly documented by clinician


class LabReportItem(BaseModel):
    test_name: str
    value: float
    unit: str
    reference_range: str
    status: str = "normal"  # high, normal, low, abnormal, unknown
    observation_date: Optional[datetime] = None
    source: str = "Clinical Diagnostic Laboratory"
    loinc_code: Optional[str] = None


class ImagingRecord(BaseModel):
    id: str
    modality: str = "CT"  # CT, Chest X-Ray
    body_site: str = "Chest / Thorax"
    study_date: Optional[datetime] = None
    findings: str
    impression: str
    slice_count: Optional[int] = None
    image_url: Optional[str] = None
    thumbnail_urls: List[str] = Field(default_factory=list)
    is_synthetic_demonstration: bool = True


class NormalizedEHRProfile(BaseModel):
    patient_id: str
    demographics: PatientDemographics
    asthma_history: AsthmaHistory
    encounters: List[EncounterSummary] = Field(default_factory=list)
    medications: List[MedicationRecord] = Field(default_factory=list)
    allergies: List[AllergyRecord] = Field(default_factory=list)
    care_plans: List[CarePlanSummary] = Field(default_factory=list)
    historical_measurements: List[HistoricalLabMeasurement] = Field(default_factory=list)
    lab_reports: List[LabReportItem] = Field(default_factory=list)
    imaging_records: List[ImagingRecord] = Field(default_factory=list)
    provenance_source: str = "Synthea FHIR"
    is_demo_profile: bool = False

    def to_display_summary(self) -> Dict[str, Any]:
        """Provides a safe overview distinguishing recorded facts from unknown fields."""
        return {
            "Patient ID": self.patient_id,
            "Age": self.demographics.age if self.demographics.age is not None else "Not recorded",
            "Gender": self.demographics.gender,
            "Asthma Diagnosed": "Yes" if self.asthma_history.has_asthma_diagnosis else "No documented diagnosis",
            "Diagnosis Date": str(self.asthma_history.diagnosis_date.date()) if self.asthma_history.diagnosis_date else "Not recorded",
            "Historical Encounters": len(self.encounters),
            "Emergency Encounters": self.asthma_history.emergency_visits_count,
            "Documented Medications": len(self.medications),
            "Documented Allergies": len(self.allergies),
            "Documented Lab Reports": len(self.lab_reports),
            "Imaging Records": len(self.imaging_records),
            "Clinical Personal Best PEF": f"{self.asthma_history.clinical_personal_best_pef} L/min" if self.asthma_history.clinical_personal_best_pef else "Not recorded",
            "Source": f"{self.provenance_source} ({'Illustrative Demo Profile' if self.is_demo_profile else 'Imported Record'})",
        }
