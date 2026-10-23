import { useState, useEffect } from 'react';
import './LiveFeedPanel.css';

const SNAPSHOT_IMAGES = {
  delivery:      '/snapshots/delivery.jpg',
  motion:        '/snapshots/motion.jpg',
  threat:        '/snapshots/threat.jpg',
  person:        '/snapshots/person.jpg',
  package_left:  '/snapshots/motion.jpg',
};

const CAMERAS = [
  { id: 'cam-front-door', name: 'Front Door Camera', device: 'Ring Pro 2', defaultSnapshot: 'delivery' },
  { id: 'cam-parcel-box', name: 'Porch Delivery Lockbox', device: 'Stick Up Cam', defaultSnapshot: 'motion' },
  { id: 'cam-driveway',   name: 'Driveway & Perimeter', device: 'Floodlight Pro', defaultSnapshot: 'threat' },
];

const EVENT_ICONS = {
  doorbell_pressed:  '🔔',
  motion_detected:   '👁',
  package_detected:  '📦',
  person_detected:   '🧍',
  threat_detected:   '⚠️',
};

export default function LiveFeedPanel({ latestEvent, sirenActive, onSilenceSiren, unlockedEvent }) {
  const [scanVisible, setScanVisible] = useState(false);
  const [shakeActive, setShakeActive] = useState(false);
  const [selectedCam, setSelectedCam] = useState('cam-front-door');
  const [nightVision, setNightVision] = useState(false);
  const [fps] = useState(30.0);

  useEffect(() => {
    if (latestEvent) {
      setScanVisible(true);
      if (latestEvent.type === 'threat_detected') {
        setShakeActive(true);
        setTimeout(() => setShakeActive(false), 800);
      }
      const t = setTimeout(() => setScanVisible(false), 2200);
      return () => clearTimeout(t);
    }
  }, [latestEvent?.id]);

  const activeCam = CAMERAS.find(c => c.id === selectedCam) || CAMERAS[0];
  const snapshotKey = selectedCam === 'cam-front-door' 
    ? (latestEvent?.snapshot || 'delivery') 
    : activeCam.defaultSnapshot;
  const imgSrc = SNAPSHOT_IMAGES[snapshotKey] || SNAPSHOT_IMAGES.motion;
  const isThreat = latestEvent?.type === 'threat_detected' || sirenActive;
  const isAnalyzing = latestEvent?.status === 'analyzing';

  const handleDownloadSnapshot = () => {
    const a = document.createElement('a');
    a.href = imgSrc;
    a.download = `ring_snapshot_${Date.now()}.jpg`;
    a.click();
  };

  return (
    <div className={`live-feed card ${isThreat ? 'live-feed--threat card--danger' : ''} ${shakeActive ? 'live-feed--shake' : ''}`}>
      {/* Camera Header with Selector */}
      <div className="live-feed__header">
        <div className="flex items-center gap-2">
          <span className="live-feed__icon">📷</span>
          <select 
            className="cam-selector"
            value={selectedCam}
            onChange={(e) => setSelectedCam(e.target.value)}
          >
            {CAMERAS.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.device})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="live-badge"><span className="live-dot" />LIVE</div>
          <button 
            className={`nv-toggle-btn ${nightVision ? 'nv-toggle-btn--on' : ''}`}
            onClick={() => setNightVision(!nightVision)}
            title="Toggle Infrared Night Vision Filter"
          >
            {nightVision ? '🌙 IR ON' : '☀️ Day'}
          </button>
        </div>
      </div>

      {/* Camera Feed Viewport */}
      <div className="live-feed__viewport">
        <img
          src={imgSrc}
          alt="Ring camera snapshot"
          className={`live-feed__image ${nightVision ? 'live-feed__image--nv' : ''}`}
          onError={e => { e.target.src = '/snapshots/motion.jpg'; }}
        />

        {/* Scan line animation on new event */}
        {scanVisible && <div className="live-feed__scan-line" />}

        {/* Nightvision overlay */}
        {nightVision && <div className="live-feed__nv-overlay" />}

        {/* Threat overlay */}
        {isThreat && <div className="live-feed__threat-overlay" />}

        {/* Active Smart Lock Unlock Banner */}
        {unlockedEvent && (
          <div className="live-feed__unlock-banner">
            <span className="unlock-icon">🔓</span>
            <div>
              <strong>COMPARTMENT UNLOCKED:</strong> {unlockedEvent.recipient || 'Courier'} (PIN {unlockedEvent.pin})
            </div>
          </div>
        )}

        {/* Active Siren Banner */}
        {sirenActive && (
          <div className="live-feed__siren-banner">
            <div className="flex items-center gap-2">
              <span className="siren-dot" />
              <strong>SIREN 90dB ACTIVE</strong>
            </div>
            {onSilenceSiren && (
              <button className="siren-silence-btn" onClick={onSilenceSiren}>
                Silence Siren ✕
              </button>
            )}
          </div>
        )}

        {/* Analyzing indicator */}
        {isAnalyzing && (
          <div className="live-feed__analyzing">
            <div className="spinner spinner--sm" />
            <span>Bedrock AI Analyzing...</span>
          </div>
        )}

        {/* Event type badge overlay */}
        {latestEvent && (
          <div className="live-feed__event-badge">
            <span>{EVENT_ICONS[latestEvent.type] || '📷'}</span>
            <span>{latestEvent.type.replace(/_/g, ' ').toUpperCase()}</span>
          </div>
        )}

        {/* Timestamp & FPS Telemetry */}
        <div className="live-feed__timestamp">
          <span>{new Date().toLocaleTimeString()}</span>
          <span className="fps-badge">· {fps.toFixed(1)} FPS · 1080p</span>
        </div>

        {/* Risk score overlay */}
        {latestEvent?.aiAnalysis?.riskScore !== undefined && (
          <div className={`live-feed__risk-overlay ${getRiskClass(latestEvent.aiAnalysis.riskScore)}`}>
            RISK {latestEvent.aiAnalysis.riskScore}/10
          </div>
        )}

        {/* Corner brackets (security cam UX) */}
        <div className="live-feed__corner live-feed__corner--tl" />
        <div className="live-feed__corner live-feed__corner--tr" />
        <div className="live-feed__corner live-feed__corner--bl" />
        <div className="live-feed__corner live-feed__corner--br" />

        {/* Floating Quick Action: Download Snapshot */}
        <button 
          className="live-feed__snap-btn"
          onClick={handleDownloadSnapshot}
          title="Download snapshot evidence frame"
        >
          💾 Save Frame
        </button>
      </div>

      {/* Bottom info bar */}
      <div className="live-feed__infobar">
        <div className="live-feed__infobar-item">
          <span className="live-feed__infobar-label">Carrier</span>
          <span className="live-feed__infobar-value">
            {latestEvent?.aiAnalysis?.carrierName || 'Monitoring'}
          </span>
        </div>
        <div className="live-feed__infobar-item">
          <span className="live-feed__infobar-label">Intent</span>
          <span className="live-feed__infobar-value capitalize">
            {latestEvent?.aiAnalysis?.visitorIntent?.replace(/_/g, ' ') || 'Secure'}
          </span>
        </div>
        <div className="live-feed__infobar-item">
          <span className="live-feed__infobar-label">Signal</span>
          <span className="live-feed__infobar-value text-safe">
            -42 dBm (Excellent)
          </span>
        </div>
        <div className="live-feed__infobar-item">
          <span className="live-feed__infobar-label">Confidence</span>
          <span className="live-feed__infobar-value">
            {latestEvent?.aiAnalysis?.confidence ? `${latestEvent.aiAnalysis.confidence}%` : '98%'}
          </span>
        </div>
      </div>
    </div>
  );
}

function getRiskClass(score) {
  if (score <= 2) return 'risk-safe';
  if (score <= 5) return 'risk-warn';
  if (score <= 7) return 'risk-high';
  return 'risk-critical';
}
