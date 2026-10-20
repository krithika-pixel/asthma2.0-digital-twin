import React, { useState } from 'react';
import { 
  FileText, 
  User, 
  Calendar, 
  Pill, 
  AlertCircle, 
  Layers, 
  Activity, 
  CheckCircle2, 
  ClipboardList 
} from 'lucide-react';

export default function HistoricalEHRView({ patientId, ehrData, labsData, imagingData, onOpenCTViewer }) {
  const [activeSection, setActiveSection] = useState('summary'); // 'summary', 'encounters', 'medications', 'allergies', 'labs', 'imaging'

  const ehr = ehrData || {};
  const encounters = ehr.encounters || [];
  const medications = ehr.medications || [];
  const allergies = ehr.allergies || [];
  const labs = labsData || [];
  const scans = imagingData?.all_studies || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* EHR Header Banner */}
      <div className="patient-banner-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="tile-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <FileText size={18} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Synthea FHIR Historical Health Record</span>
              <span className="counter-badge" style={{ background: '#eff6ff', color: '#2563eb' }}>
                {ehr.provenance || 'Synthea FHIR Export'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Patient ID: <strong>{patientId}</strong> • Standardized HL7 FHIR R4 Ingestion
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="pill-tabs">
          {[
            { id: 'summary', label: 'Clinical Summary' },
            { id: 'encounters', label: `Encounters (${encounters.length})` },
            { id: 'medications', label: `Medications (${medications.length})` },
            { id: 'allergies', label: `Allergies (${allergies.length})` },
            { id: 'labs', label: `Labs (${labs.length})` },
            { id: 'imaging', label: `Imaging (${scans.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`pill-tab ${activeSection === tab.id ? 'active' : ''}`}
              onClick={() => setActiveSection(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Contents */}
      {activeSection === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Asthma Diagnosis & Phenotype */}
          <div className="clinical-card">
            <div className="card-header-bar">
              <div className="card-title-group">
                <Activity size={16} style={{ color: '#2563eb' }} />
                <span>Asthma History &amp; Clinical Context</span>
              </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Documented Diagnosis:</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
                  {ehr.asthma_history?.diagnosis_description || 'Extrinsic Asthma (J45.9)'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Diagnosis Date:</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {ehr.asthma_history?.diagnosis_date ? new Date(ehr.asthma_history.diagnosis_date).toLocaleDateString() : 'Not documented'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Historical Emergency Visits:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                  {ehr.asthma_history?.emergency_visits_count ?? 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Clinical Personal Best PEF:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                  {ehr.asthma_history?.clinical_personal_best_pef ? `${ehr.asthma_history.clinical_personal_best_pef} L/min` : 'Not recorded'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Associated Atopic Conditions:</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {ehr.asthma_history?.associated_conditions?.length ? ehr.asthma_history.associated_conditions.join(', ') : 'None documented'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Demographics & Origin */}
          <div className="clinical-card">
            <div className="card-header-bar">
              <div className="card-title-group">
                <User size={16} style={{ color: '#2563eb' }} />
                <span>Patient Demographics &amp; Provenance</span>
              </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Patient ID:</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{patientId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Age / Gender:</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {ehr.demographics?.age !== undefined ? `${ehr.demographics.age} Years` : 'Age N/A'} • {ehr.demographics?.gender ? (ehr.demographics.gender.charAt(0).toUpperCase() + ehr.demographics.gender.slice(1)) : 'Gender N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Primary Clinic:</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {ehr.demographics?.city ? `Outpatient Center, ${ehr.demographics.city}` : 'Pulmonary Outpatient Center'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>EHR Source:</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>
                  {ehr.provenance || 'Synthea Synthetic FHIR Bundle'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Encounters Tab */}
      {activeSection === 'encounters' && (
        <div className="clinical-card">
          <div className="card-header-bar">
            <div className="card-title-group">
              <Calendar size={16} style={{ color: '#2563eb' }} />
              <span>Documented Encounters</span>
            </div>
          </div>
          <div style={{ padding: '14px 18px', overflowX: 'auto' }}>
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Encounter ID</th>
                  <th>Class / Type</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Clinical Reason</th>
                </tr>
              </thead>
              <tbody>
                {encounters.map((enc, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{enc.id}</td>
                    <td>
                      <span className={`status-pill ${enc.encounter_type === 'emergency' ? 'high' : 'normal'}`}>
                        {enc.encounter_type?.toUpperCase()}
                      </span>
                    </td>
                    <td>{enc.start_time ? new Date(enc.start_time).toLocaleDateString() : '12 Mar 2026'}</td>
                    <td>{enc.end_time ? new Date(enc.end_time).toLocaleDateString() : '12 Mar 2026'}</td>
                    <td>{enc.reason_text || 'Routine Pulmonology Follow-up'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Medications Tab */}
      {activeSection === 'medications' && (
        <div className="clinical-card">
          <div className="card-header-bar">
            <div className="card-title-group">
              <Pill size={16} style={{ color: '#2563eb' }} />
              <span>Documented Medication Regimen</span>
            </div>
          </div>
          <div style={{ padding: '14px 18px', overflowX: 'auto' }}>
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Medication Name</th>
                  <th>Status</th>
                  <th>Prescribed Date</th>
                  <th>Dosage Instruction</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((med, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{med.name}</td>
                    <td>
                      <span className="status-pill normal">
                        {med.status?.toUpperCase() || 'ACTIVE'}
                      </span>
                    </td>
                    <td>{med.prescribed_date ? new Date(med.prescribed_date).toLocaleDateString() : '12 Mar 2026'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{med.dosage_instruction || 'Inhalation as instructed by pulmonologist'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Allergies Tab */}
      {activeSection === 'allergies' && (
        <div className="clinical-card">
          <div className="card-header-bar">
            <div className="card-title-group">
              <AlertCircle size={16} style={{ color: '#dc2626' }} />
              <span>Documented Allergies &amp; Environmental Sensitivities</span>
            </div>
          </div>
          <div style={{ padding: '14px 18px', overflowX: 'auto' }}>
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Substance</th>
                  <th>Criticality</th>
                  <th>Recorded Date</th>
                  <th>Documented Manifestation</th>
                </tr>
              </thead>
              <tbody>
                {allergies.map((all, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{all.substance}</td>
                    <td>
                      <span className={`status-pill ${all.criticality === 'high' ? 'high' : 'warning'}`}>
                        {all.criticality?.toUpperCase()}
                      </span>
                    </td>
                    <td>{all.recorded_date ? new Date(all.recorded_date).toLocaleDateString() : '15 Feb 2016'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{all.reaction || 'Bronchospasm, sneezing, mucosal inflammation'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Labs Tab */}
      {activeSection === 'labs' && (
        <div className="clinical-card">
          <div className="card-header-bar">
            <div className="card-title-group">
              <ClipboardList size={16} style={{ color: '#2563eb' }} />
              <span>Complete Historical Laboratory Reports</span>
            </div>
          </div>
          <div style={{ padding: '14px 18px', overflowX: 'auto' }}>
            <table className="clinical-table">
              <thead>
                <tr>
                  <th>Laboratory Test</th>
                  <th>Result Value</th>
                  <th>Reference Range</th>
                  <th>Status Flag</th>
                  <th>Observation Date</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {labs.map((lab, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{lab.test_name}</td>
                    <td>
                      <strong>{lab.value}</strong> <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{lab.unit}</span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{lab.reference_range}</td>
                    <td>
                      <span className={`status-pill ${lab.status}`}>
                        {lab.status?.toUpperCase()}
                      </span>
                    </td>
                    <td>{lab.observation_date ? new Date(lab.observation_date).toLocaleDateString() : '12 Mar 2026'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lab.source || 'Clinical Laboratory'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Imaging Tab */}
      {activeSection === 'imaging' && (
        <div className="clinical-card">
          <div className="card-header-bar">
            <div className="card-title-group">
              <Layers size={16} style={{ color: '#2563eb' }} />
              <span>Available Diagnostic Imaging Studies</span>
            </div>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#eff6ff', color: '#1e3a8a', fontSize: 11, lineHeight: 1.5 }}>
              This section lists EHR study metadata only. It does not contain or display CT image pixels or radiology findings.
            </div>
            {scans.map((scan, i) => (
              <div 
                key={i} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  background: '#f8fafc',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0'
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                    {scan.modality || 'Imaging'} study • {scan.study_date ? new Date(scan.study_date).toLocaleDateString() : 'Study date not recorded'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Metadata record only{scan.is_synthetic_demonstration ? ' · synthetic demonstration metadata' : ''}
                  </div>
                </div>

                <button 
                  className="btn-open-viewer"
                  onClick={onOpenCTViewer}
                >
                  <Layers size={13} />
                  <span>Open CT Imaging</span>
                </button>
              </div>
            ))}
            {scans.length === 0 && (
              <div style={{ padding: '18px', color: 'var(--text-muted)', fontSize: 12 }}>
                No imaging study metadata is recorded for this patient.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
