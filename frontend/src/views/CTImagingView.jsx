import React, { useEffect, useMemo, useRef, useState } from 'react';
import dicomParser from 'dicom-parser';
import {
  AlertCircle,
  FileImage,
  Layers,
  Maximize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Scan,
  Upload,
} from 'lucide-react';
import './CTImagingView.css';

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;
const MAX_TOTAL_PIXELS = 150_000_000;
const SUPPORTED_TRANSFER_SYNTAXES = new Set([
  '1.2.840.10008.1.2',
  '1.2.840.10008.1.2.1',
]);

function readNumber(dataSet, tag, fallback = null) {
  const value = dataSet.string(tag);
  if (!value) return fallback;
  const parsed = Number.parseFloat(value.split('\\')[0].trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readVector(dataSet, tag, length) {
  const value = dataSet.string(tag);
  if (!value) return null;
  const vector = value.split('\\').map((part) => Number.parseFloat(part.trim()));
  return vector.length === length && vector.every(Number.isFinite) ? vector : null;
}

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof error.message === 'string') return error.message;
  return 'The file could not be read by the selected decoder.';
}

function readDicomFrames(file, buffer) {
  const byteArray = new Uint8Array(buffer);
  const dataSet = dicomParser.parseDicom(byteArray);
  const transferSyntax = dataSet.string('x00020010')?.trim();

  if (!SUPPORTED_TRANSFER_SYNTAXES.has(transferSyntax)) {
    throw new Error(
      'Unsupported DICOM transfer syntax. This viewer supports uncompressed little-endian DICOM only.'
    );
  }

  const rows = dataSet.uint16('x00280010');
  const columns = dataSet.uint16('x00280011');
  const samplesPerPixel = dataSet.uint16('x00280002') || 1;
  const bitsAllocated = dataSet.uint16('x00280100');
  const bitsStored = dataSet.uint16('x00280101') || bitsAllocated;
  const pixelRepresentation = dataSet.uint16('x00280103') || 0;
  const frameCount = readNumber(dataSet, 'x00280008', 1);
  const modality = dataSet.string('x00080060')?.trim().toUpperCase();
  const pixelElement = dataSet.elements.x7fe00010;

  if (modality && modality !== 'CT') {
    throw new Error(`This is a ${modality} DICOM object, not a CT image.`);
  }
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new Error('DICOM frame count is invalid.');
  }
  if (!rows || !columns || rows * columns * frameCount > MAX_TOTAL_PIXELS) {
    throw new Error('DICOM image dimensions are missing or too large.');
  }
  if (samplesPerPixel !== 1 || ![8, 16].includes(bitsAllocated) || bitsStored > bitsAllocated) {
    throw new Error('Only single-channel 8-bit or 16-bit DICOM images are supported.');
  }
  if (!pixelElement || pixelElement.length < rows * columns * frameCount * (bitsAllocated / 8)) {
    throw new Error('DICOM pixel data is missing or incomplete.');
  }

  const pixelsPerFrame = rows * columns;
  const pixels = new Int16Array(pixelsPerFrame * frameCount);
  const view = new DataView(buffer);
  const mask = (1 << bitsStored) - 1;
  const signBit = 1 << (bitsStored - 1);
  const slope = readNumber(dataSet, 'x00281053', 1);
  const intercept = readNumber(dataSet, 'x00281052', 0);
  const pixelOffset = pixelElement.dataOffset;

  for (let index = 0; index < pixels.length; index += 1) {
    const offset = pixelOffset + index * (bitsAllocated / 8);
    const storedValue = bitsAllocated === 8
      ? view.getUint8(offset)
      : view.getUint16(offset, true);
    let value = storedValue & mask;
    if (pixelRepresentation === 1 && (value & signBit)) {
      value -= 1 << bitsStored;
    }
    pixels[index] = Math.max(-32768, Math.min(32767, Math.round(value * slope + intercept)));
  }

  const photometric = dataSet.string('x00280004')?.trim();
  const position = readVector(dataSet, 'x00200032', 3);
  const orientation = readVector(dataSet, 'x00200037', 6);
  const spacingBetweenSlices = readNumber(dataSet, 'x00180088');
  const seriesUid = dataSet.string('x0020000e')?.trim() || null;
  const instanceNumber = readNumber(dataSet, 'x00200013');
  const normal = orientation ? [
    orientation[1] * orientation[5] - orientation[2] * orientation[4],
    orientation[2] * orientation[3] - orientation[0] * orientation[5],
    orientation[0] * orientation[4] - orientation[1] * orientation[3],
  ] : null;

  return Array.from({ length: frameCount }, (_, frameIndex) => ({
    fileName: frameCount === 1 ? file.name : `${file.name} · frame ${frameIndex + 1}`,
    pixels: pixels.subarray(frameIndex * pixelsPerFrame, (frameIndex + 1) * pixelsPerFrame),
    width: columns,
    height: rows,
    pixelType: 'dicom',
    photometric,
    seriesUid,
    instanceNumber: instanceNumber === null ? null : instanceNumber + frameIndex,
    position: position && normal && spacingBetweenSlices
      ? position.map((value, axis) => value + normal[axis] * spacingBetweenSlices * frameIndex)
      : frameIndex === 0 ? position : null,
    orientation,
    pixelSpacing: readVector(dataSet, 'x00280030', 2),
    windowCenter: readNumber(dataSet, 'x00281050'),
    windowWidth: readNumber(dataSet, 'x00281051'),
  }));
}

async function readImageFrame(file) {
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_TOTAL_PIXELS) {
      throw new Error('Image dimensions are missing or too large.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not read image pixels in this browser.');
    context.drawImage(bitmap, 0, 0);
    const pixels = new Uint8Array(context.getImageData(0, 0, bitmap.width, bitmap.height).data);
    return {
      fileName: file.name,
      pixels,
      width: bitmap.width,
      height: bitmap.height,
      pixelType: 'image',
      channels: 4,
      photometric: 'RGB',
    };
  } finally {
    bitmap.close();
  }
}

function isDicomFile(file) {
  return /\.dcm$|\.dicom$/i.test(file.name) || file.type === 'application/dicom';
}

function orderDicomFrames(frames) {
  if (frames.some((frame) => frame.pixelType !== 'dicom')) return frames;
  const positioned = frames.every((frame) => frame.position && frame.orientation);
  if (positioned) {
    const direction = frames[0].orientation;
    const normal = [
      direction[1] * direction[5] - direction[2] * direction[4],
      direction[2] * direction[3] - direction[0] * direction[5],
      direction[0] * direction[4] - direction[1] * direction[3],
    ];
    if (frames.every((frame) => frame.orientation.every((value, index) => Math.abs(value - direction[index]) < 0.001))) {
      return [...frames].sort((a, b) => {
        const project = (frame) => frame.position.reduce((sum, value, index) => sum + value * normal[index], 0);
        return project(a) - project(b);
      });
    }
  }
  if (frames.every((frame) => frame.instanceNumber !== null)) {
    return [...frames].sort((a, b) => a.instanceNumber - b.instanceNumber);
  }
  return frames;
}

function getVolume(frames) {
  if (frames.length < 2 || frames.some((frame) => frame.pixelType !== 'dicom')) return null;
  const first = frames[0];
  if (!first.position || !first.orientation || !first.pixelSpacing || !first.seriesUid) return null;
  if (frames.some((frame) => (
    frame.width !== first.width
    || frame.height !== first.height
    || frame.seriesUid !== first.seriesUid
    || !frame.position
    || !frame.orientation
    || !frame.pixelSpacing
  ))) return null;

  const direction = first.orientation;
  const normal = [
    direction[1] * direction[5] - direction[2] * direction[4],
    direction[2] * direction[3] - direction[0] * direction[5],
    direction[0] * direction[4] - direction[1] * direction[3],
  ];
  const axisAligned = Math.abs(direction[0] - 1) < 0.001
    && Math.abs(direction[1]) < 0.001
    && Math.abs(direction[2]) < 0.001
    && Math.abs(direction[3]) < 0.001
    && Math.abs(direction[4] - 1) < 0.001
    && Math.abs(direction[5]) < 0.001;
  if (!axisAligned) return null;

  const sameGeometry = frames.every((frame) => (
    frame.orientation.every((value, index) => Math.abs(value - direction[index]) < 0.001)
    && frame.pixelSpacing.every((value, index) => Math.abs(value - first.pixelSpacing[index]) < 0.001)
  ));
  if (!sameGeometry) return null;

  const ordered = [...frames].sort((a, b) => {
    const projection = (frame) => frame.position.reduce((sum, value, index) => sum + value * normal[index], 0);
    return projection(a) - projection(b);
  });
  const projections = ordered.map((frame) => (
    frame.position.reduce((sum, value, index) => sum + value * normal[index], 0)
  ));
  if (projections.some((value, index) => index > 0 && value - projections[index - 1] < 0.001)) return null;
  const intervals = projections.slice(1).map((value, index) => value - projections[index]);
  const meanInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  if (intervals.some((value) => Math.abs(value - meanInterval) > Math.max(0.001, meanInterval * 0.05))) return null;

  return { slices: ordered, pixelSpacing: first.pixelSpacing };
}

function makePlane(volume, view, index) {
  const slices = volume.slices;
  const rows = slices[0].height;
  const columns = slices[0].width;

  if (view === 'axial') return slices[index];

  if (view === 'coronal') {
    const pixels = new Int16Array(slices.length * columns);
    for (let z = 0; z < slices.length; z += 1) {
      for (let x = 0; x < columns; x += 1) {
        pixels[z * columns + x] = slices[z].pixels[index * columns + x];
      }
    }
    return { pixels, width: columns, height: slices.length, pixelType: 'dicom', photometric: 'MONOCHROME2' };
  }

  const pixels = new Int16Array(slices.length * rows);
  for (let z = 0; z < slices.length; z += 1) {
    for (let y = 0; y < rows; y += 1) {
      pixels[z * rows + y] = slices[z].pixels[y * columns + index];
    }
  }
  return { pixels, width: rows, height: slices.length, pixelType: 'dicom', photometric: 'MONOCHROME2' };
}

function CTCanvas({ frame, center, width, inverted, zoom, pan, onPanStart, onPanMove, onPanEnd, onWheel }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(frame.width, frame.height);
    const lower = center - width / 2;
    const upper = center + width / 2;
    const span = Math.max(1, upper - lower);

    const channels = frame.channels || 1;
    for (let index = 0; index < frame.width * frame.height; index += 1) {
      const source = index * channels;
      const offset = index * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        let intensity = Math.round(((frame.pixels[source + (channels === 1 ? 0 : channel)] - lower) / span) * 255);
        intensity = Math.max(0, Math.min(255, intensity));
        if (inverted || frame.photometric === 'MONOCHROME1') intensity = 255 - intensity;
        image.data[offset + channel] = intensity;
      }
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }, [frame, center, width, inverted]);

  return (
    <div
      className="ct-image-stage"
      onPointerDown={onPanStart}
      onPointerMove={onPanMove}
      onPointerUp={onPanEnd}
      onPointerCancel={onPanEnd}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        className="ct-image-canvas"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      />
      <span className="ct-stage-hint"><Move size={13} /> Drag to pan · Scroll to zoom</span>
    </div>
  );
}

export default function CTImagingView({ patientId }) {
  const inputRef = useRef(null);
  const dragRef = useRef(null);
  const [frames, setFrames] = useState([]);
  const [volume, setVolume] = useState(null);
  const [activeView, setActiveView] = useState('axial');
  const [sliceIndex, setSliceIndex] = useState(0);
  const [windowCenter, setWindowCenter] = useState(40);
  const [windowWidth, setWindowWidth] = useState(400);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState([]);

  const sliceCount = activeView === 'axial' ? frames.length
    : activeView === 'coronal' ? (volume?.slices[0].height || 1)
      : (volume?.slices[0].width || 1);
  const plane = useMemo(() => {
    if (!frames.length) return null;
    if (activeView === 'axial') return frames[sliceIndex];
    return volume ? makePlane(volume, activeView, sliceIndex) : null;
  }, [frames, volume, activeView, sliceIndex]);
  const isDicom = plane?.pixelType === 'dicom';

  const loadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_UPLOAD_BYTES) {
      setErrors(['Selection exceeds the 512 MB per-study browser processing limit.']);
      return;
    }

    setLoading(true);
    setProgress('Reading selected files locally…');
    setErrors([]);
    setFrames([]);
    setVolume(null);
    setActiveView('axial');
    setSliceIndex(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    const loaded = [];
    const failures = [];
    let totalPixels = 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setProgress(`Reading ${index + 1} of ${files.length}: ${file.name}`);
      try {
        let frame;
        if (isDicomFile(file)) {
          frame = readDicomFrames(file, await file.arrayBuffer());
        } else if (file.type.startsWith('image/')) {
          frame = await readImageFrame(file);
        } else {
          throw new Error('Unsupported file. Choose DICOM, PNG, JPEG, WebP, or another browser-readable image.');
        }
        const decodedFrames = Array.isArray(frame) ? frame : [frame];
        totalPixels += decodedFrames.reduce((total, decodedFrame) => total + decodedFrame.width * decodedFrame.height, 0);
        if (totalPixels > MAX_TOTAL_PIXELS) {
          throw new Error('Selection exceeds the 150-million-pixel browser processing limit.');
        }
        loaded.push(...decodedFrames);
      } catch (error) {
        failures.push(`${file.name}: ${getErrorMessage(error)}`);
      }
    }

    if (loaded.length) {
      const orderedFrames = orderDicomFrames(loaded);
      const nextVolume = getVolume(orderedFrames);
      const nextFrames = nextVolume?.slices || orderedFrames;
      setFrames(nextFrames);
      setVolume(nextVolume);
      setErrors(failures);
      if (nextFrames[0].pixelType === 'dicom') {
        setWindowCenter(nextFrames[0].windowCenter ?? -600);
        setWindowWidth(Math.max(1, nextFrames[0].windowWidth ?? 1500));
      } else {
        setWindowCenter(127);
        setWindowWidth(255);
      }
    } else {
      setErrors(failures.length ? failures : ['No readable image files were selected.']);
    }

    setProgress('');
    setLoading(false);
  };

  const handleUpload = (event) => {
    loadFiles(event.target.files);
    event.target.value = '';
  };

  const handleDragOver = (event) => event.preventDefault();
  const handleDrop = (event) => {
    event.preventDefault();
    loadFiles(event.dataTransfer.files);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const selectView = (view) => {
    setActiveView(view);
    setSliceIndex(0);
    resetView();
  };

  const startPan = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
  };
  const movePan = (event) => {
    if (dragRef.current) {
      setPan({ x: event.clientX - dragRef.current.x, y: event.clientY - dragRef.current.y });
    }
  };
  const endPan = () => { dragRef.current = null; };
  const handleWheel = (event) => {
    event.preventDefault();
    setZoom((current) => Math.max(0.5, Math.min(8, current * (event.deltaY < 0 ? 1.1 : 0.9))));
  };

  const applyPreset = (center, width) => {
    setWindowCenter(center);
    setWindowWidth(width);
  };

  return (
    <section className="ct-imaging-page">
      <header className="ct-page-header">
        <div>
          <div className="ct-page-eyebrow">PATIENT {patientId || '—'}</div>
          <h1>CT Imaging</h1>
          <p>Review image files locally. A single image is shown as a single slice, not as a 3D study.</p>
        </div>
        <button className="ct-upload-button" onClick={() => inputRef.current?.click()} disabled={loading}>
          <Upload size={17} /> Upload scan files
        </button>
        <input
          ref={inputRef}
          className="ct-file-input"
          type="file"
          multiple
          accept=".dcm,.dicom,application/dicom,image/*"
          onChange={handleUpload}
        />
      </header>

      <div className="ct-privacy-note">
        <AlertCircle size={17} />
        <span>Files are processed in this browser only; they are not uploaded or saved by the application. No findings are generated and no airway segmentation is applied.</span>
      </div>

      {errors.length > 0 && (
        <div className="ct-error-list" role="alert">
          {errors.map((error) => <div key={error}><AlertCircle size={15} /> {error}</div>)}
        </div>
      )}

      {!frames.length ? (
        <div className="ct-upload-empty" onDragOver={handleDragOver} onDrop={handleDrop}>
          <div className="ct-upload-icon"><FileImage size={26} /></div>
          <h2>{loading ? 'Loading image files' : 'Add CT scan files'}</h2>
          <p>{progress || 'Select a DICOM series or image files. Compatible DICOM slices with matching geometry can be viewed in three planes.'}</p>
          <button className="ct-secondary-button" onClick={() => inputRef.current?.click()} disabled={loading}>
            <Upload size={15} /> Choose files
          </button>
          <span className="ct-supported-formats">DICOM (.dcm, .dicom) · PNG · JPEG · WebP</span>
        </div>
      ) : (
        <div className="ct-viewer-card">
          <div className="ct-viewer-topbar">
            <div className="ct-study-description">
              <Layers size={18} />
              <div>
                <strong>{frames.length} {isDicom ? 'DICOM slice' : 'image'}{frames.length === 1 ? '' : 's'}</strong>
                <span>
                  {volume
                    ? `Compatible axial volume · ${frames[0].width} × ${frames[0].height} px`
                    : isDicom
                      ? 'DICOM images · multiplanar reconstruction unavailable for this selection'
                      : 'Standard image files · displayed as 2D slices; no CT volume metadata'}
                </span>
              </div>
            </div>
            <button className="ct-icon-button" onClick={() => inputRef.current?.click()} title="Replace scan files">
              <Upload size={16} /> Replace
            </button>
          </div>

          <div className="ct-viewer-layout">
            <div className="ct-main-viewer">
              <div className="ct-view-toolbar">
                <div className="ct-view-tabs">
                  {['axial', ...(volume ? ['coronal', 'sagittal'] : [])].map((view) => (
                    <button
                      key={view}
                      className={activeView === view ? 'active' : ''}
                      onClick={() => selectView(view)}
                    >
                      {view}
                    </button>
                  ))}
                </div>
                <div className="ct-zoom-controls">
                  <button className="ct-icon-button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} title="Zoom out"><Minus size={15} /></button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button className="ct-icon-button" onClick={() => setZoom((value) => Math.min(8, value + 0.25))} title="Zoom in"><Plus size={15} /></button>
                  <button className="ct-icon-button" onClick={resetView} title="Reset view"><RotateCcw size={15} /></button>
                  <Maximize2 size={14} className="ct-maximize-icon" />
                </div>
              </div>

              {plane && (
                <CTCanvas
                  frame={plane}
                  center={windowCenter}
                  width={windowWidth}
                  inverted={false}
                  zoom={zoom}
                  pan={pan}
                  onPanStart={startPan}
                  onPanMove={movePan}
                  onPanEnd={endPan}
                  onWheel={handleWheel}
                />
              )}

              <div className="ct-slice-controls">
                <div className="ct-slice-label">
                  <Scan size={15} />
                  <span>{activeView[0].toUpperCase() + activeView.slice(1)} slice <strong>{sliceIndex + 1}</strong> / {sliceCount}</span>
                </div>
                <input
                  aria-label={`${activeView} slice`}
                  type="range"
                  min="0"
                  max={Math.max(0, sliceCount - 1)}
                  value={Math.min(sliceIndex, Math.max(0, sliceCount - 1))}
                  onChange={(event) => { setSliceIndex(Number(event.target.value)); resetView(); }}
                  disabled={sliceCount < 2}
                />
                <div className="ct-slice-endpoints"><span>1</span><span>{sliceCount}</span></div>
              </div>
            </div>

            <aside className="ct-controls-panel">
              <h3>Display controls</h3>
              {isDicom && (
                <div className="ct-presets">
                  <button onClick={() => applyPreset(-600, 1500)}>Lung</button>
                  <button onClick={() => applyPreset(40, 400)}>Soft tissue</button>
                </div>
              )}
              {!isDicom && (
                <p className="ct-control-note">Standard image: controls adjust display brightness and contrast only. CT window values are not available.</p>
              )}
              <label className="ct-range-control">
                <span>{isDicom ? 'Window level' : 'Image level'} <strong>{Math.round(windowCenter)}</strong></span>
                <input
                  type="range"
                  min={isDicom ? '-1500' : '0'}
                  max={isDicom ? '1500' : '255'}
                  value={windowCenter}
                  onChange={(event) => setWindowCenter(Number(event.target.value))}
                />
              </label>
              <label className="ct-range-control">
                <span>{isDicom ? 'Window width' : 'Contrast range'} <strong>{Math.round(windowWidth)}</strong></span>
                <input
                  type="range"
                  min={isDicom ? '1' : '16'}
                  max={isDicom ? '3000' : '510'}
                  value={windowWidth}
                  onChange={(event) => setWindowWidth(Number(event.target.value))}
                />
              </label>
              <div className="ct-control-divider" />
              <div className="ct-file-details">
                <h3>Selected image</h3>
                <span>{plane?.fileName || 'Reconstructed view'}</span>
                <span>{plane?.width} × {plane?.height} px</span>
                {isDicom && (
                  <>
                    <span>Pixel type: {plane.pixelType.toUpperCase()}</span>
                    {plane.pixelSpacing && <span>Pixel spacing: {plane.pixelSpacing.join(' × ')} mm</span>}
                  </>
                )}
              </div>
              <p className="ct-control-note">Viewer controls support review only; this tool does not provide clinical interpretation.</p>
            </aside>
          </div>
        </div>
      )}
    </section>
  );
}
