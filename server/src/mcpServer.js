/**
 * Self-Hosted Model Context Protocol (MCP) Server — FrontDoor Concierge
 * Conforms to MCP Specification (2025-11-25 / Streamable HTTP & JSON-RPC 2.0)
 * Powers Alexa+ Integration and Agent Skills.
 */

import { v4 as uuidv4 } from 'uuid';

export const MCP_SERVER_INFO = {
  name: 'frontdoor-concierge-mcp',
  version: '2.1.0',
  protocolVersion: '2025-11-25',
  description: 'Self-hosted MCP server bridging Ring Smart Doorbells and Alexa+ Agent Skills with Amazon Bedrock reasoning.',
};

// ─── Temporary One-Time PIN Store ─────────────────────────────
const activePins = new Map();

// ─── Tools Definition ─────────────────────────────────────────
export const MCP_TOOLS = [
  {
    name: 'check_front_door_status',
    description: 'Inspect current Ring doorbell camera status, active threat levels, and the latest front porch activity.',
    inputSchema: {
      type: 'object',
      properties: {
        includeRecentEvents: {
          type: 'boolean',
          description: 'Whether to include the last 3 events in the response',
          default: true,
        },
      },
      required: [],
    },
  },
  {
    name: 'inspect_latest_delivery',
    description: 'Retrieve details of the most recent package delivery, including carrier (Amazon, UPS, FedEx), package size, delivery timestamp, and Bedrock vision confidence.',
    inputSchema: {
      type: 'object',
      properties: {
        carrier: {
          type: 'string',
          description: 'Filter by specific carrier (e.g. Amazon, UPS, FedEx, USPS)',
        },
      },
      required: [],
    },
  },
  {
    name: 'speak_to_visitor',
    description: 'Deliver an audible spoken instruction or message through the Ring doorbell two-way speaker to a visitor or delivery courier.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The verbal instruction to speak through the doorbell speaker (max 30 words)',
        },
        tone: {
          type: 'string',
          enum: ['friendly', 'urgent', 'authoritative'],
          description: 'Vocal tone for the synthesized announcement',
          default: 'friendly',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'generate_smart_lock_pin',
    description: 'Generate a temporary 4-digit one-time access PIN for trusted delivery couriers (Amazon Key, UPS) or visitors to open the porch security box or gate.',
    inputSchema: {
      type: 'object',
      properties: {
        recipient: {
          type: 'string',
          description: 'Name of the recipient or courier company (e.g. Amazon Logistics, UPS Driver, John Doe)',
        },
        validMinutes: {
          type: 'number',
          description: 'PIN validity period in minutes (default 15)',
          default: 15,
        },
      },
      required: ['recipient'],
    },
  },
  {
    name: 'verify_and_unlock_compartment',
    description: 'Verify a 4-digit courier access code and unlock the porch parcel security compartment or gate for secure drop-off.',
    inputSchema: {
      type: 'object',
      properties: {
        pin: {
          type: 'string',
          description: 'The 4-digit security PIN entered on the compartment keypad',
        },
      },
      required: ['pin'],
    },
  },
  {
    name: 'escalate_threat_alert',
    description: 'Trigger high-risk emergency escalation for suspicious loitering or porch piracy attempt (sounds 90dB siren, notifies emergency contacts, snapshots evidence).',
    inputSchema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Specific reason for threat escalation',
        },
        sirenDurationSeconds: {
          type: 'number',
          description: 'Duration to activate warning siren (0-60s)',
          default: 15,
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'query_daily_analytics',
    description: "Get today's delivery and front porch security telemetry: total drop-offs, carrier distribution, average risk score, and tamper alerts.",
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ─── Resources Definition ─────────────────────────────────────
export const MCP_RESOURCES = [
  {
    uri: 'frontdoor://camera/latest-snapshot',
    name: 'Latest Camera Snapshot',
    description: 'Latest high-definition snapshot frame captured by the Ring camera.',
    mimeType: 'image/jpeg',
  },
  {
    uri: 'frontdoor://security/activity-summary',
    name: 'Front Door Activity Summary',
    description: 'Summary of all porch activity in the last 24 hours.',
    mimeType: 'application/json',
  },
  {
    uri: 'frontdoor://analytics/daily-stats',
    name: 'Daily Delivery Analytics',
    description: 'Aggregated logistics and security metrics for the current day.',
    mimeType: 'application/json',
  },
];

// ─── Prompts Definition ───────────────────────────────────────
export const MCP_PROMPTS = [
  {
    name: 'daily_porch_briefing',
    description: 'Alexa briefing summarizing all front porch events, deliveries, and security status.',
    arguments: [],
  },
  {
    name: 'threat_investigation',
    description: 'Alexa investigative workflow when suspicious motion or unknown visitors are flagged.',
    arguments: [
      {
        name: 'eventId',
        description: 'ID of the suspicious event to investigate',
        required: false,
      },
    ],
  },
];

// ─── Tool Execution Engine ────────────────────────────────────
export async function executeMcpTool(name, args, { store, broadcast, triggerSpeech }) {
  const events = store.getAll();
  const stats = store.getStats();

  switch (name) {
    case 'check_front_door_status': {
      const latest = events[events.length - 1];
      const recent = (args.includeRecentEvents !== false) ? events.slice(-3) : [];
      const hasActiveThreat = events.some(e => e.type === 'threat_detected' && (Date.now() - new Date(e.timestamp).getTime()) < 3600000);

      const status = {
        state: hasActiveThreat ? 'ALERT_HIGH' : 'NORMAL_SECURE',
        cameraOnline: true,
        ringMode: global.ringMode || 'simulator',
        activeThreatWarning: hasActiveThreat,
        latestEvent: latest ? {
          type: latest.type,
          timestamp: latest.timestamp,
          carrier: latest.aiAnalysis?.carrierName || 'None',
          riskScore: latest.aiAnalysis?.riskScore || 0,
          summary: latest.aiAnalysis?.alertSummary || 'Normal status',
        } : null,
        recentEventsCount: events.length,
        recentHighlights: recent.map(r => `[${new Date(r.timestamp).toLocaleTimeString()}] ${r.type} (Risk: ${r.aiAnalysis?.riskScore || 0})`),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(status, null, 2),
          },
        ],
        structured: status,
      };
    }

    case 'inspect_latest_delivery': {
      const deliveries = events.filter(e => e.type === 'package_detected' || e.type === 'doorbell_pressed');
      let target = deliveries[deliveries.length - 1];

      if (args.carrier) {
        target = deliveries.reverse().find(e => 
          e.aiAnalysis?.carrierName?.toLowerCase().includes(args.carrier.toLowerCase())
        );
      }

      if (!target) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ found: false, message: 'No delivery events recorded yet today.' }) }],
          structured: { found: false },
        };
      }

      const res = {
        found: true,
        deliveryId: target.id,
        timestamp: target.timestamp,
        timeAgo: `${Math.round((Date.now() - new Date(target.timestamp).getTime()) / 60000)} minutes ago`,
        carrier: target.aiAnalysis?.carrierName || 'Carrier Unspecified',
        carrierConfidence: target.aiAnalysis?.carrierConfidence || 90,
        packageSize: target.aiAnalysis?.packageSize || 'standard parcel',
        riskScore: target.aiAnalysis?.riskScore || 1,
        alertSummary: target.aiAnalysis?.alertSummary || 'Package secured on porch.',
        verifiedSafe: (target.aiAnalysis?.riskScore || 1) <= 2,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
        structured: res,
      };
    }

    case 'speak_to_visitor': {
      const { message, tone = 'friendly' } = args;
      if (!message) throw new Error('Message argument is required');

      // Broadcast audio event to connected frontend clients so Web Speech API articulates it
      broadcast({
        type: 'ALEXA_SPOKEN_GREETING',
        message,
        tone,
        source: 'alexa_mcp_command',
        timestamp: new Date().toISOString(),
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'broadcast_success',
              speaker: 'Ring Doorbell Two-Way Audio',
              messageSpoken: message,
              tone,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
        structured: { status: 'broadcast_success', messageSpoken: message, tone },
      };
    }

    case 'generate_smart_lock_pin': {
      const { recipient, validMinutes = 15 } = args;
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + validMinutes * 60000).toISOString();

      const record = store.savePin({
        pin,
        recipient,
        validMinutes,
        expiresAt,
        status: 'active',
        createdAt: new Date().toISOString(),
        instructions: `PIN ${pin} will unlock the porch security compartment for ${validMinutes} minutes.`,
      });

      // Notify clients via WebSocket
      broadcast({
        type: 'SMART_PIN_GENERATED',
        pinRecord: record,
        pin,
        recipient,
        expiresAt,
        validMinutes,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(record, null, 2) }],
        structured: record,
      };
    }

    case 'verify_and_unlock_compartment': {
      const { pin } = args;
      if (!pin) throw new Error('PIN parameter is required');

      const unlockResult = store.verifyAndUnlock(pin);

      if (unlockResult.success) {
        broadcast({
          type: 'COMPARTMENT_UNLOCKED',
          pin,
          recipient: unlockResult.recipient,
          unlockDurationSeconds: unlockResult.unlockDurationSeconds,
          timestamp: unlockResult.timestamp,
        });

        // Also record an audit event in the store
        store.append({
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          type: 'package_detected',
          zone: 'Porch Security Box',
          snapshot: 'package_left',
          source: 'smart_lock_access',
          status: 'analyzed',
          aiAnalysis: {
            carrierName: unlockResult.recipient,
            carrierConfidence: 100,
            packageSize: 'medium',
            visitorIntent: 'delivery',
            riskScore: 0,
            confidence: 99,
            greetingInstruction: `Compartment unlocked for ${unlockResult.recipient}. Safe deposit secured.`,
            alertSummary: `🔑 Secure porch box opened with authorized PIN by ${unlockResult.recipient}.`,
            packageCount: 1,
            _source: 'smart_lock',
          },
        });
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(unlockResult, null, 2) }],
        structured: unlockResult,
      };
    }

    case 'escalate_threat_alert': {
      const { reason, sirenDurationSeconds = 15 } = args;
      
      broadcast({
        type: 'THREAT_ESCALATED',
        reason,
        sirenDurationSeconds,
        timestamp: new Date().toISOString(),
      });

      const res = {
        action: 'EMERGENCY_ESCALATION_TRIGGERED',
        sirenActive: true,
        sirenDurationSeconds,
        reason,
        emergencyContactsNotified: ['Homeowner Mobile Push', 'Neighbor Alert Hub'],
        incidentReportLogged: true,
        timestamp: new Date().toISOString(),
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
        structured: res,
      };
    }

    case 'query_daily_analytics': {
      return {
        content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
        structured: stats,
      };
    }

    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

// ─── JSON-RPC 2.0 Handler ─────────────────────────────────────
export async function handleMcpJsonRpc(body, context) {
  const { jsonrpc, id, method, params } = body;

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' } };
  }

  try {
    switch (method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: MCP_SERVER_INFO.protocolVersion,
            serverInfo: {
              name: MCP_SERVER_INFO.name,
              version: MCP_SERVER_INFO.version,
            },
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: true, listChanged: true },
              prompts: { listChanged: true },
              logging: {},
            },
          },
        };
      }

      case 'notifications/initialized': {
        return { jsonrpc: '2.0', id, result: { acknowledged: true } };
      }

      case 'ping': {
        return { jsonrpc: '2.0', id, result: {} };
      }

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS,
          },
        };
      }

      case 'tools/call': {
        const { name, arguments: toolArgs = {} } = params || {};
        if (!name) {
          return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Missing tool name' } };
        }

        const execution = await executeMcpTool(name, toolArgs, context);
        return {
          jsonrpc: '2.0',
          id,
          result: execution,
        };
      }

      case 'resources/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            resources: MCP_RESOURCES,
          },
        };
      }

      case 'resources/read': {
        const { uri } = params || {};
        if (uri === 'frontdoor://security/activity-summary') {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(context.store.getAll().slice(-20), null, 2),
                },
              ],
            },
          };
        }
        if (uri === 'frontdoor://analytics/daily-stats') {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(context.store.getStats(), null, 2),
                },
              ],
            },
          };
        }
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: `Resource not found: ${uri}` },
        };
      }

      case 'prompts/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            prompts: MCP_PROMPTS,
          },
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: err.message },
    };
  }
}

// ─── Alexa+ Voice Utterance Intent Matcher ────────────────────
export async function processAlexaUtterance(utterance, context) {
  const text = utterance.toLowerCase().trim();
  let toolName = 'check_front_door_status';
  let toolArgs = {};
  let intentReasoning = '';

  // 1. PIN Unlock / Verify
  const pinMatch = text.match(/\b\d{4}\b/);
  if (pinMatch && (text.includes('unlock') || text.includes('verify') || text.includes('enter') || text.includes('open') || text.includes('code'))) {
    toolName = 'verify_and_unlock_compartment';
    toolArgs = { pin: pinMatch[0] };
    intentReasoning = `User supplied 4-digit code ${pinMatch[0]} to unlock the parcel box. Selected tool: verify_and_unlock_compartment.`;
  }
  // 2. PIN / Lockbox Access Generation
  else if (text.includes('pin') || text.includes('unlock') || text.includes('code') || text.includes('smart lock') || text.includes('gate') || text.includes('access')) {
    toolName = 'generate_smart_lock_pin';
    let recipient = 'Courier / Guest';
    if (text.includes('ups')) recipient = 'UPS Driver';
    else if (text.includes('amazon')) recipient = 'Amazon Logistics';
    else if (text.includes('fedex')) recipient = 'FedEx Driver';
    else if (text.includes('usps')) recipient = 'USPS Carrier';
    toolArgs = { recipient, validMinutes: 15 };
    intentReasoning = `User requested smart lock access code for ${recipient}. Selected tool: generate_smart_lock_pin.`;
  } 
  // 2. Threat Escalation & Siren
  else if (text.includes('threat') || text.includes('siren') || text.includes('alarm') || text.includes('suspicious') || text.includes('intruder') || text.includes('pirate')) {
    toolName = 'escalate_threat_alert';
    toolArgs = { reason: 'Voice command emergency alert: suspicious activity at front door', sirenDurationSeconds: 20 };
    intentReasoning = 'User flagged emergency / threat. Selected tool: escalate_threat_alert.';
  } 
  // 3. Two-Way Doorbell Voice Broadcast
  else if (text.includes('tell') || text.includes('speak') || text.includes('say') || text.includes('greeting') || text.includes('instruction')) {
    toolName = 'speak_to_visitor';
    let msg = utterance.replace(/alexa(,| )*(please )*/i, '').trim();
    if (msg.toLowerCase().startsWith('tell') || msg.toLowerCase().startsWith('say')) {
      msg = msg.replace(/^(tell|say)\s+(the\s+)?(courier|visitor|driver)?\s*(to\s+)?/i, '');
    }
    toolArgs = { message: msg || 'Please leave the package by the door. Thank you!' };
    intentReasoning = 'User instructed Alexa to deliver a voice message. Selected tool: speak_to_visitor.';
  } 
  // 4. Analytics & Daily Metrics
  else if (text.includes('stat') || text.includes('analytic') || text.includes('how many') || text.includes('today')) {
    toolName = 'query_daily_analytics';
    toolArgs = {};
    intentReasoning = 'User requested daily activity metrics. Selected tool: query_daily_analytics.';
  } 
  // 5. Package Delivery Status
  else if (text.includes('package') || text.includes('delivery') || text.includes('delivered') || text.includes('amazon') || text.includes('ups') || text.includes('fedex')) {
    toolName = 'inspect_latest_delivery';
    if (text.includes('amazon')) toolArgs.carrier = 'Amazon';
    else if (text.includes('ups')) toolArgs.carrier = 'UPS';
    else if (text.includes('fedex')) toolArgs.carrier = 'FedEx';
    intentReasoning = 'User inquired about a package delivery. Selected tool: inspect_latest_delivery.';
  } 
  // 6. Camera / Front Door Status (Default)
  else {
    toolName = 'check_front_door_status';
    toolArgs = { includeRecentEvents: true };
    intentReasoning = 'User inquired about front door / camera status. Selected tool: check_front_door_status.';
  }

  // Execute the MCP tool
  const startTime = Date.now();
  const execution = await executeMcpTool(toolName, toolArgs, context);
  const latencyMs = Date.now() - startTime;

  // Synthesize spoken Alexa response
  let spokenResponse = '';
  const data = execution.structured;

  if (toolName === 'check_front_door_status') {
    if (data.latestEvent) {
      spokenResponse = `At the front door, the camera is online. The latest activity was ${data.latestEvent.type.replace('_', ' ')} with a risk score of ${data.latestEvent.riskScore} out of 10. ${data.latestEvent.summary}`;
    } else {
      spokenResponse = 'The front door camera is active and clear. There are no recent events recorded today.';
    }
  } else if (toolName === 'inspect_latest_delivery') {
    if (data.found) {
      spokenResponse = `Your ${data.carrier} delivery arrived ${data.timeAgo}. It is a ${data.packageSize} with a risk score of ${data.riskScore} out of 10. ${data.alertSummary}`;
    } else {
      spokenResponse = 'I checked your front porch log. No package deliveries have been recorded yet today.';
    }
  } else if (toolName === 'speak_to_visitor') {
    spokenResponse = `I have broadcasted the message: "${toolArgs.message}" through the Ring doorbell speaker.`;
  } else if (toolName === 'generate_smart_lock_pin') {
    spokenResponse = `I generated temporary access code ${data.pin} for ${data.recipient}. It will remain valid for ${data.validMinutes} minutes to unlock the parcel box.`;
  } else if (toolName === 'verify_and_unlock_compartment') {
    if (data.success) {
      spokenResponse = `Access granted for ${data.recipient}. Porch security compartment is now unlocked for ${data.unlockDurationSeconds} seconds.`;
    } else {
      spokenResponse = `Access denied. ${data.reason}.`;
    }
  } else if (toolName === 'escalate_threat_alert') {
    spokenResponse = `Threat escalation protocol activated. Sounding the front porch siren and dispatching alert notifications to your device.`;
  } else if (toolName === 'query_daily_analytics') {
    spokenResponse = `Today, you have had ${data.todayTotal || 0} front door events, including ${data.deliveries || 0} package deliveries and ${data.highRiskAlerts || 0} security alerts.`;
  }

  return {
    utterance,
    intentReasoning,
    mcpRequest: {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArgs,
      },
    },
    mcpResponse: {
      jsonrpc: '2.0',
      result: execution,
    },
    spokenResponse,
    latencyMs,
    timestamp: new Date().toISOString(),
  };
}
