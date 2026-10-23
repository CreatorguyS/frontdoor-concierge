import { useState, useEffect, useRef } from 'react';
import './AlexaSimulator.css';
import { 
  playUnlockSuccess, 
  playAccessDenied, 
  playAlexaChime 
} from '../utils/audioEffects.js';

const QUICK_PROMPTS = [
  { text: 'Alexa, who is at the front door?', icon: '🚪', desc: 'Check camera & threats' },
  { text: 'Alexa, was my Amazon package delivered?', icon: '📦', desc: 'Inspect courier drop-off' },
  { text: 'Alexa, generate a PIN for the UPS driver', icon: '🔑', desc: '1-time smart lock PIN' },
  { text: 'Alexa, tell the courier to leave the package behind the planter', icon: '🗣️', desc: 'Two-way speaker broadcast' },
  { text: 'Alexa, sound the front porch siren', icon: '🚨', desc: 'Threat escalation protocol' },
  { text: 'Alexa, how many deliveries arrived today?', icon: '📊', desc: 'Query daily metrics' },
];

export default function AlexaSimulator({ onEventTriggered }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [interactions, setInteractions] = useState([]);
  const [mcpTools, setMcpTools] = useState([]);
  const [expandedTrace, setExpandedTrace] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'tools' | 'pins'
  const [activePins, setActivePins] = useState([]);
  const [activePinRecipient, setActivePinRecipient] = useState('Amazon Logistics');
  const [pinDuration, setPinDuration] = useState(15);
  const [generatingPin, setGeneratingPin] = useState(false);
  const [sirenActive, setSirenActive] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Virtual Keypad State
  const [keypadInput, setKeypadInput] = useState('');
  const [keypadStatus, setKeypadStatus] = useState('idle'); // 'idle' | 'verifying' | 'unlocked' | 'denied'
  const [keypadFeedback, setKeypadFeedback] = useState('');

  const chatBottomRef = useRef(null);
  const recognitionRef = useRef(null);

  // Fetch registered MCP tools & existing PINs on mount
  useEffect(() => {
    fetch('/api/alexa/tools')
      .then(r => r.json())
      .then(data => {
        if (data.tools) setMcpTools(data.tools);
      })
      .catch(() => {});

    fetch('/api/lock/pins')
      .then(r => r.json())
      .then(data => {
        if (data.active) setActivePins(data.active);
      })
      .catch(() => {});
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interactions]);

  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome/Edge or click the quick prompt pills.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      playAlexaChime();
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (e) => {
        const transcript = e.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput(transcript);
          handleSend(transcript);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const handleSend = async (utteranceToSend) => {
    const utterance = utteranceToSend || input;
    if (!utterance.trim() || loading) return;

    setLoading(true);
    setInput('');

    try {
      const res = await fetch('/api/alexa/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance }),
      });

      const data = await res.json();
      if (data.success) {
        setInteractions(prev => [...prev, data]);
        setExpandedTrace(data.mcpRequest?.id);

        // If a PIN was generated, update active PINs
        if (data.mcpResponse?.result?.structured?.pin) {
          const pinData = data.mcpResponse.result.structured;
          setActivePins(prev => [pinData, ...prev.filter(p => p.pin !== pinData.pin)]);
        }

        // If siren was triggered
        if (data.mcpResponse?.result?.structured?.sirenActive) {
          setSirenActive(true);
          setTimeout(() => setSirenActive(false), 8000);
        }

        // Speak response if TTS enabled
        if (ttsEnabled && data.spokenResponse) {
          speakAlexa(data.spokenResponse);
        }
      }
    } catch (err) {
      console.error('Alexa simulation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectToolCall = async (toolName, toolArgs = {}) => {
    setLoading(true);
    try {
      const res = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name: toolName, arguments: toolArgs },
        }),
      });

      const data = await res.json();
      const syntheticInteraction = {
        utterance: `[Direct MCP Call] ${toolName}()`,
        intentReasoning: `Direct execution via MCP JSON-RPC 2.0 (Streamable HTTP).`,
        mcpRequest: { jsonrpc: '2.0', id: data.id, method: 'tools/call', params: { name: toolName, arguments: toolArgs } },
        mcpResponse: data,
        spokenResponse: data.result?.structured?.instructions || data.result?.structured?.summary || `Executed ${toolName} successfully.`,
        latencyMs: 1,
        timestamp: new Date().toISOString(),
      };

      setInteractions(prev => [...prev, syntheticInteraction]);
      setExpandedTrace(data.id);
      setActiveTab('chat');
    } catch (err) {
      console.error('Direct tool execution failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePinDirect = async () => {
    setGeneratingPin(true);
    try {
      const res = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'generate_smart_lock_pin',
            arguments: { recipient: activePinRecipient, validMinutes: pinDuration },
          },
        }),
      });
      const data = await res.json();
      if (data.result?.structured) {
        setActivePins(prev => [data.result.structured, ...prev]);
        setKeypadInput(data.result.structured.pin); // prefill keypad for convenience
      }
    } finally {
      setGeneratingPin(false);
    }
  };

  // Virtual Keypad Input Handler
  const handleKeypadPress = (val) => {
    if (keypadStatus === 'verifying') return;
    if (val === 'CLEAR') {
      setKeypadInput('');
      setKeypadStatus('idle');
      setKeypadFeedback('');
      return;
    }
    if (keypadInput.length < 4) {
      const next = keypadInput + val;
      setKeypadInput(next);
      if (next.length === 4) {
        handleVerifyPin(next);
      }
    }
  };

  const handleVerifyPin = async (pinToVerify) => {
    const pin = pinToVerify || keypadInput;
    if (!pin || pin.length < 4) return;

    setKeypadStatus('verifying');
    setKeypadFeedback('Verifying code with MCP security ledger...');

    try {
      const res = await fetch('/api/lock/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();

      if (data.success) {
        playUnlockSuccess();
        setKeypadStatus('unlocked');
        setKeypadFeedback(`✅ UNLOCKED for ${data.recipient}! Box accessible for ${data.unlockDurationSeconds}s.`);
        setTimeout(() => {
          setKeypadStatus('idle');
          setKeypadFeedback('');
          setKeypadInput('');
          // Refresh PIN list
          fetch('/api/lock/pins').then(r => r.json()).then(d => d.active && setActivePins(d.active));
        }, 5000);
      } else {
        playAccessDenied();
        setKeypadStatus('denied');
        setKeypadFeedback(`❌ ACCESS DENIED: ${data.reason}`);
        setTimeout(() => {
          setKeypadStatus('idle');
          setKeypadFeedback('');
          setKeypadInput('');
        }, 3000);
      }
    } catch (err) {
      setKeypadStatus('denied');
      setKeypadFeedback(`Error: ${err.message}`);
    }
  };

  const handleSilenceSiren = async () => {
    await fetch('/api/siren/stop', { method: 'POST' });
    setSirenActive(false);
  };

  return (
    <div className={`alexa-sim card ${sirenActive ? 'alexa-sim--siren' : ''}`}>
      {/* Header */}
      <div className="alexa-sim__header">
        <div className="alexa-sim__brand">
          <div className="alexa-sim__ring">
            <span className={`alexa-ring ${loading || isListening ? 'alexa-ring--pulsing' : ''}`} />
          </div>
          <div>
            <div className="alexa-sim__title">Alexa+ Voice & MCP Console</div>
            <div className="alexa-sim__subtitle">
              Self-Hosted MCP Server · Spec 2025-11-25 · Streamable HTTP
            </div>
          </div>
        </div>

        <div className="alexa-sim__actions">
          <button
            className={`tts-btn ${ttsEnabled ? 'tts-btn--on' : 'tts-btn--off'}`}
            onClick={() => setTtsEnabled(!ttsEnabled)}
            title="Toggle Alexa Voice Speech Synthesis (Web Speech API)"
          >
            {ttsEnabled ? '🔊 Voice TTS ON' : '🔇 Voice TTS OFF'}
          </button>

          <div className="alexa-sim__tabs">
            <button
              className={`tab-btn ${activeTab === 'chat' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 Agent Chat
            </button>
            <button
              className={`tab-btn ${activeTab === 'tools' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('tools')}
            >
              ⚡ MCP Tools ({mcpTools.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'pins' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('pins')}
            >
              🔐 Smart Lock Keypad ({activePins.length})
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Siren Alert Banner */}
      {sirenActive && (
        <div className="siren-banner">
          <div className="flex items-center gap-2">
            <span className="siren-banner__icon">🚨</span>
            <div>
              <strong>HIGH-RISK ESCALATION ACTIVE:</strong> 90dB Siren Sounding · Mobile Dispatched · MCP Tool: <code>escalate_threat_alert</code>
            </div>
          </div>
          <button className="btn btn--sm btn--secondary" onClick={handleSilenceSiren}>
            Silence Alarm ✕
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="alexa-sim__body">
        {/* TAB 1: CONVERSATIONAL AGENT CHAT */}
        {activeTab === 'chat' && (
          <div className="chat-view">
            {/* Quick Prompt Pills */}
            <div className="quick-prompts">
              <div className="quick-prompts__label">Try Asking Alexa+:</div>
              <div className="quick-prompts__grid">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    className="qp-btn"
                    onClick={() => handleSend(qp.text)}
                    disabled={loading}
                  >
                    <span className="qp-btn__icon">{qp.icon}</span>
                    <span className="qp-btn__text">{qp.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation Feed */}
            <div className="messages-stream">
              {interactions.length === 0 ? (
                <div className="chat-empty">
                  <div className="chat-empty__icon">🎙️</div>
                  <div className="chat-empty__title">Alexa+ Voice Interface Ready</div>
                  <p className="chat-empty__desc">
                    Ask Alexa to check the front door, query deliveries, deliver spoken messages, or generate smart lock PINs. All queries dispatch to the self-hosted MCP server via Streamable HTTP.
                  </p>
                </div>
              ) : (
                interactions.map((item, idx) => {
                  const isExpanded = expandedTrace === item.mcpRequest?.id;
                  return (
                    <div key={idx} className="interaction-card">
                      {/* User Request */}
                      <div className="interaction-user">
                        <span className="interaction-user__avatar">👤</span>
                        <div className="interaction-user__bubble">
                          {item.utterance}
                        </div>
                        <span className="interaction-time">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      {/* Alexa Response */}
                      <div className="interaction-alexa">
                        <span className="interaction-alexa__avatar">🤖</span>
                        <div className="interaction-alexa__content">
                          <div className="interaction-alexa__meta">
                            <span className="alexa-badge">Alexa+</span>
                            <span className="tool-badge">
                              🛠️ MCP Tool: <code>{item.mcpRequest?.params?.name}</code>
                            </span>
                            <span className="latency-badge">⚡ {item.latencyMs}ms</span>
                          </div>

                          <div className="interaction-alexa__speech">
                            "{item.spokenResponse}"
                          </div>

                          <div className="interaction-alexa__reasoning">
                            <span className="reasoning-label">Bedrock Reasoning:</span> {item.intentReasoning}
                          </div>

                          {/* MCP JSON-RPC Payload Inspector Toggle */}
                          <div className="mcp-trace-toggle">
                            <button
                              className="trace-btn"
                              onClick={() => setExpandedTrace(isExpanded ? null : item.mcpRequest?.id)}
                            >
                              {isExpanded ? '▼ Hide MCP JSON-RPC 2.0 Payload' : '▶ Inspect MCP JSON-RPC 2.0 Payload'}
                            </button>
                          </div>

                          {/* Expandable JSON-RPC Inspector */}
                          {isExpanded && (
                            <div className="mcp-inspector">
                              <div className="inspector-col">
                                <div className="inspector-title">
                                  <span>POST /mcp (Request)</span>
                                  <span className="spec-badge">JSON-RPC 2.0</span>
                                </div>
                                <pre className="inspector-json">
                                  {JSON.stringify(item.mcpRequest, null, 2)}
                                </pre>
                              </div>
                              <div className="inspector-col">
                                <div className="inspector-title">
                                  <span>200 OK (MCP Response)</span>
                                  <span className="spec-badge">Streamable HTTP</span>
                                </div>
                                <pre className="inspector-json">
                                  {JSON.stringify(item.mcpResponse, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar with Hands-Free Speech-to-Text */}
            <form
              className="chat-input-bar"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <div className="chat-input-wrapper">
                <span className="input-alexa-icon">🔵</span>
                <input
                  type="text"
                  className="chat-input"
                  placeholder='Ask Alexa+ (e.g., "Alexa, who is at the door?", "Alexa, generate a PIN for FedEx")'
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button
                type="button"
                className={`mic-btn ${isListening ? 'mic-btn--listening' : ''}`}
                onClick={toggleListening}
                title={isListening ? "Listening... click to stop" : "Speak to Alexa+ (Voice Speech-to-Text)"}
              >
                {isListening ? '🔴 Listening...' : '🎙️ Mic'}
              </button>
              <button
                type="submit"
                className="chat-submit-btn btn btn--primary"
                disabled={loading || !input.trim()}
              >
                {loading ? <span className="spinner-sm" /> : 'Send to Alexa+ ➔'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: REGISTERED MCP TOOLS EXPLORER */}
        {activeTab === 'tools' && (
          <div className="tools-view">
            <div className="tools-view__header">
              <div>
                <h3 className="tools-title">Registered MCP Tools (Protocol Spec: 2025-11-25)</h3>
                <p className="tools-desc">
                  These self-hosted tools are advertised to Alexa+ via the <code>tools/list</code> endpoint and invoked over Streamable HTTP via <code>tools/call</code>.
                </p>
              </div>
              <div className="endpoint-pill">
                <code>POST http://localhost:3001/mcp</code>
              </div>
            </div>

            <div className="tools-grid">
              {mcpTools.map((tool) => (
                <div key={tool.name} className="tool-card">
                  <div className="tool-card__header">
                    <span className="tool-card__icon">⚙️</span>
                    <div>
                      <div className="tool-card__name"><code>{tool.name}</code></div>
                      <div className="tool-card__desc">{tool.description}</div>
                    </div>
                  </div>

                  <div className="tool-card__schema">
                    <div className="schema-title">Input Schema:</div>
                    <pre className="schema-pre">
                      {JSON.stringify(tool.inputSchema, null, 2)}
                    </pre>
                  </div>

                  <div className="tool-card__footer">
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => handleDirectToolCall(tool.name, {})}
                      disabled={loading}
                    >
                      ⚡ Execute Tool via MCP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SMART LOCK & ACCESS CONTROL + VIRTUAL KEYPAD */}
        {activeTab === 'pins' && (
          <div className="pins-view">
            <div className="pins-view__header">
              <div>
                <h3 className="pins-title">Porch Security Compartment & Smart Gate PINs</h3>
                <p className="pins-desc">
                  Generate secure, time-limited one-time PINs for delivery couriers and guests using the <code>generate_smart_lock_pin</code> MCP tool.
                </p>
              </div>
            </div>

            <div className="lock-hub-grid">
              {/* Virtual Keypad Testing Interface */}
              <div className="virtual-keypad-card card">
                <div className="keypad-header">
                  <span className="keypad-icon">🔐</span>
                  <div>
                    <h4 className="keypad-title">Porch Delivery Box Keypad</h4>
                    <span className="keypad-sub">Courier Access Terminal</span>
                  </div>
                  <div className={`keypad-led keypad-led--${keypadStatus}`} />
                </div>

                {/* Keypad Display */}
                <div className={`keypad-display keypad-display--${keypadStatus}`}>
                  <div className="keypad-digits">
                    {[0, 1, 2, 3].map(idx => (
                      <span key={idx} className="digit-cell">
                        {keypadInput[idx] ? '●' : '—'}
                      </span>
                    ))}
                  </div>
                  <div className="keypad-clear-val">
                    {keypadInput ? `Entered: ${keypadInput}` : 'Enter 4-Digit Code'}
                  </div>
                </div>

                {/* Status Message */}
                {keypadFeedback && (
                  <div className={`keypad-feedback keypad-feedback--${keypadStatus}`}>
                    {keypadFeedback}
                  </div>
                )}

                {/* Number Pad Grid */}
                <div className="keypad-grid">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      type="button"
                      className="kp-num"
                      onClick={() => handleKeypadPress(num.toString())}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="kp-num kp-clear"
                    onClick={() => handleKeypadPress('CLEAR')}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="kp-num"
                    onClick={() => handleKeypadPress('0')}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="kp-num kp-unlock"
                    onClick={() => handleVerifyPin()}
                    disabled={keypadInput.length !== 4 || keypadStatus === 'verifying'}
                  >
                    Unlock ➔
                  </button>
                </div>
              </div>

              {/* PIN Generator Form & Active List */}
              <div className="pin-manager-column">
                <div className="pin-generator-card">
                  <h4 className="generator-title">Generate New One-Time Courier Access PIN</h4>
                  <div className="generator-form">
                    <div className="form-group">
                      <label>Courier / Recipient</label>
                      <select
                        value={activePinRecipient}
                        onChange={(e) => setActivePinRecipient(e.target.value)}
                        className="select-input"
                      >
                        <option value="Amazon Logistics">📦 Amazon Logistics</option>
                        <option value="UPS Driver">🟫 UPS Driver</option>
                        <option value="FedEx Express">🟣 FedEx Express</option>
                        <option value="USPS Postal Carrier">🦅 USPS Postal Carrier</option>
                        <option value="DoorDash / Delivery">🍔 Delivery Courier</option>
                        <option value="Guest / Neighbor">👤 Guest / Neighbor</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Validity Duration</label>
                      <select
                        value={pinDuration}
                        onChange={(e) => setPinDuration(Number(e.target.value))}
                        className="select-input"
                      >
                        <option value={5}>5 Minutes</option>
                        <option value={15}>15 Minutes (Standard)</option>
                        <option value={30}>30 Minutes</option>
                        <option value={60}>1 Hour</option>
                      </select>
                    </div>

                    <button
                      className="btn btn--primary"
                      onClick={handleGeneratePinDirect}
                      disabled={generatingPin}
                    >
                      {generatingPin ? 'Generating...' : '🔑 Generate Access PIN via MCP'}
                    </button>
                  </div>
                </div>

                {/* Active PINs Ledger */}
                <div className="pins-ledger">
                  <h4 className="ledger-title">Active Security Access Codes ({activePins.length})</h4>
                  {activePins.length === 0 ? (
                    <div className="no-pins">
                      No active PINs currently issued. Generate a PIN above or speak: <em>"Alexa, generate a PIN for the UPS driver"</em>.
                    </div>
                  ) : (
                    <div className="pins-grid">
                      {activePins.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="pin-card"
                          onClick={() => setKeypadInput(item.pin)}
                          title="Click to load into Keypad"
                        >
                          <div className="pin-card__digits">
                            <span className="pin-code">{item.pin}</span>
                            <span className="pin-badge">ACTIVE</span>
                          </div>
                          <div className="pin-card__recipient">
                            Recipient: <strong>{item.recipient}</strong>
                          </div>
                          <div className="pin-card__meta">
                            Valid for {item.validMinutes} mins · Expires at {new Date(item.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="pin-card__instructions">
                            {item.instructions}
                          </div>
                          <button className="pin-load-btn">
                            Load on Keypad ➔
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Web Speech API Audio Synthesizer ─────────────────────────
function speakAlexa(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.05;
  utterance.volume = 0.95;

  const voices = window.speechSynthesis.getVoices();
  const alexaLikeVoice = voices.find(v => 
    v.name.includes('Samantha') || 
    v.name.includes('Google US English') || 
    v.name.includes('Zira') || 
    v.name.includes('Victoria') ||
    v.lang === 'en-US'
  );
  if (alexaLikeVoice) utterance.voice = alexaLikeVoice;

  window.speechSynthesis.speak(utterance);
}
