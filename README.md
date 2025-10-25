# CalHacks2025 Scam Detection Prototype

Electron application that analyzes URLs for scams using **real VM-based analysis via URLScan.io**. Features a lightweight system tray UI that sends URLs for analysis through multiple detection layers before returning a risk score notification.

## Features

- **Real URLScan.io Integration** - URLs are analyzed in isolated VMs with malware/phishing detection
- **Multi-Signal Risk Scoring** - Combines URL sandbox analysis, domain reputation, keyword detection
- **Invisible Tray Agent** - Runs silently and only surfaces a Cluely-style alert overlay on risky findings
- **Extensible Architecture** - Easy to add VirusTotal, PhishTank, and other threat intelligence sources

## Quick Start

### 1. Get URLScan.io API Key

1. Sign up at [https://urlscan.io/](https://urlscan.io/)
2. Get your API key from [https://urlscan.io/user/profile/](https://urlscan.io/user/profile/)

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your API key
# URLSCAN_API_KEY=your_api_key_here
```

### 3. Install & Run

```bash
npm install
npm start
```

`npm start` launches Electron with the system tray UI. Use the tray menu’s sample actions to trigger analyses and preview the alert overlay.

### 4. Test URLScan Integration

```bash
node test-urlscan.js https://example.com
```

**See [SETUP.md](SETUP.md) for detailed setup instructions and troubleshooting.**

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
    renderer.js   # Overlay controller for detection alerts
    index.html    # Cluely-style top-right alert template
  infra/
    fetchAgent.js # Mock Fetch.ai agent call
    sandbox.js    # ✅ REAL URLScan.io VM-based URL analysis
    deepgram.js   # Mock Deepgram transcription helper
    index.js      # Orchestrates analyzeInput()
  core/
    scraper.js    # Mock Bright Data enrichment
    scorer.js     # Risk scoring across signals
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
   - Fetch.ai agent (mock) - Simulates agent-based investigation
   - Deepgram (mock) - Audio transcription for voice scams
4. Results are enriched via core scraper (domain age, reputation, keywords).
5. Risk scorer combines all signals into a 0-100 risk score with explanations.
6. Main process returns assessment to the renderer and, on risky findings, flashes the overlay drop-down.

## Overlay UX

- Hidden by default so the app stays invisible on the desktop.
- Medium/high risk events animate a white & blue Cluely-style dropdown in the top-right corner.
- The tray menu exposes sample triggers to preview the animation while developing.

## What's Real vs Mock

✅ **Real Integrations:**
- URLScan.io VM sandbox analysis ([sandbox.js](src/infra/sandbox.js))
- Risk scoring algorithm ([scorer.js](src/core/scorer.js))

🔄 **Mock Integrations (ready to swap):**
- Fetch.ai agent analysis ([fetchAgent.js](src/infra/fetchAgent.js))
- Bright Data scraping ([scraper.js](src/core/scraper.js))
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
