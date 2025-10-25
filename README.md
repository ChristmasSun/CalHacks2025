# CalHacks2025 Scam Detection Prototype

Starter Electron application that mocks a scam detection flow and surfaces a lightweight tray UI. The renderer can send URLs for analysis, which trickle through mock infra/core layers before returning a risk score notification.

## Getting Started

```bash
npm install
npm start
```

`npm start` launches Electron in development mode with the tray UI and hidden renderer window. Use the tray menu to show the window or trigger an example analysis.

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
    renderer.js   # Renderer logic + minimal UI interactions
    index.html    # Hidden UI for tray tooling & drag/drop
  infra/
    fetchAgent.js # Mock Fetch.ai agent call
    sandbox.js    # Mock Playwright/Puppeteer sandbox visit
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

## Mock Analysis Flow

1. Renderer calls `window.scamShield.analyze({ url, audioFile })` with the available inputs.
2. Preload bridges the call to the main process via IPC.
3. Main process fans out to the infra mocks (Fetch.ai, sandbox, Deepgram) and enriches via core scraping.
4. Main process returns the result to the renderer and shows a native notification.

You can use this scaffold to plug in real services, swap out the mock agents, and add richer UI elements.

## Prompt Roles

Share these snippets with teammates so everyone can drop into their lane quickly:

- **⚡ Individual Codex/Claude Prompts** – Quick single-shot instructions for rapid iterations.
- **👩‍💻 Infra & Agent Engineer Prompt**
  - Use Fetch.ai SDK to mock agent lookups (`src/infra/fetchAgent.js`).
  - Stub Playwright/Puppeteer visit flow (`src/infra/sandbox.js`).
  - Mock Deepgram transcription (`src/infra/deepgram.js`).
  - Use `analyzeInput({ url, audioFile })` from `src/infra/index.js` to fan out across mocks.
- **👨‍💻 Scraping & Scoring Engineer Prompt**
  - Extend `src/core/scraper.js` to mimic Bright Data enrichment (WHOIS, reputation, keywords).
  - Update `src/core/scorer.js` to reason over redirects, young domains, risky keywords, and transcripts.
- **🧑‍💻 UI & Shell Engineer Prompt**
  - Wire Electron tray-only shell in `src/electron/main.js`.
  - Expose IPC bridge via `src/electron/preload.js`.
  - Update `src/electron/index.html` + `renderer.js` for URL scans, audio drops, and toast notifications.

This repo is now staged so each role can open their respective files and begin prompting/coding in parallel.
