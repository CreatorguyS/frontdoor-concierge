/**
 * Amazon Bedrock Client — FrontDoor Concierge
 *
 * Uses Claude 3.5 Sonnet (multimodal) via Amazon Bedrock to analyze
 * Ring doorbell camera snapshots and extract:
 * - Carrier identification (Amazon, UPS, FedEx, USPS, etc.)
 * - Package size estimation
 * - Visitor intent classification
 * - Risk score (0–10 porch piracy likelihood)
 * - Personalized greeting instruction for the courier
 * - Homeowner alert summary
 *
 * AWS Builder Mini-Challenge: This module documents the Bedrock integration.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const REGION   = process.env.AWS_REGION || 'us-east-1';

// Instantiate the Bedrock client (AWS SDK v3)
const bedrockClient = new BedrockRuntimeClient({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'your_access_key_here'
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined, // falls back to IAM role / default credential chain
});

const ANALYSIS_PROMPT = `You are an AI security analyst for a smart doorbell system. 
Analyze this Ring doorbell camera snapshot and return a JSON response with EXACTLY these fields:

{
  "carrierName": "Amazon|UPS|FedEx|USPS|DHL|Unknown|null",
  "carrierConfidence": <0-100 percentage>,
  "packageSize": "small|medium|large|extra-large|fragile|null",
  "visitorIntent": "delivery|pickup|known_guest|solicitor|unknown_visitor|suspicious|motion_only",
  "riskScore": <0-10 integer, 0=safe, 10=extreme threat>,
  "confidence": <0-100 overall analysis confidence>,
  "greetingInstruction": "<spoken instruction for the delivery person or visitor, max 20 words, or null if no person>",
  "alertSummary": "<1-2 sentence summary for the homeowner>",
  "packageCount": <number of packages visible, 0 if none>
}

Event context: {EVENT_TYPE}

Rules:
- riskScore 0-2: safe delivery, known carrier
- riskScore 3-5: unknown person, assess intent  
- riskScore 6-8: suspicious behavior, loitering
- riskScore 9-10: active threat, porch piracy attempt

Return ONLY valid JSON, no markdown fences, no explanation.`;

/**
 * Analyze a Ring snapshot using Amazon Bedrock Claude 3.5 Sonnet (multimodal)
 * @param {string} snapshot - base64 JPEG data URI or snapshot key
 * @param {string} eventType - Ring event type
 * @returns {Promise<Object>} AI analysis result
 */
export async function analyzeWithBedrock(snapshot, eventType) {
  // If no real image data (just a key from simulator), use smart mock
  if (!snapshot || !snapshot.startsWith('data:image')) {
    return generateSmartMockAnalysis(eventType, snapshot);
  }

  const imageBase64 = snapshot.replace(/^data:image\/\w+;base64,/, '');
  const prompt = ANALYSIS_PROMPT.replace('{EVENT_TYPE}', eventType);

  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const content = responseBody.content?.[0]?.text;

  if (!content) throw new Error('Empty response from Bedrock');

  // Parse and validate JSON response
  const analysis = JSON.parse(content.trim());
  validateAnalysis(analysis);

  return analysis;
}

function validateAnalysis(obj) {
  const required = ['carrierName', 'visitorIntent', 'riskScore', 'confidence', 'alertSummary'];
  for (const field of required) {
    if (!(field in obj)) throw new Error(`Missing field: ${field}`);
  }
  if (typeof obj.riskScore !== 'number' || obj.riskScore < 0 || obj.riskScore > 10) {
    throw new Error('Invalid riskScore');
  }
}

// ─── Smart Mock for Demo / Fallback ──────────────────────────
const MOCK_ANALYSES = {
  delivery: {
    carrierName: 'Amazon Logistics',
    carrierConfidence: 94,
    packageSize: 'medium',
    visitorIntent: 'delivery',
    riskScore: 1,
    confidence: 91,
    greetingInstruction: 'Please leave the package by the door. Thank you!',
    alertSummary: 'Amazon delivery driver detected. Medium-sized parcel. Low risk — safe delivery.',
    packageCount: 1,
  },
  motion: {
    carrierName: null,
    carrierConfidence: 0,
    packageSize: null,
    visitorIntent: 'motion_only',
    riskScore: 2,
    confidence: 78,
    greetingInstruction: null,
    alertSummary: 'Motion detected in front zone. No person visible. Package present on porch.',
    packageCount: 1,
  },
  threat: {
    carrierName: null,
    carrierConfidence: 0,
    packageSize: null,
    visitorIntent: 'suspicious',
    riskScore: 9,
    confidence: 88,
    greetingInstruction: null,
    alertSummary: '⚠️ HIGH RISK: Hooded individual with suspicious behavior detected. Consider contacting authorities.',
    packageCount: 0,
  },
  person: {
    carrierName: null,
    carrierConfidence: 0,
    packageSize: null,
    visitorIntent: 'unknown_visitor',
    riskScore: 4,
    confidence: 72,
    greetingInstruction: 'Hello! How can we help you today?',
    alertSummary: 'Unknown visitor at front door. No carrier uniform detected. Moderate risk.',
    packageCount: 0,
  },
  package_left: {
    carrierName: 'FedEx',
    carrierConfidence: 82,
    packageSize: 'large',
    visitorIntent: 'delivery',
    riskScore: 1,
    confidence: 89,
    greetingInstruction: null,
    alertSummary: 'Large FedEx package detected on porch. Delivery complete. Package appears secure.',
    packageCount: 1,
  },
};

function generateSmartMockAnalysis(eventType, snapshotKey) {
  const key = snapshotKey || 'motion';
  const base = MOCK_ANALYSES[key] || MOCK_ANALYSES.motion;

  // Add slight randomness to make it feel real
  return {
    ...base,
    confidence: base.confidence + Math.floor(Math.random() * 5) - 2,
    carrierConfidence: base.carrierConfidence ? base.carrierConfidence + Math.floor(Math.random() * 4) - 2 : 0,
    _source: 'bedrock_mock',
  };
}
