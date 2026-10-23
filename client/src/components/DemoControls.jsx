import './DemoControls.css';

const BUTTONS = [
  { type: 'doorbell_pressed', label: 'Ring Doorbell', icon: '🔔', color: 'orange', desc: 'Delivery at door' },
  { type: 'motion_detected',  label: 'Motion Alert', icon: '👁',  color: 'blue',   desc: 'Movement detected' },
  { type: 'package_detected', label: 'Package Drop', icon: '📦', color: 'green',  desc: 'Package left on porch' },
  { type: 'person_detected',  label: 'Person Seen',  icon: '🧍', color: 'warn',   desc: 'Unknown visitor' },
  { type: 'threat_detected',  label: '⚠ Threat!',   icon: '🚨', color: 'danger', desc: 'Suspicious activity' },
];

export default function DemoControls({ onTrigger, disabled }) {
  return (
    <div className="demo-controls card">
      <div className="demo-controls__header">
        <div className="flex items-center gap-2">
          <span>🎮</span>
          <span className="font-semi text-sm">Demo Control Panel</span>
        </div>
        <div className="badge badge--muted text-xs">Ring Simulator</div>
      </div>

      <div className="demo-controls__desc text-xs text-muted p-3">
        Manually trigger Ring events to see the AI pipeline in action. Each button fires a realistic Ring doorbell event that gets analyzed by Amazon Bedrock.
      </div>

      <div className="demo-controls__grid">
        {BUTTONS.map(btn => (
          <button
            key={btn.type}
            id={`trigger-${btn.type}`}
            className={`demo-btn demo-btn--${btn.color}`}
            onClick={() => onTrigger(btn.type)}
            disabled={disabled}
            title={btn.desc}
          >
            <span className="demo-btn__icon">{btn.icon}</span>
            <span className="demo-btn__label">{btn.label}</span>
            <span className="demo-btn__desc">{btn.desc}</span>
          </button>
        ))}
      </div>

      <div className="demo-controls__footer">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>⚡</span>
          <span>Auto-simulator fires every 25s in background</span>
        </div>
      </div>
    </div>
  );
}
