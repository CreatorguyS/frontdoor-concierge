import { useState, useEffect } from 'react';
import './Header.css';

export default function Header({ connected, ringMode, eventCount, activeView = 'dashboard', onViewChange }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="header">
      <div className="header__left">
        <div className="header__logo">
          <div className="header__logo-icon">🏠</div>
          <div>
            <div className="header__logo-title">FrontDoor Concierge</div>
            <div className="header__logo-sub">AI-Powered Ring Guardian · Alexa+ MCP</div>
          </div>
        </div>

        <div className="header__badges">
          <div className={`ring-badge ${ringMode === 'live' ? 'ring-badge--live' : 'ring-badge--sim'}`}>
            <span className="ring-badge__dot" />
            {ringMode === 'live' ? 'Ring Live' : 'Ring Simulator'}
          </div>
          <div className="mcp-badge">
            <span className="mcp-badge__dot" />
            MCP 2025-11-25
          </div>
          <div className={`conn-badge ${connected ? 'conn-badge--on' : 'conn-badge--off'}`}>
            {connected ? '⚡ Online' : '⏳ Reconnecting...'}
          </div>
        </div>
      </div>

      <div className="header__center">
        <nav className="header__nav">
          <button
            className={`nav-tab ${activeView === 'dashboard' ? 'nav-tab--active' : ''}`}
            onClick={() => onViewChange?.('dashboard')}
            id="tab-guardian-dashboard"
          >
            🛡️ Porch Guardian
          </button>
          <button
            className={`nav-tab ${activeView === 'alexa' ? 'nav-tab--active' : ''}`}
            onClick={() => onViewChange?.('alexa')}
            id="tab-alexa-mcp"
          >
            🗣️ Alexa+ MCP Agent
          </button>
          <button
            className={`nav-tab ${activeView === 'split' ? 'nav-tab--active' : ''}`}
            onClick={() => onViewChange?.('split')}
            id="tab-split-view"
          >
            🔀 Split View
          </button>
        </nav>
      </div>

      <div className="header__right">
        <div className="header__powered">
          <span className="header__powered-label">Stack:</span>
          <span className="header__powered-brand">Bedrock</span>
          <span className="header__powered-sep">+</span>
          <span className="header__powered-ring">Ring</span>
          <span className="header__powered-sep">+</span>
          <span className="header__powered-alexa">Alexa+ MCP</span>
        </div>

        <div className="header__stat">
          <span className="header__stat-value">{eventCount}</span>
          <span className="header__stat-label">Events</span>
        </div>

        <div className="header__clock">
          <div className="header__clock-time">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="header__clock-date">
            {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>
    </header>
  );
}
