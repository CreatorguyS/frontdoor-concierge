import './ParcelTimeline.css';

const EVENT_CONFIG = {
  doorbell_pressed:  { icon: '🔔', label: 'Doorbell',  color: 'orange' },
  motion_detected:   { icon: '👁',  label: 'Motion',    color: 'blue' },
  package_detected:  { icon: '📦', label: 'Package',   color: 'green' },
  person_detected:   { icon: '🧍', label: 'Person',    color: 'warn' },
  threat_detected:   { icon: '🚨', label: 'THREAT',    color: 'danger' },
};

function RiskBadge({ score }) {
  if (score === undefined || score === null) return <span className="badge badge--muted text-xs">—</span>;
  if (score <= 2)  return <span className="badge badge--safe text-xs">Safe {score}/10</span>;
  if (score <= 5)  return <span className="badge badge--warning text-xs">Moderate {score}/10</span>;
  if (score <= 7)  return <span className="badge badge--danger text-xs">High {score}/10</span>;
  return <span className="badge badge--critical text-xs">CRITICAL {score}/10</span>;
}

function TimelineCard({ event, onClick }) {
  const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.motion_detected;
  const isAnalyzing = event.status === 'analyzing';
  const isThreat = event.type === 'threat_detected';

  return (
    <div
      className={`timeline-card anim-fade-up ${isThreat ? 'timeline-card--threat' : ''}`}
      onClick={() => onClick(event)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(event)}
      id={`event-card-${event.id}`}
    >
      {/* Left accent bar */}
      <div className={`timeline-card__bar timeline-card__bar--${cfg.color}`} />

      {/* Icon */}
      <div className={`timeline-card__icon-wrap timeline-card__icon-wrap--${cfg.color}`}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="timeline-card__body">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semi text-sm">{cfg.label}</span>
          {event.aiAnalysis?.carrierName && event.aiAnalysis.carrierName !== 'null' && (
            <span className="badge badge--orange text-xs">{event.aiAnalysis.carrierName}</span>
          )}
          {isAnalyzing && <span className="badge badge--blue text-xs">⏳ Analyzing</span>}
        </div>

        <div className="timeline-card__meta">
          <span className="text-xs text-muted mono">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
          <span className="text-xs text-muted">•</span>
          <span className="text-xs text-muted">{event.zone}</span>
          {event.aiAnalysis?.packageSize && (
            <>
              <span className="text-xs text-muted">•</span>
              <span className="text-xs text-muted capitalize">{event.aiAnalysis.packageSize} pkg</span>
            </>
          )}
        </div>

        {event.aiAnalysis?.alertSummary && !isAnalyzing && (
          <p className="timeline-card__summary">
            {event.aiAnalysis.alertSummary}
          </p>
        )}
      </div>

      {/* Risk badge */}
      <div className="timeline-card__risk">
        <RiskBadge score={event.aiAnalysis?.riskScore} />
        {event.source === 'ring_live' && (
          <span className="badge badge--danger text-xs mt-1">🔴 Live</span>
        )}
      </div>
    </div>
  );
}

export default function ParcelTimeline({ events, onEventClick, onClear }) {
  const deliveries  = events.filter(e => ['doorbell_pressed', 'package_detected'].includes(e.type));
  const alerts      = events.filter(e => e.aiAnalysis?.riskScore >= 6);

  return (
    <div className="timeline card">
      <div className="timeline__header">
        <div className="flex items-center gap-3">
          <span>📋</span>
          <span className="font-semi text-sm">Event Timeline</span>
          <span className="badge badge--muted text-xs">{events.length} events</span>
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <span className="badge badge--danger text-xs">⚠ {alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
          )}
          {events.length > 0 && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={onClear}
              id="clear-timeline-btn"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="timeline__body">
        {events.length === 0 ? (
          <div className="timeline__empty">
            <span className="timeline__empty-icon">📭</span>
            <p className="font-semi text-sm">No events yet</p>
            <p className="text-xs text-muted mt-1">Events will appear here as Ring detects activity</p>
          </div>
        ) : (
          events.map(event => (
            <TimelineCard key={event.id} event={event} onClick={onEventClick} />
          ))
        )}
      </div>
    </div>
  );
}
