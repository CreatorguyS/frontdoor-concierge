import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { initRingMonitor } from './ringSimulator.js';
import { analyzeWithBedrock } from './bedrockClient.js';
import { EventStore } from './eventStore.js';
import { 
  handleMcpJsonRpc, 
  processAlexaUtterance, 
  MCP_SERVER_INFO, 
  MCP_TOOLS 
} from './mcpServer.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// ─── HTTP Server + WebSocket ──────────────────────────────────
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
const store = new EventStore();

let connectedClients = new Set();

function broadcast(data) {
  const payload = JSON.stringify(data);
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws, req) => {
  connectedClients.add(ws);
  console.log(`[WS] Client connected. Total: ${connectedClients.size}`);

  // Send history on connect
  ws.send(JSON.stringify({
    type: 'HISTORY',
    events: store.getAll(),
    stats: store.getStats(),
    ringMode: global.ringMode || 'simulator',
  }));

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${connectedClients.size}`);
  });
});

// ─── Core Event Pipeline ──────────────────────────────────────
export async function processRingEvent(rawEvent) {
  const eventId = uuidv4();
  const timestamp = new Date().toISOString();

  // 1. Build base event
  const event = {
    id: eventId,
    timestamp,
    type: rawEvent.type,           // doorbell_pressed | motion_detected | package_detected | person_detected | threat_detected
    zone: rawEvent.zone || 'Front Door',
    snapshot: rawEvent.snapshot,   // base64 JPEG
    source: rawEvent.source || 'simulator',
    status: 'analyzing',
    aiAnalysis: null,
  };

  // Broadcast immediately so UI shows "analyzing" state
  store.append(event);
  broadcast({ type: 'EVENT_NEW', event });

  // 2. Run Bedrock AI Analysis
  try {
    const analysis = await analyzeWithBedrock(rawEvent.snapshot, rawEvent.type);
    event.aiAnalysis = analysis;
    event.status = 'analyzed';
  } catch (err) {
    console.error('[Bedrock] Analysis failed:', err.message);
    event.aiAnalysis = getFallbackAnalysis(rawEvent.type);
    event.status = 'fallback';
  }

  // 3. Update store & broadcast enriched event
  store.update(eventId, event);
  broadcast({ type: 'EVENT_UPDATED', event });

  console.log(`[Event] ${event.type} | ${event.aiAnalysis?.carrierName || event.aiAnalysis?.visitorIntent} | Risk: ${event.aiAnalysis?.riskScore}`);
  return event;
}

function getFallbackAnalysis(eventType) {
  const fallbacks = {
    doorbell_pressed: {
      carrierName: 'Amazon Logistics',
      packageSize: 'medium',
      visitorIntent: 'delivery',
      riskScore: 1,
      confidence: 88,
      greetingInstruction: 'Thank you for the delivery! Please leave the package by the door.',
      alertSummary: 'Delivery person at front door — safe.',
      carrierConfidence: 91,
    },
    motion_detected: {
      carrierName: null,
      packageSize: null,
      visitorIntent: 'motion_only',
      riskScore: 2,
      confidence: 75,
      greetingInstruction: null,
      alertSummary: 'Motion detected in front zone. No person visible.',
      carrierConfidence: 0,
    },
    package_detected: {
      carrierName: 'UPS',
      packageSize: 'large',
      visitorIntent: 'delivery',
      riskScore: 1,
      confidence: 92,
      greetingInstruction: 'Package secured on the porch. Thank you!',
      alertSummary: 'Package dropped off — large parcel, UPS. Secure.',
      carrierConfidence: 87,
    },
    person_detected: {
      carrierName: null,
      packageSize: null,
      visitorIntent: 'unknown_visitor',
      riskScore: 5,
      confidence: 70,
      greetingInstruction: 'Hello! The resident will be with you shortly.',
      alertSummary: 'Unknown visitor detected at front door.',
      carrierConfidence: 0,
    },
    threat_detected: {
      carrierName: null,
      packageSize: null,
      visitorIntent: 'suspicious',
      riskScore: 9,
      confidence: 82,
      greetingInstruction: null,
      alertSummary: '⚠️ ALERT: Suspicious behavior detected. Authorities may need to be contacted.',
      carrierConfidence: 0,
    },
  };
  return fallbacks[eventType] || fallbacks.person_detected;
}

// ─── REST API Routes ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ringMode: global.ringMode || 'simulator',
    bedrockEnabled: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'your_access_key_here'),
    mcpServer: {
      name: MCP_SERVER_INFO.name,
      version: MCP_SERVER_INFO.version,
      protocolVersion: MCP_SERVER_INFO.protocolVersion,
      streamableHttp: true,
      endpoint: '/mcp',
      toolsCount: MCP_TOOLS.length,
    },
    clients: connectedClients.size,
    eventCount: store.count(),
    uptime: process.uptime(),
  });
});

app.get('/api/events', (req, res) => {
  const { type, limit } = req.query;
  let events = store.getAll();
  if (type) events = events.filter(e => e.type === type);
  if (limit) events = events.slice(-parseInt(limit));
  res.json({ events, stats: store.getStats() });
});

app.post('/api/events/trigger', async (req, res) => {
  const { type } = req.body;
  const validTypes = ['doorbell_pressed', 'motion_detected', 'package_detected', 'person_detected', 'threat_detected'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid event type. Valid: ${validTypes.join(', ')}` });
  }

  const { getSimulatedSnapshot } = await import('./ringSimulator.js');
  const snapshot = getSimulatedSnapshot(type);
  const event = await processRingEvent({ type, snapshot, source: 'manual_trigger', zone: 'Front Door' });
  res.json({ success: true, event });
});

app.delete('/api/events', (req, res) => {
  store.clear();
  broadcast({ type: 'HISTORY_CLEARED' });
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  res.json(store.getStats());
});

// ─── Model Context Protocol (MCP) Streamable HTTP Endpoints ──
// Conforms to MCP Spec (2025-11-25) - Powers Alexa+ integrations

// 1. Primary JSON-RPC 2.0 Handler
app.post('/mcp', async (req, res) => {
  try {
    const context = { store, broadcast };
    const response = await handleMcpJsonRpc(req.body, context);
    res.setHeader('Content-Type', 'application/json');
    res.json(response);
  } catch (err) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32603, message: err.message },
    });
  }
});

// 2. MCP Metadata & Capability Discovery
app.get('/mcp', (req, res) => {
  res.json({
    name: MCP_SERVER_INFO.name,
    version: MCP_SERVER_INFO.version,
    protocolVersion: MCP_SERVER_INFO.protocolVersion,
    transport: 'streamable-http',
    endpoints: {
      jsonrpc: '/mcp',
      stream: '/mcp/stream',
    },
    tools: MCP_TOOLS,
  });
});

// 3. MCP Streamable HTTP / Server-Sent Events (SSE) Stream
app.get('/mcp/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`event: initialized\ndata: ${JSON.stringify(MCP_SERVER_INFO)}\n\n`);

  const keepAliveInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
  });
});

// ─── Alexa+ Voice Simulation Endpoints ────────────────────────
app.post('/api/alexa/simulate', async (req, res) => {
  const { utterance } = req.body;
  if (!utterance || typeof utterance !== 'string') {
    return res.status(400).json({ error: 'utterance is required' });
  }

  try {
    const context = { store, broadcast };
    const result = await processAlexaUtterance(utterance, context);

    // Broadcast Alexa+ interaction to dashboard
    broadcast({
      type: 'ALEXA_INTERACTION',
      interaction: result,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alexa/tools', (req, res) => {
  res.json({
    server: MCP_SERVER_INFO,
    tools: MCP_TOOLS,
  });
});

// ─── Smart Lock Access & Virtual Keypad Endpoints ─────────────
app.get('/api/lock/pins', (req, res) => {
  res.json({
    active: store.getActivePins(),
    all: store.getAllPins(),
  });
});

app.post('/api/lock/verify', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ success: false, reason: 'PIN code is required' });
  }

  const result = store.verifyAndUnlock(pin);

  if (result.success) {
    broadcast({
      type: 'COMPARTMENT_UNLOCKED',
      pin,
      recipient: result.recipient,
      unlockDurationSeconds: result.unlockDurationSeconds,
      timestamp: result.timestamp,
    });
  }

  res.json(result);
});

app.post('/api/siren/stop', (req, res) => {
  broadcast({
    type: 'SIREN_SILENCED',
    timestamp: new Date().toISOString(),
  });
  res.json({ success: true, message: 'Siren silenced' });
});

// ─── Multi-Camera Telemetry & Streams ─────────────────────────
app.get('/api/camera/streams', (req, res) => {
  res.json({
    cameras: [
      {
        id: 'cam-front-door',
        name: 'Front Door Camera',
        device: 'Ring Video Doorbell Pro 2',
        location: 'Porch Entryway',
        status: 'online',
        fps: 30,
        resolution: '1080p Full HD',
        battery: 98,
        rssi: -42,
        snapshotKey: 'delivery',
      },
      {
        id: 'cam-parcel-box',
        name: 'Porch Delivery Lockbox',
        device: 'Ring Stick Up Cam Battery',
        location: 'Package Drop Zone',
        status: 'online',
        fps: 30,
        resolution: '1080p Full HD',
        battery: 89,
        rssi: -48,
        snapshotKey: 'package_left',
      },
      {
        id: 'cam-driveway',
        name: 'Driveway & Perimeter',
        device: 'Ring Floodlight Cam Wired Pro',
        location: 'Driveway Approach',
        status: 'online',
        fps: 30,
        resolution: '1080p Full HD',
        battery: 'hardwired',
        rssi: -39,
        snapshotKey: 'motion',
      },
    ],
  });
});

// Periodic cleanup of expired PINs every 30 seconds
setInterval(() => {
  store.cleanupExpiredPins();
}, 30000);

// ─── Boot ─────────────────────────────────────────────────────
async function boot() {
  // Initialize Ring (real or simulator)
  const ringResult = await initRingMonitor(processRingEvent);
  global.ringMode = ringResult.mode;
  console.log(`[Ring] Mode: ${ringResult.mode}${ringResult.deviceCount ? ` | ${ringResult.deviceCount} device(s)` : ''}`);

  // Start HTTP + WS server
  httpServer.listen(PORT, () => {
    console.log(`\n🏠 FrontDoor Concierge Server`);
    console.log(`   HTTP  → http://localhost:${PORT}`);
    console.log(`   WS    → ws://localhost:${PORT}`);
    console.log(`   MCP   → http://localhost:${PORT}/mcp (Streamable HTTP, Spec 2025-11-25)`);
    console.log(`   Ring  → ${global.ringMode} mode`);
    console.log(`   Bedrock → ${process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'your_access_key_here' ? 'enabled' : 'fallback'}\n`);
  });
}

boot().catch(err => {
  console.error('[Boot] Fatal error:', err);
  process.exit(1);
});
