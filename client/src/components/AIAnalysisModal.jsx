import { useEffect, useRef } from 'react';
import './AIAnalysisModal.css';

const CARRIER_EMOJIS = {
  'Amazon Logistics': '📦',
  'Amazon': '📦',
  'UPS': '🟫',
  'FedEx': '🟣',
  'USPS': '🦅',
  'DHL': '🟡',
  'Unknown': '❓',
};

const INTENT_LABELS = {
  delivery:        { label: 'Delivery', color: 'safe', icon: '✅' },
  pickup:          { label: 'Pickup', color: 'blue', icon: '🔄' },
  known_guest:     { label: 'Known Guest', color: 'safe', icon: '👋' },
  solicitor:       { label: 'Solicitor', color: 'warning', icon: '🗣' },
  unknown_visitor: { label: 'Unknown Visitor', color: 'warning', icon: '❓' },
  suspicious:      { label: 'Suspicious', color: 'danger', icon: '⚠️' },
  motion_only:     { label: 'Motion Only', color: 'muted', icon: '👁' },
};

export default function AIAnalysisModal({ event, onDismiss }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  if (!event) return null;

  const analysis = event.aiAnalysis;
  const isAnalyzing = event.status === 'analyzing';
  const isThreat = analysis?.riskScore >= 7;
  const intentInfo = INTENT_LABELS[analysis?.visitorIntent] || INTENT_LABELS.unknown_visitor;

  function getRiskColor(score) {
    if (score <= 2) return '#22c55e';
    if (score <= 4) return '#a3e635';
    if (score <= 6) return '#f59e0b';
    if (score <= 8) return '#ef4444';
    return '#ff1744';
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onDismiss()}>
      <div
        ref={modalRef}
        className={`modal card anim-fade-up ${isThreat ? 'modal--threat card--danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="AI Analysis Result"
      >
        {/* Header */}
        <div className="modal__header">
          <div className="flex items-center gap-3">
            <div className="modal__bedrock-badge">
              <span>🤖</span>
              <span>Amazon Bedrock</span>
              <span className="text-muted text-xs">Claude 3.5 Sonnet</span>
            </div>
            <div className={`badge badge--${isAnalyzing ? 'orange' : 'blue'}`}>
              {isAnalyzing ? '⏳ Analyzing...' : `${analysis?.confidence}% confidence`}
            </div>
          </div>
          <button className="modal__close btn btn--secondary btn--sm" onClick={onDismiss} id="close-analysis-modal">✕</button>
        </div>

        {/* Threat Banner */}
        {isThreat && (
          <div className="modal__threat-banner">
            <span className="modal__threat-icon">🚨</span>
            <div>
              <div className="font-bold text-danger">HIGH RISK ALERT</div>
              <div className="text-xs text-danger" style={{ opacity: 0.8 }}>Suspicious activity detected at front door</div>
            </div>
          </div>
        )}

        {/* Event Summary Row */}
        <div className="modal__summary">
          <div className="modal__summary-item">
            <div className="modal__summary-label">Event</div>
            <div className="modal__summary-value">
              {event.type.replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
          <div className="modal__summary-item">
            <div className="modal__summary-label">Time</div>
            <div className="modal__summary-value mono">
              {new Date(event.timestamp).toLocaleTimeString()}
            </div>
          </div>
          <div className="modal__summary-item">
            <div className="modal__summary-label">Zone</div>
            <div className="modal__summary-value">{event.zone}</div>
          </div>
          <div className="modal__summary-item">
            <div className="modal__summary-label">Source</div>
            <div className="modal__summary-value" style={{ color: event.source === 'ring_live' ? 'var(--danger)' : 'var(--amazon)' }}>
              {event.source === 'ring_live' ? '🔴 Live' : '🔄 Simulator'}
            </div>
          </div>
        </div>

        {isAnalyzing ? (
          <div className="modal__loading">
            <div className="modal__loading-ring">
              <div className="spinner spinner--lg" />
            </div>
            <p className="font-semi">Amazon Bedrock is analyzing the snapshot...</p>
            <p className="text-sm text-muted">Claude 3.5 Sonnet Vision is running carrier detection and risk assessment</p>
          </div>
        ) : (
          <>
            {/* Risk Score */}
            <div className="modal__risk">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semi text-sm">Risk Assessment</span>
                <span className="font-black text-lg" style={{ color: getRiskColor(analysis?.riskScore || 0) }}>
                  {analysis?.riskScore}/10
                </span>
              </div>
              <div className="risk-bar">
                <div
                  className="risk-bar__fill"
                  style={{
                    width: `${(analysis?.riskScore || 0) * 10}%`,
                    background: `linear-gradient(90deg, ${getRiskColor(0)}, ${getRiskColor(analysis?.riskScore || 0)})`,
                  }}
                />
              </div>
              <div className="modal__risk-labels">
                <span className="text-xs text-safe">Safe</span>
                <span className="text-xs text-warn">Moderate</span>
                <span className="text-xs text-danger">High Risk</span>
              </div>
            </div>

            {/* AI Findings Grid */}
            <div className="modal__findings">
              <div className="modal__finding-card">
                <div className="modal__finding-icon">
                  {CARRIER_EMOJIS[analysis?.carrierName] || '❓'}
                </div>
                <div>
                  <div className="modal__finding-label">Carrier Detected</div>
                  <div className="modal__finding-value">{analysis?.carrierName || 'None'}</div>
                  {analysis?.carrierConfidence > 0 && (
                    <div className="text-xs text-muted">{analysis.carrierConfidence}% confidence</div>
                  )}
                </div>
              </div>

              <div className="modal__finding-card">
                <div className="modal__finding-icon">{intentInfo.icon}</div>
                <div>
                  <div className="modal__finding-label">Visitor Intent</div>
                  <div className={`modal__finding-value text-${intentInfo.color}`}>{intentInfo.label}</div>
                </div>
              </div>

              <div className="modal__finding-card">
                <div className="modal__finding-icon">📏</div>
                <div>
                  <div className="modal__finding-label">Package Size</div>
                  <div className="modal__finding-value capitalize">
                    {analysis?.packageSize || 'None detected'}
                  </div>
                  {analysis?.packageCount > 0 && (
                    <div className="text-xs text-muted">{analysis.packageCount} package(s)</div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Alert Summary */}
            <div className="modal__alert-summary">
              <div className="modal__alert-summary-label">
                <span>🧠</span> AI Alert Summary
              </div>
              <p className="modal__alert-summary-text">{analysis?.alertSummary}</p>
            </div>

            {/* Greeting Instruction */}
            {analysis?.greetingInstruction && (
              <div className="modal__greeting">
                <div className="modal__greeting-label">
                  <span>🔊</span> Spoken Greeting Delivered
                </div>
                <blockquote className="modal__greeting-text">
                  "{analysis.greetingInstruction}"
                </blockquote>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="modal__footer">
          <div className="text-xs text-muted">
            {event.status === 'fallback' ? '⚡ Using fallback analysis (Bedrock unavailable)' :
             event.status === 'analyzed' ? '✅ Analyzed by Amazon Bedrock Claude 3.5 Sonnet' :
             '⏳ Analysis in progress...'}
          </div>
          <button className="btn btn--secondary btn--sm" onClick={onDismiss} id="dismiss-analysis-btn">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
