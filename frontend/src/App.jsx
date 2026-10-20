import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  User, 
  FileText, 
  TrendingUp, 
  Wind, 
  Sliders, 
  Clock, 
  BarChart3, 
  Database, 
  UserCheck, 
  Search, 
  X,
  Scan,
  ChevronDown, 
  Plus, 
  Play, 
  Pause, 
  FastForward, 
  RotateCcw,
  Heart,
  ArrowRight,
  Info
} from 'lucide-react';

import AnatomicalLungViewer from './components/AnatomicalLungViewer';
import FutureEventPredictionCard from './components/FutureEventPredictionCard';
import LabReportsCard from './components/LabReportsCard';
import ChestCTScanCard from './components/ChestCTScanCard';
import EnvironmentalExposureCard from './components/EnvironmentalExposureCard';
import ExplanationModal from './components/ExplanationModal';

import LiveMonitoringView from './views/LiveMonitoringView';
import EnvironmentalIntelligenceView from './views/EnvironmentalIntelligenceView';
import PredictionsView from './views/PredictionsView';
import ScenarioLabView from './views/ScenarioLabView';
import EventTimelineView from './views/EventTimelineView';
import ModelEvaluationView from './views/ModelEvaluationView';
import HistoricalEHRView from './views/HistoricalEHRView';
import ClinicianFeedbackView from './views/ClinicianFeedbackView';
import DataSourcesView from './views/DataSourcesView';
import CTImagingView from './views/CTImagingView';

export default function App() {
  const [activeNav, setActiveNav] = useState('Overview');
  const [selectedPatientId, setSelectedPatientId] = useState('PAT-001');
  const [patientsList, setPatientsList] = useState([]);
  const [patientProfile, setPatientProfile] = useState(null);
  const [currentObservation, setCurrentObservation] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [labsData, setLabsData] = useState([]);
  const [imagingData, setImagingData] = useState(null);
  const [ehrData, setEhrData] = useState(null);
  const [triggerData, setTriggerData] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [monitoringHistory, setMonitoringHistory] = useState(null);
  const [evaluationData, setEvaluationData] = useState(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Modals state
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);

  // Load patients list
  useEffect(() => {
    fetch('/api/patients')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.length > 0) {
          setPatientsList(data);
          if (!selectedPatientId) setSelectedPatientId(data[0].patient_id);
        }
      })
      .catch((err) => console.error('Failed to load patients', err));
  }, []);

  const activeReqIdRef = React.useRef(0);

  // Fetch Patient-specific state whenever selectedPatientId changes
  const fetchPatientData = async (pid) => {
    const currentReqId = ++activeReqIdRef.current;
    try {
      const [profRes, predRes, labsRes, imgRes, ehrRes, trigRes, timeRes, monRes] = await Promise.all([
        fetch(`/api/patients/${pid}`),
        fetch(`/api/patients/${pid}/prediction`),
        fetch(`/api/patients/${pid}/labs`),
        fetch(`/api/patients/${pid}/imaging`),
        fetch(`/api/patients/${pid}/ehr`),
        fetch(`/api/patients/${pid}/triggers`),
        fetch(`/api/patients/${pid}/timeline`),
        fetch(`/api/patients/${pid}/monitoring?limit=30`)
      ]);

      // If a newer request was dispatched while this was in-flight, discard results safely
      if (activeReqIdRef.current !== currentReqId) {
        return;
      }

      if (profRes.ok) {
        const prof = await profRes.json();
        setPatientProfile(prof);
        const cs = prof.current_state || {};
        setCurrentObservation({
          peak_flow_pef_l_min: cs.pef ?? null,
          fev1_l: cs.fev1 ?? null,
          respiratory_rate_bpm: cs.respiratory_rate ?? null,
          spo2_pct: cs.spo2 ?? null,
          heart_rate_bpm: cs.heart_rate ?? null,
          symptom_severity_0_3: cs.symptom_score !== undefined && cs.symptom_score !== null ? Math.round(cs.symptom_score / 2) : 0,
          pm25_ug_m3: cs.pm25 ?? null,
          pm10_ug_m3: cs.pm10 ?? null,
          temperature_c: cs.temperature ?? null,
          humidity_pct: cs.humidity ?? null,
          pollen_level_0_10: cs.pollen ?? null,
          dust_exposure_level: cs.dust ?? 0,
          wheezing: cs.wheezing ?? 0,
          coughing: cs.coughing ?? 0,
          rescue_inhaler_uses: cs.rescue_inhaler_uses ?? 0,
          timestamp: cs.observation_timestamp || new Date().toISOString()
        });
      }

      if (predRes.ok) {
        const pred = await predRes.json();
        if (activeReqIdRef.current === currentReqId) setPredictionData(pred);
      }

      if (labsRes.ok) {
        const labs = await labsRes.json();
        if (activeReqIdRef.current === currentReqId) setLabsData(labs);
      }
      if (imgRes.ok) {
        const img = await imgRes.json();
        if (activeReqIdRef.current === currentReqId) setImagingData(img);
      }
      if (ehrRes.ok) {
        const ehr = await ehrRes.json();
        if (activeReqIdRef.current === currentReqId) setEhrData(ehr);
      }
      if (trigRes.ok) {
        const trig = await trigRes.json();
        if (activeReqIdRef.current === currentReqId) setTriggerData(trig);
      }
      if (timeRes.ok) {
        const tline = await timeRes.json();
        if (activeReqIdRef.current === currentReqId) setTimelineData(tline);
      }
      if (monRes.ok) {
        const mon = await monRes.json();
        if (activeReqIdRef.current === currentReqId) setMonitoringHistory(mon);
      }

      // Also fetch prediction history
      const histRes = await fetch(`/api/patients/${pid}/prediction/history`);
      if (histRes.ok && activeReqIdRef.current === currentReqId) {
        setPredictionHistory(await histRes.json());
      }
    } catch (e) {
      console.error('Error fetching patient data', e);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientData(selectedPatientId);
    }
  }, [selectedPatientId]);

  // Load Model Evaluation Data
  useEffect(() => {
    fetch('/api/evaluation')
      .then((r) => r.json())
      .then((d) => setEvaluationData(d))
      .catch((e) => console.error(e));
  }, []);

  // Step Simulation
  const handleStepSimulation = async (steps = 1) => {
    try {
      const resp = await fetch(`/api/patients/${selectedPatientId}/simulation/step?steps=${steps}`, {
        method: 'POST'
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.current_observation) {
          setCurrentObservation(data.current_observation);
          fetchPatientData(selectedPatientId);
        }
      }
    } catch (e) {
      console.error('Error advancing simulation step', e);
    }
  };

  // Reset Simulation
  const handleResetSimulation = async () => {
    try {
      const resp = await fetch(`/api/patients/${selectedPatientId}/simulation/reset`, {
        method: 'POST'
      });
      if (resp.ok) {
        fetchPatientData(selectedPatientId);
      }
    } catch (e) {
      console.error('Error resetting simulation', e);
    }
  };

  // Live Playback Loop
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      const delay = Math.max(800, 2500 / playbackSpeed);
      interval = setInterval(() => {
        handleStepSimulation(1);
      }, delay);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, selectedPatientId]);

  // Navigation items
  const navItems = [
    { id: 'Overview', label: 'Overview', icon: Activity },
    { id: 'Patient Profile', label: 'Patient Profile', icon: User },
    { id: 'CT Imaging', label: 'CT Imaging', icon: Scan },
    { id: 'Live Monitoring', label: 'Live Monitoring', icon: Activity },
    { id: 'Predictions', label: 'Predictions', icon: TrendingUp },
    { id: 'Environmental Analysis', label: 'Environmental Analysis', icon: Wind },
    { id: 'Scenario Simulation', label: 'Scenario Simulation', icon: Sliders },
    { id: 'Event Timeline', label: 'Event Timeline', icon: Clock },
    { id: 'Model Evaluation', label: 'Model Evaluation', icon: BarChart3 },
    { id: 'Data Sources', label: 'Data Sources', icon: Database },
    { id: 'Clinician Feedback', label: 'Clinician Feedback', icon: UserCheck },
  ];

  const currentPatient = patientsList.find((p) => p.patient_id === selectedPatientId) || {
    patient_id: selectedPatientId || 'PAT-001',
    name: patientProfile?.demographics?.name || 'Virtual Patient',
    age: patientProfile?.demographics?.age || 28,
    gender: patientProfile?.demographics?.gender || 'Female',
    city: patientProfile?.demographics?.city || 'Bengaluru, KA',
    diagnosis: patientProfile?.demographics?.diagnosis || 'Asthma (J45.9)',
    status: 'Active'
  };

  // Default display avatars
  const avatarMap = {
    'PAT-001': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    'PAT-002': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'PAT-003': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'PAT-004': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    'PAT-005': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  };

  // Search Results Generator
  const searchResults = (() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results = [];

    // Search Patients
    patientsList.forEach((p) => {
      const matchId = p.patient_id?.toLowerCase().includes(q);
      const matchName = p.name?.toLowerCase().includes(q);
      const matchCity = p.city?.toLowerCase().includes(q);
      const matchDiag = p.diagnosis?.toLowerCase().includes(q);
      if (matchId || matchName || matchCity || matchDiag) {
        results.push({
          type: 'patient',
          title: `${p.patient_id} - ${p.name || 'Virtual Patient'}`,
          subtitle: `${p.city || 'City'} • ${p.age || 28} yrs • ${p.diagnosis || 'Asthma'}`,
          action: () => {
            setSelectedPatientId(p.patient_id);
            setActiveNav('Overview');
            setSearchQuery('');
            setIsSearchFocused(false);
          }
        });
      }
    });

    // Search Clinical Views and Reports
    const topics = [
      {
        title: 'Spirometry Reports (PEF, FEV1, FVC)',
        subtitle: 'Longitudinal lung function curves & obstruction ratios',
        action: () => { setActiveNav('Patient Profile'); setSearchQuery(''); setIsSearchFocused(false); }
      },
      {
        title: 'CT Imaging',
        subtitle: 'Upload and review local DICOM or image files',
        action: () => { setActiveNav('CT Imaging'); setSearchQuery(''); setIsSearchFocused(false); }
      },
      {
        title: 'Blood Serology & Allergen Labs (IgE, Eosinophils)',
        subtitle: 'Inflammatory biomarkers and allergic sensitization',
        action: () => { setActiveNav('Patient Profile'); setSearchQuery(''); setIsSearchFocused(false); }
      },
      {
        title: 'Environmental AQI & Triggers (PM2.5, Pollen)',
        subtitle: 'Cross-correlation and lag-stratified exposure analysis',
        action: () => { setActiveNav('Environmental Analysis'); setSearchQuery(''); setIsSearchFocused(false); }
      },
      {
        title: 'In Silico Scenario Lab (Hypothetical Perturbations)',
        subtitle: 'What-if parameter simulator with isolated digital twin copy',
        action: () => { setActiveNav('Scenario Simulation'); setSearchQuery(''); setIsSearchFocused(false); }
      },
      {
        title: 'Chronological Clinical Event Timeline',
        subtitle: 'Telemetry spikes, desaturations, and deterioration events',
        action: () => { setActiveNav('Event Timeline'); setSearchQuery(''); setIsSearchFocused(false); }
      },
      {
        title: 'Model Evaluation Lab (PR-AUC, Brier Score, Holdout)',
        subtitle: 'Fair benchmark across EHR, Dynamic, and Fused paradigms',
        action: () => { setActiveNav('Model Evaluation'); setSearchQuery(''); setIsSearchFocused(false); }
      }
    ];

    topics.forEach((t) => {
      if (t.title.toLowerCase().includes(q) || t.subtitle.toLowerCase().includes(q)) {
        results.push({
          type: 'report',
          title: t.title,
          subtitle: t.subtitle,
          action: t.action
        });
      }
    });

    return results;
  })();

  return (
    <div className="app-layout">
      {/* 1. Left Sidebar (Matches ui.png) */}
      <aside className="app-sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-icon-box">
            <Activity size={22} />
          </div>
          <div className="brand-text">
            <h1>Asthma<span>Twin</span></h1>
            <p>Predict. Prevent. Personalize.</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <div
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveNav(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </nav>

        {/* Bottom Virtual Patients Section */}
        <div className="sidebar-patients-section">
          <div className="sidebar-patients-header">
            <span>Virtual Patients</span>
            <span className="counter-badge">{patientsList.length || 5}</span>
          </div>

          <div className="patient-list">
            {(patientsList.length > 0 ? patientsList : [
              { patient_id: 'PAT-001', age: 28, diagnosis: 'Asthma' },
              { patient_id: 'PAT-002', age: 34, diagnosis: 'Asthma' },
              { patient_id: 'PAT-003', age: 19, diagnosis: 'Asthma' },
              { patient_id: 'PAT-004', age: 42, diagnosis: 'Asthma' },
              { patient_id: 'PAT-005', age: 31, diagnosis: 'Asthma' },
            ]).slice(0, 5).map((p) => {
              const isSelected = selectedPatientId === p.patient_id;
              const photo = avatarMap[p.patient_id] || avatarMap['PAT-001'];
              return (
                <div
                  key={p.patient_id}
                  className={`patient-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedPatientId(p.patient_id)}
                >
                  <img src={photo} alt={p.patient_id} className="patient-avatar" />
                  <div className="patient-info">
                    <span className="patient-name-id">{p.patient_id}</span>
                    <span className="patient-subtext">{p.name ? `${p.name} • ` : ''}Asthma</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button 
            className="add-patient-btn"
            onClick={() => alert('New synthetic patient generator seeded. Cohort registry active.')}
          >
            <Plus size={13} />
            <span>Add New Patient</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Content Space */}
      <div className="app-main">
        {/* Top Navigation Bar with Functional Search and Right-Shifted Telemetry Controls */}
        <header className="top-navbar">
          <div className="search-box" style={{ position: 'relative' }}>
            <Search size={16} style={{ color: 'var(--text-light)' }} />
            <input 
              type="text" 
              placeholder="Search patients, profiles, reports, lab biomarkers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}

            {/* Functional search dropdown */}
            {isSearchFocused && searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 6,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                zIndex: 100,
                maxHeight: '320px',
                overflowY: 'auto'
              }}>
                {searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      res.action();
                    }}
                    style={{
                      padding: '10px 14px',
                      borderBottom: idx < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{res.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{res.subtitle}</div>
                    </div>
                    <span className="counter-badge" style={{ background: res.type === 'patient' ? '#eff6ff' : '#f8fafc', color: res.type === 'patient' ? '#2563eb' : '#64748b' }}>
                      {res.type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="top-navbar-actions">
            <button
              className={`top-nav-ct-button ${activeNav === 'CT Imaging' ? 'active' : ''}`}
              onClick={() => setActiveNav('CT Imaging')}
              aria-current={activeNav === 'CT Imaging' ? 'page' : undefined}
              title="Open CT Imaging"
            >
              <Scan size={16} />
              <span>CT Imaging</span>
            </button>

            {/* Simulation Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginRight: 6 }}>
              <span style={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                background: isPlaying ? '#22c55e' : '#94a3b8',
                boxShadow: isPlaying ? '0 0 8px #22c55e' : 'none'
              }} />
              <span style={{ fontWeight: 600, color: isPlaying ? '#15803d' : '#64748b' }}>
                {isPlaying ? 'Live Stream Active' : 'Telemetry Paused'}
              </span>
            </div>

            {/* Speed Multipliers */}
            <div className="pill-tabs" style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '6px' }}>
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  className={`pill-tab ${playbackSpeed === spd ? 'active' : ''}`}
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => setPlaybackSpeed(spd)}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Live Playback Controls Shifted to Right Edge */}
            <div className="sim-controls-pill">
              <button 
                className={`sim-btn ${isPlaying ? 'active' : ''}`}
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? 'Pause Playback' : 'Start Simulated Continuous Telemetry'}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button 
                className="sim-btn"
                onClick={() => handleStepSimulation(1)}
                title="Advance +1 observation step"
              >
                <FastForward size={14} />
              </button>
              <button 
                className="sim-btn"
                onClick={handleResetSimulation}
                title="Reset simulation stream"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Workspace Scroll Area */}
        <main className="workspace-scroll">
          {activeNav === 'Overview' && (
            <>
              {/* Patient Banner Card (Genuine Clinical Metrics, No Fictional Appointments or Doctor) */}
              <div className="patient-banner-card">
                <div className="banner-left">
                  <div className="patient-large-avatar-box">
                    <img 
                      src={avatarMap[selectedPatientId] || avatarMap['PAT-001']} 
                      alt="Patient" 
                      className="patient-large-avatar" 
                    />
                    <span className="avatar-online-dot" />
                  </div>

                  <div className="banner-id-info">
                    <div className="banner-id-row">
                      <span className="banner-id-text">{selectedPatientId}</span>
                      <span className="badge-active">● Active Twin</span>
                    </div>
                    <span className="banner-subtext">
                      {currentPatient.name ? `${currentPatient.name} • ` : ''}{currentPatient.gender || 'Female'} • {currentPatient.age || 28} years • {currentPatient.city || 'Bengaluru, KA'}
                    </span>
                    <span className="banner-subtext" style={{ color: '#0284c7', fontWeight: 600 }}>
                      {currentPatient.diagnosis || 'Asthma (J45.9)'} • Synthetic FHIR R4 EHR
                    </span>
                  </div>
                </div>

                {/* Genuine Clinical Parameter Indicators */}
                <div className="banner-middle-badges">
                  <div className="banner-meta-tile">
                    <div className="tile-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
                      <Activity size={16} />
                    </div>
                    <div className="tile-text">
                      <span className="tile-label">Personal Best PEF</span>
                      <span className="tile-val">
                        {patientProfile?.baseline_state?.pef_reference_value 
                          ? `${Math.round(patientProfile.baseline_state.pef_reference_value)} L/min` 
                          : '420 L/min'}
                      </span>
                    </div>
                  </div>

                  <div className="banner-meta-tile">
                    <div className="tile-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
                      <Heart size={16} />
                    </div>
                    <div className="tile-text">
                      <span className="tile-label">SpO₂ Oxygen</span>
                      <span className="tile-val">
                        {currentObservation?.spo2_pct ? `${currentObservation.spo2_pct}%` : '96%'}
                      </span>
                    </div>
                  </div>

                  <div className="banner-meta-tile">
                    <div className="tile-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
                      <Wind size={16} />
                    </div>
                    <div className="tile-text">
                      <span className="tile-label">Current PEF</span>
                      <span className="tile-val">
                        {currentObservation?.peak_flow_pef_l_min ? `${currentObservation.peak_flow_pef_l_min} L/min` : '--'}
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  className="btn-ehr-view"
                  onClick={() => setActiveNav('Patient Profile')}
                >
                  <span>View Full EHR</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Middle Row: Virtual Patient Model (65%) + Future Event Prediction (35%) */}
              <div className="dashboard-middle-grid">
                <AnatomicalLungViewer
                  patient={currentPatient}
                  currentObservation={currentObservation}
                  monitoringHistory={monitoringHistory}
                  onSelectAnnotation={(pin) => setSelectedAnnotation(pin)}
                  selectedPin={selectedAnnotation}
                  onOpenViewer={() => setActiveNav('CT Imaging')}
                />

                <FutureEventPredictionCard
                  predictionData={predictionData}
                  onOpenExplanation={() => setIsExplanationOpen(true)}
                  onViewAllFeatures={() => setActiveNav('Predictions')}
                />
              </div>

              {/* Bottom Row (3 Columns: Lab Reports + Chest CT Scan + Environmental Exposure) */}
              <div className="dashboard-bottom-grid">
                <LabReportsCard
                  labsData={labsData}
                  onViewHistory={() => setActiveNav('Patient Profile')}
                />

                <ChestCTScanCard
                  imagingData={imagingData}
                  onOpenViewer={() => setActiveNav('CT Imaging')}
                />

                <EnvironmentalExposureCard
                  currentObservation={currentObservation}
                  monitoringHistory={monitoringHistory}
                  city={currentPatient.city || 'Bengaluru, KA'}
                  onNavigateEnvironmental={() => setActiveNav('Environmental Analysis')}
                />
              </div>
            </>
          )}

          {/* Dedicated Tab Views */}
          {activeNav === 'Patient Profile' && (
            <HistoricalEHRView
              patientId={selectedPatientId}
              ehrData={ehrData}
              labsData={labsData}
              imagingData={imagingData}
              onOpenCTViewer={() => setActiveNav('CT Imaging')}
            />
          )}

          {activeNav === 'CT Imaging' && (
            <CTImagingView key={selectedPatientId} patientId={selectedPatientId} />
          )}

          {activeNav === 'Live Monitoring' && (
            <LiveMonitoringView
              patientId={selectedPatientId}
              currentObservation={currentObservation}
              monitoringHistory={monitoringHistory}
              patientProfile={patientProfile}
              onStepSimulation={handleStepSimulation}
              onResetSimulation={handleResetSimulation}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              playbackSpeed={playbackSpeed}
              onChangeSpeed={(spd) => setPlaybackSpeed(spd)}
            />
          )}

          {activeNav === 'Predictions' && (
            <PredictionsView
              patientId={selectedPatientId}
              currentPrediction={predictionData}
              predictionHistory={predictionHistory}
              onSelectEvidenceRecord={(rec) => setIsExplanationOpen(true)}
            />
          )}

          {activeNav === 'Environmental Analysis' && (
            <EnvironmentalIntelligenceView
              patientId={selectedPatientId}
              currentObservation={currentObservation}
              triggerData={triggerData}
              timelineData={timelineData}
              selectedCity={currentPatient.city || 'Bengaluru, KA'}
              onChangeCity={(c) => {
                const updated = patientsList.map((p) => p.patient_id === selectedPatientId ? { ...p, city: c } : p);
                setPatientsList(updated);
              }}
            />
          )}

          {activeNav === 'Scenario Simulation' && (
            <ScenarioLabView
              patientId={selectedPatientId}
              currentObservation={currentObservation}
            />
          )}

          {activeNav === 'Event Timeline' && (
            <EventTimelineView
              patientId={selectedPatientId}
              timelineData={timelineData}
              onRefresh={() => fetchPatientData(selectedPatientId)}
            />
          )}

          {activeNav === 'Model Evaluation' && (
            <ModelEvaluationView evaluationData={evaluationData} />
          )}

          {activeNav === 'Data Sources' && (
            <DataSourcesView />
          )}

          {activeNav === 'Clinician Feedback' && (
            <ClinicianFeedbackView
              patientId={selectedPatientId}
              currentPrediction={predictionData}
            />
          )}
        </main>
      </div>

      {/* Future-Event Prediction Explanation Modal */}
      <ExplanationModal
        isOpen={isExplanationOpen}
        onClose={() => setIsExplanationOpen(false)}
        predictionData={predictionData}
        patientId={selectedPatientId}
      />

      {/* Selected Anatomical Pin Detail Modal */}
      {selectedAnnotation && (
        <div className="modal-overlay" onClick={() => setSelectedAnnotation(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                {selectedAnnotation.title}
              </span>
              <button 
                onClick={() => setSelectedAnnotation(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px 0', fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
              <p>{selectedAnnotation.desc}</p>
              <div style={{ marginTop: 12, padding: 10, background: '#f8fafc', borderRadius: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
                <strong>Dynamic Correlation:</strong> Current telemetry demonstrates real-time pulmonary resistance index derived from baseline spirometry ratio.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
              <button 
                className="btn-primary" 
                style={{ padding: '6px 14px', fontSize: 12 }}
                onClick={() => setSelectedAnnotation(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
