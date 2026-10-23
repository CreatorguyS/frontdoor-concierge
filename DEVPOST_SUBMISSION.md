# 🏆 Devpost & Hackathon Official Submission Kit
### Project: FrontDoor Concierge
**Amazon Developer Hackathon: Build, Ship, Shape**

---

## 1. Basic Information (Copy & Paste to Devpost)

- **Project Title**: FrontDoor Concierge — Autonomous Porch Security & Alexa+ MCP Agent
- **Tagline**: AI-powered Ring doorbell concierge with Amazon Bedrock multimodal vision, self-hosted Alexa+ Model Context Protocol (MCP) server, and automated courier lockbox access control.
- **Primary Track (Option A)**: **Ring Track** (Built using `ring-client-api` with realistic simulator fallback, access control, smart home automation, and threat defense).
- **Primary Track (Option B)**: **Alexa+ Track** (Self-hosted MCP server conforming to Spec 2025-11-25, Streamable HTTP & JSON-RPC 2.0, with web simulator).
- **Mini-Challenges Entered**:
  - ✅ **AWS Builder Mini-Challenge** ($10K in AWS credits): Amazon Bedrock Claude 3.5 Sonnet multimodal vision integration (`@aws-sdk/client-bedrock-runtime`).
  - ✅ **Open Source Mini-Challenge**: Permissive MIT License included in root repository.
  - ✅ **Friction Log Bonus**: Up to **+10% judging bonus** with 3 in-depth entries in `FRICTION_LOG.md`.
- **GitHub Repository**: https://github.com/CreatorguyS/frontdoor-concierge
- **Demo Video URL (Embedded & Direct Link)**: https://github.com/CreatorguyS/frontdoor-concierge#--live-demonstration-full-system-walkthrough
  *(Or direct raw video link: https://raw.githubusercontent.com/CreatorguyS/frontdoor-concierge/main/demo.webp)*


## 2. Devpost Story / Project Description

### 💡 Inspiration
Over $12 billion in packages are stolen off American porches every year ("porch piracy"). Traditional smart doorbells are completely passive: they buzz your phone *after* a courier has already left your package in the rain or an opportunist has stolen it. Furthermore, delivery couriers cannot access secure gates or parcel boxes, and homeowners cannot converse in real time with every visitor. 

We asked: *What if your front door wasn't just a video camera, but an autonomous, courteous AI concierge powered by Amazon's ecosystem that can see, reason, converse, and grant physical access?*

### 🚀 What It Does
**FrontDoor Concierge** transforms smart doorbells from passive notification buzzers into an intelligent front-porch concierge and security guardian:
1. **Multimodal Vision & Courier Recognition**: Intercepts doorbell presses and camera frames, sending them to **Amazon Bedrock (Claude 3.5 Sonnet)** to classify courier uniforms (**Amazon Logistics**, **UPS**, **FedEx**, **USPS**, **DHL**), assess package dimensions, and calculate a real-time porch piracy risk score (0–10).
2. **Dynamic Two-Way Audio Concierge**: Speaks personalized voice greetings through the doorbell speaker (e.g., *"Thank you for the Amazon delivery! Please leave the package behind the planter box"*).
3. **Self-Hosted Alexa+ MCP Server (Spec 2025-11-25)**: Exposes 7 tools and resources to Alexa+ agents over **Streamable HTTP**. Homeowners can ask Alexa:
   - *"Alexa, who is at the front door?"*
   - *"Alexa, was my Amazon package delivered?"*
   - *"Alexa, generate a PIN for the UPS driver"*
   - *"Alexa, sound the front porch siren"*
4. **Interactive Virtual Smart Lock Keypad**: Generates time-decaying 4-digit one-time PINs for delivery couriers to unlock the porch parcel security compartment, protected against replay attacks.
5. **Multi-Camera Fleet HUD**: Real-time switching between Front Door, Porch Lockbox, and Driveway cameras with Infrared Night Vision and telemetry.
6. **Offline Web Audio API Sound Synthesizer**: Realistic synthesized doorbell chimes, 90dB warbling emergency sirens, smart lock mechanical hums, and Alexa wake tones with zero external MP3 dependencies.

### 🏗️ How We Built It
- **Hardware & Ingestion**: Ring developer ecosystem via `ring-client-api` with a dual-mode fallback simulator for seamless judge evaluation.
- **AI Vision Cognition**: Amazon Bedrock Runtime SDK (`@aws-sdk/client-bedrock-runtime`) utilizing `anthropic.claude-3-5-sonnet-20241022-v2:0` for zero-shot image classification and risk reasoning.
- **Agent Standard**: Self-hosted Model Context Protocol (MCP) server conforming to the November 2025 specification with Streamable HTTP JSON-RPC 2.0 and Server-Sent Events (`/mcp/stream`).
- **Backend Hub**: Node.js & Express server with real-time WebSocket event broadcasting and atomic JSON persistence.
- **Frontend Dashboard**: React 19 + Vite command center with dark glassmorphism styling, live scan-line animations, interactive JSON-RPC payload inspector, and Web Speech API audio synthesis.

### 🧗 Challenges We Ran Into & Friction Log
We documented our technical roadblocks in an official **Friction Log** (`FRICTION_LOG.md`) to capture the **+10% judging bonus**:
1. *Ring Headless 2FA Token Lifecycles*: Solved by engineering an abstracted dual-mode adapter that guarantees continuous uptime.
2. *MCP Streamable HTTP Transport vs. Stdio*: Designed a custom Express JSON-RPC 2.0 router to make MCP accessible over remote HTTP and browsers.
3. *Bedrock Multimodal Base64 Overhead*: Implemented an in-flight downsampling and quantization pipeline to achieve sub-500ms inference.

### 🏅 Accomplishments That We're Proud Of
- Created an end-to-end working system bridging **three major Amazon Developer pillars**: Ring, Alexa+ (MCP), and AWS Bedrock.
- Built a live interactive **MCP JSON-RPC Payload Inspector** allowing judges to inspect raw envelopes in real time.
- Implemented an interactive **Virtual Physical Keypad** that responds to temporary PIN codes with mechanical sound effects and visual LED feedback.

---

## 3. Demo Video Presentation Script (2.5 Minutes)

- **[0:00–0:25] The Problem**: "12 billion dollars in packages are stolen every year. Current smart doorbells are completely passive. They buzz your phone after the package is gone. We built FrontDoor Concierge to solve this."
- **[0:25–1:10] The Porch Guardian & Bedrock Vision**: "Here is our live dashboard. When an Amazon courier approaches and rings the doorbell, Amazon Bedrock Claude 3.5 Sonnet analyzes the frame. It detects the Amazon Logistics vest, checks package dimensions, grades risk as safe, and speaks an automated greeting through the doorbell speaker."
- **[1:10–1:55] Alexa+ Model Context Protocol (MCP) Integration**: "Next, let's switch to the Alexa+ MCP Console. Our backend runs a self-hosted MCP server conforming to the latest 2025-11-25 Streamable HTTP spec. We can speak: *'Alexa, generate a PIN for the UPS driver'*. Alexa selects the `generate_smart_lock_pin` tool, generates a one-time code, and returns it. We can open the MCP Inspector to see the exact JSON-RPC 2.0 payload."
- **[1:55–2:15] Smart Lock Verification & Threat Defense**: "The delivery driver enters the code on our porch keypad terminal. The LED turns green, the smart lock unlocks, and the parcel is safely stored. If an intruder attempts loitering, Bedrock flags risk score 9/10, activating a 90dB siren and alert escalation."
- **[2:15–2:30] Wrap-up & Multi-Track Alignment**: "FrontDoor Concierge combines Ring hardware, Alexa+ MCP standards, and AWS Bedrock intelligence to protect homes autonomously. Thank you!"

---

## 4. GitHub Push Commands (Run in Terminal)

```bash
# 1. Create a new repository on GitHub named "frontdoor-concierge"
# 2. Run these commands from the project root:
cd "c:\complete web development camp\amazon developer hackathon\frontdoor-concierge"
git remote add origin https://github.com/<YOUR_USERNAME>/frontdoor-concierge.git
git branch -M main
git push -u origin main
```
