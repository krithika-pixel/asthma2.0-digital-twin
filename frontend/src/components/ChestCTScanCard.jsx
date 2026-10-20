import React from 'react';
import { ArrowRight, Scan } from 'lucide-react';

export default function ChestCTScanCard({ imagingData, onOpenViewer }) {
  const hasMetadata = imagingData?.has_imaging && imagingData?.primary_scan;

  return (
    <div className="clinical-card">
      <div className="card-header-bar">
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-main)' }}>
          CT Imaging
        </span>
        <button className="card-action-link" onClick={onOpenViewer}>
          <span>Open Imaging</span>
          <ArrowRight size={13} />
        </button>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flex: 1, gap: 9 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
          <Scan size={22} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
          {hasMetadata ? 'EHR imaging metadata available' : 'No CT image files loaded'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 270, lineHeight: 1.45 }}>
          {hasMetadata
            ? 'The EHR record contains study metadata, not the scan pixels. Upload image files to review them.'
            : 'Upload DICOM slices or standard image files in CT Imaging. No scan findings are inferred.'}
        </div>
      </div>
    </div>
  );
}
