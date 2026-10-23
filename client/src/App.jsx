import { useState, useCallback, useEffect } from 'react';
import './index.css';
import './App.css';
import { useWebSocket } from './hooks/useWebSocket.js';
import Header from './components/Header.jsx';
import LiveFeedPanel from './components/LiveFeedPanel.jsx';
import AIAnalysisModal from './components/AIAnalysisModal.jsx';
import ParcelTimeline from './components/ParcelTimeline.jsx';
import AnalyticsPanel from './components/AnalyticsPanel.jsx';
import DemoControls from './components/DemoControls.jsx';
import AlexaSimulator from './components/AlexaSimulator.jsx';

export default function App() {
  const {
    events,
    stats,
    activeEvent,
    ringMode,
    connected,
    sirenActive,
    unlockedEvent,
    triggerEvent,
    silenceSiren,
    clearHistory,
    dismissActiveEvent,
  } = useWebSocket();

  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'alexa' | 'split'
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [triggering, setTriggering] = useState(false);

  // Show latest active event in modal automatically (only in dashboard view)
  useEffect(() => {
    if (activeEvent && activeView !== 'alexa') {
      setSelectedEvent(activeEvent);
    }
  }, [activeEvent?.id, activeView]);

  // Update selected event when it gets AI analysis
  useEffect(() => {
    if (selectedEvent) {
      const updated = events.find(e => e.id === selectedEvent.id);
      if (updated && updated !== selectedEvent) {
        setSelectedEvent(updated);
      }
    }
  }, [events, selectedEvent?.id]);

  const handleTrigger = useCallback(async (type) => {
    setTriggering(true);
    await triggerEvent(type);
    setTimeout(() => setTriggering(false), 1200);
  }, [triggerEvent]);

  const handleCloseModal = useCallback(() => {
    setSelectedEvent(null);
    dismissActiveEvent();
  }, [dismissActiveEvent]);

  const handleEventClick = useCallback((event) => {
    setSelectedEvent(event);
  }, []);

  return (
    <div className="app">
      <Header
        connected={connected}
        ringMode={ringMode}
        eventCount={events.length}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {/* VIEW 1: PORCH GUARDIAN DASHBOARD */}
      {activeView === 'dashboard' && (
        <main className="app__main">
          {/* Left Column: Feed + Demo Controls */}
          <div className="app__col app__col--left">
            <LiveFeedPanel 
              latestEvent={activeEvent || events[0]} 
              sirenActive={sirenActive}
              onSilenceSiren={silenceSiren}
              unlockedEvent={unlockedEvent}
            />
            <DemoControls onTrigger={handleTrigger} disabled={triggering || !connected} />
          </div>

          {/* Center Column: Timeline */}
          <div className="app__col app__col--center">
            <ParcelTimeline
              events={events}
              onEventClick={handleEventClick}
              onClear={clearHistory}
            />
          </div>

          {/* Right Column: Analytics + MCP Hub */}
          <div className="app__col app__col--right">
            <div className="mcp-quick-banner card" onClick={() => setActiveView('alexa')}>
              <div className="mcp-quick-banner__title">
                <span>🤖 Alexa+ MCP Server</span>
                <span className="badge badge--cyan">Active</span>
              </div>
              <p className="mcp-quick-banner__desc">
                Streamable HTTP · JSON-RPC 2.0 · 6 Tools
              </p>
              <button className="btn btn--secondary btn--sm w-full mt-2">
                Open Alexa+ Voice Console ➔
              </button>
            </div>
            <AnalyticsPanel stats={stats} />
            <ArchBadge />
          </div>
        </main>
      )}

      {/* VIEW 2: FOCUSED ALEXA+ MCP CONSOLE */}
      {activeView === 'alexa' && (
        <main className="app__main app__main--alexa">
          <div className="alexa-container">
            <AlexaSimulator onEventTriggered={handleTrigger} />
          </div>
        </main>
      )}

      {/* VIEW 3: SPLIT PANORAMIC VIEW */}
      {activeView === 'split' && (
        <main className="app__main app__main--split">
          <div className="split-col split-col--left">
            <LiveFeedPanel 
              latestEvent={activeEvent || events[0]} 
              sirenActive={sirenActive}
              onSilenceSiren={silenceSiren}
              unlockedEvent={unlockedEvent}
            />
            <DemoControls onTrigger={handleTrigger} disabled={triggering || !connected} />
            <ParcelTimeline
              events={events}
              onEventClick={handleEventClick}
              onClear={clearHistory}
            />
          </div>
          <div className="split-col split-col--right">
            <AlexaSimulator onEventTriggered={handleTrigger} />
            <AnalyticsPanel stats={stats} />
          </div>
        </main>
      )}

      {/* AI Analysis Modal */}
      {selectedEvent && (
        <AIAnalysisModal
          event={selectedEvent}
          onDismiss={handleCloseModal}
        />
      )}

      {/* Connection overlay */}
      {!connected && (
        <div className="app__disconnected">
          <div className="spinner" />
          <span>Reconnecting to server...</span>
        </div>
      )}
    </div>
  );
}

function ArchBadge() {
  return (
    <div className="arch-badge card">
      <div className="arch-badge__title">🏗 Architecture & Multi-Track</div>
      <div className="arch-badge__stack">
        <div className="arch-item">
          <span className="arch-item__dot" style={{ background: '#00B4A0' }} />
          <span className="text-xs">Ring SDK → Event Stream</span>
        </div>
        <div className="arch-item">
          <span className="arch-item__dot" style={{ background: '#00caff' }} />
          <span className="text-xs">Alexa+ MCP → Streamable HTTP (2025-11-25)</span>
        </div>
        <div className="arch-item">
          <span className="arch-item__dot" style={{ background: '#FF9900' }} />
          <span className="text-xs">Amazon Bedrock → Claude 3.5 Vision</span>
        </div>
        <div className="arch-item">
          <span className="arch-item__dot" style={{ background: '#8B5CF6' }} />
          <span className="text-xs">Web Speech API → Doorbell TTS</span>
        </div>
      </div>
      <div className="divider mt-2 mb-2" />
      <div className="flex gap-2 flex-wrap">
        <span className="badge badge--orange text-xs">Ring Track</span>
        <span className="badge badge--cyan text-xs">Alexa+ Track</span>
        <span className="badge badge--blue text-xs">AWS Builder</span>
        <span className="badge badge--safe text-xs">Open Source</span>
      </div>
    </div>
  );
}
