# Cluely - Real-Time Scam Detection

**Cluely** is an Electron-based desktop app that continuously monitors your screen for potential scams, including suspicious links, fake personas, and phishing attempts on platforms like LinkedIn, Instagram, email, etc.

## Features

- **🔍 Real-time Screen Monitoring**: Automatically scans your screen every 3 seconds
- **⚠️ Smart Overlays**: Warning badges appear in the corner when scams are detected
- **📊 Risk Assessment**: Shows percentage likelihood + detailed explanation
- **🎛️ Control Panel**: Start/stop monitoring and trigger manual scans
- **🪟 Transparent Overlays**: Non-intrusive warnings that don't block your work

## Getting Started

### Option 1: Quick Test with Mock Backend (Recommended for MVP Testing)

```bash
# Install dependencies
npm install

# Terminal 1 - Start the temporary mock backend
node temp-backend.js

# Terminal 2 - Start the Electron app
npm start
```

The mock backend generates random scam scenarios for testing. **DELETE `temp-backend.js` when you have your real backend ready.**

### Option 2: With Your Real Backend

Make sure your backend is running on `http://localhost:8000/detect`, then:

```bash
npm install
npm start
```

### What Opens

The app opens with:
1. **Control Panel** (small window) - Start/stop monitoring
2. **Transparent Overlay** (full-screen, click-through) - Shows warning badges when you start monitoring

## Building

```bash
npm run build
```

The `build` script runs `electron-builder --dir`, producing packaged output under `dist/`.

## How It Works

### Architecture

```
src/electron/
  ├── main.js        # Main process - handles screen capture & monitoring
  ├── preload.js     # IPC bridge for security
  ├── control.html   # Control panel UI
  ├── control.js     # Control panel logic
  ├── overlay.html   # Transparent overlay UI
  ├── overlay.js     # Warning badge display logic
  └── style.css      # Shared styles
```

### Flow

1. **User clicks "Start Monitoring"** in control panel
2. **Main process creates transparent overlay** window (full-screen, click-through)
3. **Every 3 seconds**:
   - Captures screenshot of primary display
   - Sends base64 image to `http://localhost:8000/detect`
   - Backend returns `{ risk: number, reason: string }`
4. **If risk > 30%**: Shows warning badge on overlay with:
   - 🚨 Icon (animated pulse)
   - Risk percentage
   - Explanation text
   - Auto-dismisses after 5 seconds
5. **Control panel** shows latest scan result in real-time

### Warning Levels

- **🚨 High Risk (>70%)**: Red badge with urgent warning
- **⚠️ Medium Risk (40-70%)**: Orange badge
- **ℹ️ Low Risk (30-40%)**: Blue informational badge
- **<30%**: No warning shown

## Backend API Requirements

Your backend must expose a POST endpoint:

```
POST http://localhost:8000/detect
Content-Type: application/json

{
  "image": "<base64-encoded-png>"
}

Response:
{
  "risk": 85,
  "reason": "Detected potential phishing link with suspicious domain pattern"
}
```

## Configuration

Edit [main.js](src/electron/main.js:94) to adjust:
- **Scan interval**: Change `3000` (3 seconds) to your preference
- **Risk threshold**: Change `30` to adjust when warnings appear
- **Backend URL**: Update `http://localhost:8000/detect`
