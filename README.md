# CalHacks2025 Scam Detection Prototype

Electron application that analyzes URLs for scams using **real VM-based analysis via URLScan.io**. Features a lightweight system tray UI that sends URLs for analysis through multiple detection layers before returning a risk score notification.

## Features

- **Real URLScan.io Integration** - URLs are analyzed in isolated VMs with malware/phishing detection
- **Bright Data Threat Intelligence** - Enhanced scam detection with WHOIS data and phishing indicators (optional)
- **Email Authenticity Verification** - Detects brand impersonation, typosquatting, and phishing emails automatically
- **Contact Verification** - Paste LinkedIn messages/emails to verify if person is real and email matches public records
- **Global Keyboard Shortcut** - Press Cmd/Ctrl+Shift+S anywhere to instantly open ScamShield
- **Multi-Signal Risk Scoring** - Combines URL sandbox analysis, domain reputation, keyword detection
- **Invisible Tray Agent** - Runs silently and only surfaces a Cluely-style alert overlay on risky findings
- **Gmail Inbox Scanning** - OAuth flow to connect Gmail and flag suspicious messages with AI-powered verification
- **Clipboard & Screen Awareness** - Auto-detects URLs copied to the clipboard and queues them for scanning
- **Extensible Architecture** - Easy to add VirusTotal, PhishTank, and other threat intelligence sources

## Quick Start

### 1. Get URLScan.io API Key

1. Sign up at [https://urlscan.io/](https://urlscan.io/)
2. Get your API key from [https://urlscan.io/user/profile/](https://urlscan.io/user/profile/)

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your keys
# URLSCAN_API_KEY=your_urlscan_api_key
# BRIGHTDATA_API_TOKEN=your_brightdata_token   # optional for enhanced detection
# GOOGLE_CLIENT_ID=your_google_oauth_client_id
# GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
# GOOGLE_REDIRECT_URI=http://127.0.0.1:42862/oauth2callback   # optional override
```

### 3. Install & Run

```bash
npm install
npm start
```

`npm start` launches Electron with the system tray UI. Use the tray menu's sample actions to trigger analyses and preview the alert overlay.

**Quick Access:** Press **Cmd/Ctrl+Shift+S** from anywhere to instantly open the dashboard.

### 4. Test Integrations

```bash
# Test URLScan.io integration
node test-urlscan.js https://example.com

# Test Bright Data integration (optional)
node test-brightdata.js

# Test email verification (detects phishing emails)
node test-email-verifier.js
```

**See [SETUP.md](SETUP.md) for detailed setup instructions and troubleshooting.**

### 5. Enable Bright Data (optional but recommended)

1. Sign up at [https://brightdata.com/cp/start](https://brightdata.com/cp/start)
2. Get your API token from the Bright Data dashboard
3. Add `BRIGHTDATA_API_TOKEN=your_token` to your `.env` file
4. Test the integration: `node test-brightdata.js`

**Bright Data provides:**
- Real-time WHOIS data for domain age verification
- Phishing indicator detection (login forms, credential harvesting)
- Brand impersonation analysis
- Obfuscated script detection
- Urgency language detection (common in scams)

**Email Verification Features (automatic with Gmail integration):**
- Brand impersonation detection (e.g., "PayPal" sender but wrong domain)
- Typosquatting detection (paypa1.com, g00gle.com, etc.)
- Domain similarity analysis (90% accuracy in tests)
- Sender/domain mismatch detection
- Urgency and pressure language detection
- Financial/personal info request warnings

**Contact Verification (manual - paste text in dashboard):**
- Extract name, email, phone, company from pasted text
- Verify person exists on LinkedIn/professional networks (requires Bright Data)
- Compare claimed email against known company domains
- Flag personal emails used for business (gmail.com for "Microsoft CEO")
- Detect suspicious TLDs (.xyz, .top, .loan, etc.)
- Risk scoring with confidence levels

### 6. Connect Gmail (optional but recommended)

1. Create an OAuth 2.0 Client ID (Desktop app) in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add the credentials to `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
3. Launch the app and click **Connect Gmail** in the dashboard – approve the consent screen
4. Tokens are stored locally in your user data folder (`gmail-tokens.json`) so you stay signed in

## Building

```bash
npm run build
```

The `build` script runs `electron-builder --dir`, producing packaged output under `dist/`.

## Project Structure

```
src/
  electron/
    main.js       # Electron main process entry
    preload.js    # Secure bridge between renderer and main
    renderer.js   # Dashboard + overlay controller for detection alerts
    index.html    # Cluely-style top-right alert template
  infra/
    fetchAgent.js    # Mock Fetch.ai agent call
    sandbox.js       # ✅ REAL URLScan.io VM-based URL analysis
    brightdata.js    # ✅ REAL Bright Data threat intelligence client
    email-verifier.js # ✅ REAL Email authenticity verification
    deepgram.js      # Mock Deepgram transcription helper
    index.js         # Orchestrates analyzeInput()
  core/
    scraper.js    # Data enrichment (combines URLScan + Bright Data)
    scorer.js     # Risk scoring across signals
    clipboard-monitor.js # Watches clipboard for URLs to auto-scan
    url-filter.js        # Whitelist/blacklist + heuristics for auto-scans
    scan-queue.js        # Rate-limited orchestration for URLScan.io jobs
  shared/
    types.js      # Shared enums/builders for assessment payloads
assets/
  icon.png        # App + tray icon
```

## Analysis Flow

1. Renderer calls `window.scamShield.analyze({ url, audioFile })` with the available inputs.
2. Preload bridges the call to the main process via IPC.
3. Main process fans out to analysis layers:
   - **URLScan.io** (REAL) - Submits URL to isolated VM sandbox, polls for results
   - **Bright Data** (REAL, optional) - Analyzes page for phishing indicators, fetches WHOIS data
   - Fetch.ai agent (mock) - Simulates agent-based investigation
   - Deepgram (mock) - Audio transcription for voice scams
4. Results are enriched via core scraper (combines URLScan + Bright Data signals).
5. Risk scorer combines all signals into a 0-100 risk score with explanations.
6. Main process returns assessment to the renderer and, on risky findings, flashes the overlay drop-down.

## Overlay UX

- Hidden by default so the app stays invisible on the desktop.
- Medium/high risk events animate a white & blue Cluely-style dropdown in the top-right corner.
- The tray menu exposes sample triggers to preview the animation while developing.
- The dashboard now surfaces recent suspicious Gmail messages and manual refresh controls once connected.

## What's Real vs Mock

✅ **Real Integrations:**
- URLScan.io VM sandbox analysis ([sandbox.js](src/infra/sandbox.js))
- Bright Data threat intelligence ([brightdata.js](src/infra/brightdata.js)) - Optional, requires API token
- Email authenticity verification ([email-verifier.js](src/infra/email-verifier.js)) - 90% accuracy on phishing detection
- Risk scoring algorithm ([scorer.js](src/core/scorer.js))
- Gmail OAuth connection (googleapis) with local token storage
- Clipboard & active window monitoring ([clipboard-monitor.js](src/core/clipboard-monitor.js))

🔄 **Mock Integrations (ready to swap):**
- Fetch.ai agent analysis ([fetchAgent.js](src/infra/fetchAgent.js))
- Deepgram transcription ([deepgram.js](src/infra/deepgram.js))

## Prompt Roles

Share these snippets with teammates so everyone can drop into their lane quickly:

- **⚡ Individual Codex/Claude Prompts** – Quick single-shot instructions for rapid iterations.
- **👩‍💻 Infra & Agent Engineer Prompt**
  - Wire additional agent intelligence into `src/infra/fetchAgent.js`.
  - Extend the URLScan-driven sandbox pipeline in `src/infra/sandbox.js`.
  - Flesh out Deepgram transcription in `src/infra/deepgram.js`.
  - Use `analyzeInput({ url, audioFile })` from `src/infra/index.js` to orchestrate inputs.
- **👨‍💻 Scraping & Scoring Engineer Prompt**
  - Extend `src/core/scraper.js` to mimic Bright Data enrichment (WHOIS, reputation, keywords).
  - Update `src/core/scorer.js` to reason over redirects, young domains, risky keywords, and transcripts.
- **🧑‍💻 UI & Shell Engineer Prompt**
  - Maintain the invisible Electron shell in `src/electron/main.js`.
  - Expose IPC bridge via `src/electron/preload.js`.
  - Shape the Cluely-style overlay in `src/electron/index.html` + `renderer.js`.

This repo is now staged so each role can open their respective files and begin prompting/coding in parallel.
