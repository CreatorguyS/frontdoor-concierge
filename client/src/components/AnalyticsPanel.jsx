import './AnalyticsPanel.css';

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className={`stat-card card stat-card--${color}`}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__value" style={{ color: `var(--${color === 'orange' ? 'amazon' : color === 'blue' ? 'blue' : color === 'green' ? 'safe' : color === 'warn' ? 'warning' : 'danger'})` }}>
        {value}
      </div>
      <div className="stat-card__label">{label}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}

function CarrierChart({ carriers }) {
  const total = Object.values(carriers).reduce((a, b) => a + b, 0) || 1;
  const colors = {
    'Amazon Logistics': '#FF9900',
    'Amazon': '#FF9900',
    'UPS': '#8B5CF6',
    'FedEx': '#6366F1',
    'USPS': '#10B981',
    'DHL': '#F59E0B',
    'Unknown': '#64748B',
  };

  const entries = Object.entries(carriers).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return <div className="carriers__empty text-xs text-muted text-center p-3">No carrier data yet</div>;
  }

  return (
    <div className="carrier-chart">
      {entries.map(([name, count]) => (
        <div key={name} className="carrier-row">
          <div className="carrier-row__name text-xs">{name}</div>
          <div className="carrier-row__bar-wrap">
            <div
              className="carrier-row__bar"
              style={{
                width: `${(count / total) * 100}%`,
                background: colors[name] || '#64748B',
              }}
            />
          </div>
          <div className="carrier-row__count text-xs mono">{count}</div>
        </div>
      ))}
    </div>
  );
}

function HourlyChart({ data }) {
  if (!data || data.every(v => v === 0)) {
    return <div className="hourly__empty text-xs text-muted text-center p-3">No activity data yet</div>;
  }
  const max = Math.max(...data, 1);
  const now = new Date().getHours();

  return (
    <div className="hourly-chart">
      {data.map((val, h) => (
        <div
          key={h}
          className="hourly-bar"
          title={`${h}:00 — ${val} event${val !== 1 ? 's' : ''}`}
        >
          <div
            className="hourly-bar__fill"
            style={{
              height: `${Math.max((val / max) * 100, val > 0 ? 8 : 0)}%`,
              background: h === now ? 'var(--amazon)' : 'rgba(255,153,0,0.35)',
            }}
          />
          {h % 6 === 0 && <div className="hourly-bar__label">{h}h</div>}
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPanel({ stats }) {
  if (!stats) {
    return (
      <div className="analytics card">
        <div className="analytics__header">
          <span>📊</span>
          <span className="font-semi text-sm">Analytics</span>
        </div>
        <div className="analytics__loading">
          <div className="spinner" />
          <p className="text-xs text-muted">Loading stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics card">
      <div className="analytics__header">
        <div className="flex items-center gap-2">
          <span>📊</span>
          <span className="font-semi text-sm">Analytics Dashboard</span>
        </div>
        <span className="badge badge--muted text-xs">Today</span>
      </div>

      {/* Stat cards */}
      <div className="analytics__stats">
        <StatCard icon="📦" label="Deliveries" value={stats.deliveries} color="orange" />
        <StatCard icon="👁" label="Motion" value={stats.motionEvents} color="blue" />
        <StatCard icon="⚠️" label="High Risk" value={stats.highRiskAlerts} color="danger" />
        <StatCard icon="✅" label="Safe Drops" value={stats.packageSuccess} color="green" />
      </div>

      {/* Average risk */}
      <div className="analytics__metric p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted font-semi uppercase" style={{ letterSpacing: '0.05em' }}>Avg. Risk Score Today</span>
          <span className="font-bold" style={{ color: stats.avgRiskScore > 5 ? 'var(--danger)' : stats.avgRiskScore > 3 ? 'var(--warning)' : 'var(--safe)' }}>
            {stats.avgRiskScore}/10
          </span>
        </div>
        <div className="risk-bar">
          <div
            className="risk-bar__fill"
            style={{
              width: `${stats.avgRiskScore * 10}%`,
              background: stats.avgRiskScore > 5
                ? 'linear-gradient(90deg, #22c55e, #ef4444)'
                : 'linear-gradient(90deg, #22c55e, #f59e0b)',
            }}
          />
        </div>
      </div>

      {/* Carrier breakdown */}
      <div className="analytics__section">
        <div className="analytics__section-title">Carrier Breakdown</div>
        <CarrierChart carriers={stats.carriers || {}} />
      </div>

      {/* Hourly activity */}
      <div className="analytics__section">
        <div className="analytics__section-title">Hourly Activity (24h)</div>
        <HourlyChart data={stats.hourlyActivity || Array(24).fill(0)} />
      </div>
    </div>
  );
}
