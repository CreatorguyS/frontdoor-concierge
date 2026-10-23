import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  playDoorbellChime, 
  playSirenAlarm, 
  stopSirenAlarm, 
  playUnlockSuccess 
} from '../utils/audioEffects.js';

const WS_URL = `ws://localhost:3001`;

export function useWebSocket() {
  const [events, setEvents]           = useState([]);
  const [stats, setStats]             = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [ringMode, setRingMode]       = useState('simulator');
  const [connected, setConnected]     = useState(false);
  const [sirenActive, setSirenActive] = useState(false);
  const [unlockedEvent, setUnlockedEvent] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('[WS] Connected to FrontDoor Concierge');
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'HISTORY':
            setEvents(msg.events || []);
            setStats(msg.stats || null);
            setRingMode(msg.ringMode || 'simulator');
            break;

          case 'EVENT_NEW':
            setEvents(prev => [msg.event, ...prev]);
            setActiveEvent(msg.event);

            // Play realistic synthesized chimes
            if (msg.event.type === 'doorbell_pressed') {
              playDoorbellChime();
            } else if (msg.event.type === 'threat_detected') {
              playSirenAlarm(8);
              setSirenActive(true);
              setTimeout(() => setSirenActive(false), 8000);
            }

            // Speak greeting if available
            if (msg.event.aiAnalysis?.greetingInstruction) {
              speakGreeting(msg.event.aiAnalysis.greetingInstruction);
            }
            break;

          case 'EVENT_UPDATED':
            setEvents(prev => prev.map(e =>
              e.id === msg.event.id ? msg.event : e
            ));
            setActiveEvent(prev => prev?.id === msg.event.id ? msg.event : prev);
            break;

          case 'HISTORY_CLEARED':
            setEvents([]);
            setActiveEvent(null);
            break;

          case 'THREAT_ESCALATED':
            setSirenActive(true);
            playSirenAlarm(msg.sirenDurationSeconds || 8);
            setTimeout(() => setSirenActive(false), (msg.sirenDurationSeconds || 8) * 1000);
            break;

          case 'SIREN_SILENCED':
            setSirenActive(false);
            stopSirenAlarm();
            break;

          case 'COMPARTMENT_UNLOCKED':
            playUnlockSuccess();
            setUnlockedEvent(msg);
            setTimeout(() => setUnlockedEvent(null), 6000);
            break;
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('[WS] Disconnected, reconnecting in 3s...');
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const triggerEvent = useCallback(async (type) => {
    try {
      const res = await fetch('/api/events/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const silenceSiren = useCallback(async () => {
    try {
      await fetch('/api/siren/stop', { method: 'POST' });
      setSirenActive(false);
      stopSirenAlarm();
    } catch {}
  }, []);

  const clearHistory = useCallback(async () => {
    await fetch('/api/events', { method: 'DELETE' });
  }, []);

  const dismissActiveEvent = useCallback(() => {
    setActiveEvent(null);
  }, []);

  return {
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
  };
}

// ─── Web Speech API TTS ────────────────────────────────────
function speakGreeting(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate  = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google US English') || v.lang === 'en-US');
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}
