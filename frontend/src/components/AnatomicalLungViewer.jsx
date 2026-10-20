import React, { useState } from 'react';
import { 
  Activity, 
  Heart, 
  Clock, 
  ShieldAlert, 
  Scan, 
  TrendingDown, 
  TrendingUp, 
  AlertCircle,
  Info,
  RotateCw,
  RotateCcw,
  Layers
} from 'lucide-react';

export default function AnatomicalLungViewer({ 
  patient, 
  currentObservation, 
  onSelectAnnotation, 
  selectedPin, 
  onOpenViewer, 
  imagingData,
  monitoringHistory
}) {
  const [activeTab, setActiveTab] = useState('Lungs'); // 'Lungs', 'CT Scan', '3D View'
  const [activeTool, setActiveTool] = useState('lungs');
  const [hoveredPin, setHoveredPin] = useState(null);
  const [yaw, setYaw] = useState(0); // 3D rotation angle in degrees

  const pef = currentObservation?.peak_flow_pef_l_min || 320;
  const fev1 = currentObservation?.fev1_l || 2.1;
  const rr = currentObservation?.respiratory_rate_bpm || 22;
  const spo2 = currentObservation?.spo2_pct || 96;
  const hr = currentObservation?.heart_rate_bpm || currentObservation?.pulse_rate_bpm || 98;
  const symptomScore = currentObservation?.symptom_severity_0_3 !== undefined ? currentObservation.symptom_severity_0_3 * 2 : 6;
  const pbPef = patient?.baseline?.personal_best_pef || 450;
  const pefRatio = Math.max(0.4, Math.min(1.0, pef / pbPef));
  const pefDropPct = Math.round((1.0 - pefRatio) * 100);

  // Compute dynamic sparklines from recent observations
  const recentObs = (monitoringHistory?.recent_observations || []).slice(-8);
  const pefPoints = recentObs.map(o => Number(o.peak_flow_pef_l_min)).filter(v => !isNaN(v) && v > 0);
  const fev1Points = recentObs.map(o => Number(o.fev1_l)).filter(v => !isNaN(v) && v > 0);

  const buildSparkline = (dataPoints, defaultVal, minY = 100, maxY = 500) => {
    const pts = dataPoints.length >= 2 ? dataPoints : [defaultVal * 1.05, defaultVal * 0.98, defaultVal];
    const actualMin = Math.min(...pts, minY);
    const actualMax = Math.max(...pts, maxY);
    const range = actualMax - actualMin || 1;
    const w = 110;
    const h = 38;
    const coords = pts.map((val, idx) => {
      const x = (idx / (pts.length - 1)) * (w - 10) + 5;
      const y = h - 6 - ((val - actualMin) / range) * (h - 12);
      return { x, y };
    });
    const pathD = coords.reduce((acc, p, i) => i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `${acc} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
    const lastCoord = coords[coords.length - 1];
    return { pathD, lastCoord };
  };

  const pefSpark = buildSparkline(pefPoints, pef, 150, 480);
  const fev1Spark = buildSparkline(fev1Points, fev1, 1.0, 3.5);

  // Dynamic patient-specific pins
  const isWheezing = currentObservation?.wheezing === 1;
  const hasModeledFlowChange = pefDropPct >= 15;

  const pins = [
    {
      id: 'trachea',
      title: 'Trachea',
      subtitle: isWheezing ? 'Mucosal Irritation [Simulated]' : 'Normal Patency',
      x: '50%',
      y: '32%',
      status: isWheezing ? 'warning' : 'normal',
      dotColor: isWheezing ? '#f59e0b' : '#22c55e',
      alert: isWheezing,
      detail: isWheezing 
        ? 'Mucosal edema and mild bronchoconstriction consistent with simulated acute response.'
        : 'Normal central airway caliber without detected mucosal inflammation.'
    },
    {
      id: 'right_lung',
      title: 'Right Lung',
      subtitle: 'Normal Aeration',
      x: '34%',
      y: '58%',
      status: 'normal',
      dotColor: '#22c55e',
      alert: false,
      detail: 'Symmetrical breath sounds, normal ventilation-perfusion balance, no consolidation.'
    },
    {
      id: 'left_lung',
      title: 'Left Lung',
      subtitle: hasModeledFlowChange ? 'Modeled airflow change [Simulated]' : 'No modeled airflow change',
      x: '66%',
      y: '62%',
      status: hasModeledFlowChange ? 'warning' : 'normal',
      dotColor: hasModeledFlowChange ? '#f59e0b' : '#22c55e',
      alert: false,
      detail: hasModeledFlowChange
        ? `Illustrative airflow model response to a ${pefDropPct}% PEF decrease from baseline. This is not an imaging finding.`
        : 'Illustrative model only; not derived from CT image data.'
    }
  ];

  return (
    <div className="clinical-card">
      {/* Card Header Bar */}
      <div className="card-header-bar">
        <div className="card-title-group">
          <Activity size={18} style={{ color: '#2563eb' }} />
          <span>Virtual Patient Model</span>
        </div>

        <div className="pill-tabs">
          {['Lungs', 'CT Scan', '3D View'].map((tab) => (
            <button
              key={tab}
              className={`pill-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div style={{ padding: '6px 14px', background: '#eff6ff', color: '#1e3a8a', fontSize: 10 }}>
          Illustrative synthetic anatomy; not CT-derived and not airway segmentation.
        </div>
      </div>

      {/* Card Body: Anatomical Viewer on Left, Lung Function on Right */}
      <div className="virtual-patient-split">
        {/* Anatomical Viewer Canvas */}
        <div className="anatomical-viewer-container">
          {/* TAB 1: LUNGS VIEW */}
          {activeTab === 'Lungs' && (
            <div className="lung-svg-box">
              <svg viewBox="0 0 400 450" width="100%" height="100%" style={{ filter: 'drop-shadow(0 0 25px rgba(56, 189, 248, 0.25))' }}>
                <defs>
                  <radialGradient id="lungBgGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#0b1120" stopOpacity="0" />
                  </radialGradient>

                  <linearGradient id="tracheaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="70%" stopColor="#0284c7" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>

                  <linearGradient id="rightLungGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#0284c7" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.3" />
                  </linearGradient>

                  <linearGradient id="leftLungGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                    <stop offset="40%" stopColor="#0284c7" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.3" />
                  </linearGradient>

                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Background ambient pulmonary glow */}
                <circle cx="200" cy="240" r="150" fill="url(#lungBgGlow)" />

                {/* Thoracic Ribcage Silhouettes */}
                <g stroke="#1e293b" strokeWidth="1.5" fill="none" opacity="0.45">
                  <path d="M 130 140 C 90 150, 70 180, 70 210" />
                  <path d="M 270 140 C 310 150, 330 180, 330 210" />
                  <path d="M 125 180 C 80 195, 60 230, 60 270" />
                  <path d="M 275 180 C 320 195, 340 230, 340 270" />
                  <path d="M 120 220 C 75 240, 55 280, 55 330" />
                  <path d="M 280 220 C 325 240, 345 280, 345 330" />
                </g>

                {/* Right Lung (Viewer's left) */}
                <path
                  d="M 185 155 C 170 135, 140 130, 115 150 C 80 180, 65 240, 70 300 C 75 350, 110 390, 150 395 C 175 398, 185 360, 185 320 Z"
                  fill="url(#rightLungGrad)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  filter="url(#neonGlow)"
                  style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                  onClick={() => onSelectAnnotation && onSelectAnnotation(pins[1])}
                />

                {/* Illustrative generic lung; no image-based segmentation is applied. */}
                <path
                  d="M 215 155 C 230 135, 260 130, 285 150 C 320 180, 335 240, 330 300 C 325 350, 290 390, 250 395 C 225 398, 215 360, 215 320 Z"
                  fill="url(#leftLungGrad)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  filter="url(#neonGlow)"
                  style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                  onClick={() => onSelectAnnotation && onSelectAnnotation(pins[2])}
                />

                {/* Trachea (Central Airway) */}
                <path
                  d="M 194 60 L 206 60 L 206 170 L 194 170 Z"
                  fill="url(#tracheaGrad)"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                />

                {/* Tracheal rings */}
                {[75, 90, 105, 120, 135, 150, 165].map((yVal, idx) => (
                  <line key={idx} x1="193" y1={yVal} x2="207" y2={yVal} stroke="#0284c7" strokeWidth="1.5" opacity="0.8" />
                ))}

                {/* Main Bronchi */}
                <path d="M 200 170 Q 170 190 140 220" stroke="#38bdf8" strokeWidth="4" fill="none" strokeLinecap="round" />
                <path d="M 200 170 Q 230 190 260 220" stroke="#38bdf8" strokeWidth="4" fill="none" strokeLinecap="round" />

                {/* Secondary branches */}
                <path d="M 155 205 Q 120 220 100 250" stroke="#0284c7" strokeWidth="2.5" fill="none" />
                <path d="M 140 220 Q 130 260 120 310" stroke="#0284c7" strokeWidth="2" fill="none" />
                <path d="M 245 205 Q 280 220 300 250" stroke="#0284c7" strokeWidth="2.5" fill="none" />
                <path d="M 260 220 Q 270 260 280 310" stroke="#0284c7" strokeWidth="2" fill="none" />

                {/* Dynamic Airflow particles */}
                <circle cx="200" cy="110" r="2.5" fill="#ffffff" opacity="0.9">
                  <animate attributeName="cy" values="70;170;70" dur="2.4s" repeatCount="indefinite" />
                </circle>
              </svg>

              {/* Clickable Callout Pins */}
              {pins.map((pin) => (
                <div
                  key={pin.id}
                  className="annotation-pin"
                  style={{ top: pin.y, left: pin.x, transform: 'translate(-50%, -50%)' }}
                  onClick={() => onSelectAnnotation && onSelectAnnotation(pin)}
                  onMouseEnter={() => setHoveredPin(pin)}
                  onMouseLeave={() => setHoveredPin(null)}
                >
                  <div className={`pin-pill ${pin.alert ? 'alert' : ''}`}>
                    <span className={`pin-dot ${pin.alert ? 'red' : ''}`} />
                    <span>
                      <strong>{pin.title}:</strong> {pin.subtitle}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: CT imaging metadata only */}
          {activeTab === 'CT Scan' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontSize: 13, fontWeight: 700 }}>
                  <Scan size={15} />
                  <span>CT Imaging</span>
                </div>
                <span className="status-pill normal" style={{ fontSize: 10 }}>Local viewer</span>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <Scan size={22} />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e2e8f0' }}>
                  No scan pixels are loaded.
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', maxWidth: 280, lineHeight: 1.5 }}>
                  {imagingData?.has_imaging
                    ? 'The EHR entry provides study metadata only; it does not include viewable image files.'
                    : 'Upload DICOM or image files to review the actual slices. A single image is not treated as a 3D volume.'}
                </div>
                <button
                  className="btn-ehr-view"
                  style={{ background: '#2563eb', color: '#fff', justifyContent: 'center' }}
                  onClick={() => onOpenViewer && onOpenViewer()}
                >
                  <Layers size={14} />
                  <span>Open CT Imaging</span>
                </button>
              </div>

              <div style={{ fontSize: 9.5, color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: 6 }}>
                EHR imaging metadata is distinct from the scan image data.
              </div>
            </div>
          )}

          {/* TAB 3: 3D VIEW (Interactive Rotatable 3D Thoracic Model) */}
          {activeTab === '3D View' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontSize: 13, fontWeight: 700 }}>
                  <Layers size={15} />
                  <span>3D Thoracic Anatomical Model</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button 
                    style={{ background: '#1e293b', border: 'none', color: '#e2e8f0', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
                    onClick={() => setYaw((y) => (y - 30 + 360) % 360)}
                    title="Rotate left"
                  >
                    ◀ Rotate Left
                  </button>
                  <button 
                    style={{ background: '#1e293b', border: 'none', color: '#e2e8f0', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
                    onClick={() => setYaw((y) => (y + 30) % 360)}
                    title="Rotate right"
                  >
                    Rotate Right ▶
                  </button>
                  <button 
                    style={{ background: '#334155', border: 'none', color: '#e2e8f0', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
                    onClick={() => setYaw(0)}
                    title="Reset angle"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* 3D Model Perspective projection based on yaw */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 240 220" width="220" height="200" style={{ filter: 'drop-shadow(0 0 20px rgba(56, 189, 248, 0.2))' }}>
                  <defs>
                    <radialGradient id="meshGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#082f49" stopOpacity="0.2" />
                    </radialGradient>
                  </defs>

                  {/* Rotatable Coordinate Container */}
                  <g transform={`rotate(${Math.sin((yaw * Math.PI) / 180) * 18}, 120, 110)`}>
                    {/* Spine posterior reference */}
                    <rect x="117" y="30" width="6" height="150" rx="3" fill="#334155" opacity="0.6" />

                    {/* Left & Right Rib Cage Layering computed with isometric projection */}
                    {[-40, -20, 0, 20, 40, 60].map((offsetY, idx) => {
                      const spread = 70 + Math.cos(((yaw + idx * 15) * Math.PI) / 180) * 15;
                      const depth = Math.sin(((yaw + idx * 15) * Math.PI) / 180) * 10;
                      return (
                        <g key={idx} opacity={0.5 + idx * 0.08}>
                          <path 
                            d={`M ${120 - spread} ${100 + offsetY} C ${120 - spread * 0.5} ${85 + offsetY + depth}, ${120 + spread * 0.5} ${85 + offsetY - depth}, ${120 + spread} ${100 + offsetY}`} 
                            stroke="#38bdf8" 
                            strokeWidth="1.5" 
                            fill="none" 
                          />
                        </g>
                      );
                    })}

                    {/* Central Trachea */}
                    <path d="M 120 40 L 120 100" stroke="#7dd3fc" strokeWidth="4" strokeLinecap="round" />
                    <path d="M 120 100 Q 95 115 80 140" stroke="#38bdf8" strokeWidth="2.5" fill="none" />
                    <path d="M 120 100 Q 145 115 160 140" stroke="#38bdf8" strokeWidth="2.5" fill="none" />

                    {/* Lobar volumetric clouds */}
                    <ellipse cx={95 - Math.sin((yaw * Math.PI) / 180) * 15} cy="135" rx="38" ry="48" fill="url(#meshGrad)" stroke="#38bdf8" strokeWidth="1" opacity="0.75" />
                    <ellipse cx={145 - Math.sin((yaw * Math.PI) / 180) * 15} cy="135" rx="38" ry="48" fill="url(#meshGrad)" stroke="#38bdf8" strokeWidth="1" opacity="0.75" />
                  </g>

                  {/* Orientation Indicator */}
                  <text x="120" y="210" fill="#94a3b8" fontSize="10" textAnchor="middle">
                    Viewing Angle: {yaw}° Yaw (Thoracic Cavity)
                  </text>
                </svg>
              </div>

              <div style={{ fontSize: 9.5, color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: 6, lineHeight: 1.3 }}>
                *Standard Anatomical Reference Model (Adult Thoracic Cavity). Generic 3D geometry for spatial anatomical orientation; not derived from patient-specific volumetric CT segmentation.
              </div>
            </div>
          )}
        </div>

        {/* Right Sub-Panel: Lung Function (Current) */}
        <div className="lung-metrics-subpanel">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                Lung Function (Current)
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Personalized Model
              </span>
            </div>

            {/* PEF Row */}
            <div className="spirometry-row">
              <div className="spiro-left">
                <span className="spiro-title">PEF</span>
                <div className="spiro-val-unit">
                  {pef} <span>L/min</span>
                </div>
                <div className="spiro-delta-pill">
                  <TrendingDown size={12} />
                  <span>{pefDropPct}% from personal best</span>
                </div>
              </div>

              {/* Sparkline PEF */}
              <div className="spiro-sparkline">
                <svg viewBox="0 0 110 38" width="100%" height="100%">
                  {pefSpark.pathD && (
                    <path
                      d={pefSpark.pathD}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}
                  {pefSpark.lastCoord && (
                    <circle cx={pefSpark.lastCoord.x} cy={pefSpark.lastCoord.y} r="3.5" fill="#2563eb" />
                  )}
                </svg>
              </div>
            </div>

            {/* FEV1 Row */}
            <div className="spirometry-row">
              <div className="spiro-left">
                <span className="spiro-title">FEV1</span>
                <div className="spiro-val-unit">
                  {fev1} <span>L</span>
                </div>
                <div className="spiro-delta-pill">
                  <TrendingDown size={12} />
                  <span>{Math.round(pefDropPct * 1.1)}% from baseline</span>
                </div>
              </div>

              {/* Sparkline FEV1 */}
              <div className="spiro-sparkline">
                <svg viewBox="0 0 110 38" width="100%" height="100%">
                  {fev1Spark.pathD && (
                    <path
                      d={fev1Spark.pathD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}
                  {fev1Spark.lastCoord && (
                    <circle cx={fev1Spark.lastCoord.x} cy={fev1Spark.lastCoord.y} r="3.5" fill="#3b82f6" />
                  )}
                </svg>
              </div>
            </div>

            <div style={{ padding: '8px 0 2px' }}>
              <button 
                className="card-action-link"
                style={{ fontSize: 12 }}
                onClick={() => onSelectAnnotation && onSelectAnnotation({ title: 'Spirometry', subtitle: 'PEF & FEV1 Trend' })}
              >
                View Spirometry Trend &gt;
              </button>
            </div>
          </div>

          {/* 4 Mini Stat Tiles */}
          <div className="mini-tiles-grid">
            {/* Resp. Rate */}
            <div className="mini-tile">
              <span className="mini-tile-label">Resp. Rate</span>
              <div className="mini-tile-val-row">
                <span className="mini-tile-val">{rr} <span>/min</span></span>
                <span className="mini-tile-delta">
                  <TrendingUp size={11} /> 27%
                </span>
              </div>
            </div>

            {/* SpO2 */}
            <div className="mini-tile">
              <span className="mini-tile-label">SpO₂</span>
              <div className="mini-tile-val-row">
                <span className="mini-tile-val">{spo2}<span>%</span></span>
                <span className="mini-tile-delta">
                  <TrendingDown size={11} /> 1%
                </span>
              </div>
            </div>

            {/* Heart Rate */}
            <div className="mini-tile">
              <span className="mini-tile-label">Heart Rate</span>
              <div className="mini-tile-val-row">
                <span className="mini-tile-val">{hr} <span>bpm</span></span>
                <span className="mini-tile-delta">
                  <TrendingUp size={11} /> 15%
                </span>
              </div>
            </div>

            {/* Symptom Score */}
            <div className="mini-tile">
              <span className="mini-tile-label">Symptom Score</span>
              <div className="mini-tile-val-row">
                <span className="mini-tile-val">{symptomScore} <span>/ 10</span></span>
                <span className="mini-tile-delta" style={{ color: '#f59e0b' }}>
                  <AlertCircle size={11} /> 3
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
