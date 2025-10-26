# Detectify - AI-Powered Real-Time Scam Detection

Protect yourself from scams across emails, URLs, and messaging apps with AI-powered real-time monitoring. Detectify runs quietly in your system tray, analyzing threats before they reach you.

## Key Features

- **Reka AI Screen Monitoring** - Analyzes your entire screen with vision AI to detect scams in Instagram DMs, iMessage, WhatsApp, etc.
- **URLScan.io Integration** - Real VM-based URL analysis with malware/phishing detection
- **Gmail Integration** - OAuth-based email scanning with brand impersonation detection
- **Automatic URL Scanning** - Monitors clipboard and active windows
- **URL Caching** - Instant results for previously scanned URLs
- **Modern Dashboard** - Clean, glass-effect UI with real-time stats and history
- **Global Shortcuts** - `Cmd+Shift+C` (toggle UI), `Cmd+Shift+S` (scan screen)

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure API Keys

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
URLSCAN_API_KEY=your_urlscan_api_key

# Optional (for AI screen monitoring)
REKA_API_KEY=your_reka_api_key

# Optional (for enhanced detection)
BRIGHTDATA_API_TOKEN=your_brightdata_token

# Optional (for Gmail integration)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Get API Keys:**
- **URLScan.io** (required): [https://urlscan.io/user/profile/](https://urlscan.io/user/profile/)
- **Reka AI** (optional): [https://platform.reka.ai](https://platform.reka.ai)
- **Bright Data** (optional): [https://brightdata.com/](https://brightdata.com/)
- **Google OAuth** (optional): [Google Cloud Console](https://console.cloud.google.com/)

### 3. Run

```bash
npm start
```

Press `Cmd/Ctrl+Shift+C` to toggle the dashboard.

## How It Works

### Protection Layers

1. **URL Detection**
   - Automatically scans URLs from clipboard
   - Monitors active browser tabs
   - Manual scanning from dashboard

2. **Multi-Stage Analysis**
   - **URLScan.io**: VM sandbox analysis with screenshot capture
   - **Bright Data**: WHOIS, domain age, phishing indicators
   - **Risk Scoring**: Combines signals into 0-100 risk score
   - **Smart Caching**: Instantly shows cached results for known URLs

3. **Real-Time Alerts**
   - System notifications for threats
   - Top-right dropdown with risk details
   - Persistent scan history

### Reka AI Screen Monitoring

The standout feature - analyzes your entire screen with vision AI:

**Two Modes:**
- **Manual Mode**: Press `Cmd+Shift+S` to scan current screen
- **Auto-Scan Mode**: Automatically scans every 10 seconds

**Detects:**
- Phishing attempts in messages
- Urgency tactics and emotional manipulation
- Suspicious payment requests
- Brand impersonation
- Gift card scams

**Safe Scanning:**
- Notifications for both threats AND safe scans
- Risk scores logged to history
- Works across ANY app (Instagram, WhatsApp, iMessage, Telegram, etc.)

### Gmail Integration

1. Click "Connect Gmail" in dashboard
2. Approve OAuth (read-only access)
3. App scans recent emails for:
   - Brand impersonation (paypa1.com, g00gle.com)
   - Typosquatting
   - Suspicious urgency language
   - Young domain names
   - Known phishing patterns

## Dashboard

### Tabs

**Overview**
- Real-time protection status
- Quick stats (threats blocked, total scans)
- Gmail connection status
- Recent scan results

**History**
- Complete scan timeline with timestamps
- Risk scores and threat details
- Filter by risk level
- Export to CSV

**Settings**
- Toggle URL scanning
- Toggle Gmail monitoring
- Configure Reka AI (Manual/Auto-Scan)
- Adjust alert thresholds
- Sound and notification preferences

## Risk Scoring

**High Risk (70-100)**
- Flagged by URLScan.io as malicious
- Domain created < 7 days ago
- Multiple phishing indicators
- Known credential harvesting

**Medium Risk (40-69)**
- Young domains (< 30 days)
- Suspicious patterns detected
- Urgency language
- Brand impersonation attempts

**Low Risk (0-39)**
- Established domains
- No suspicious indicators
- Clean URLScan.io results
- Cached safe results

## Architecture

```
src/
├── electron/
│   ├── main.js              # Main process orchestration
│   ├── control.html/js      # Dashboard UI
│   ├── overlay.html/js      # Alert notifications
│   └── preload.js           # IPC bridge
├── core/
│   ├── reka-screen-monitor.js   # AI screen monitoring
│   ├── reka-vision.js           # Reka AI vision service
│   ├── clipboard-monitor.js     # Auto-detect clipboard URLs
│   ├── scan-queue.js            # Rate-limited URLScan.io queue
│   ├── scan-history.js          # Persistent scan tracking
│   ├── url-filter.js            # Whitelist/blacklist system
│   ├── scraper.js               # URLScan + Bright Data aggregation
│   └── scorer.js                # Multi-signal risk scoring
└── infra/
    ├── sandbox.js               # URLScan.io client
    ├── brightdata.js            # Bright Data client
    ├── email-verifier.js        # Email authenticity checker
    └── person-verifier.js       # LinkedIn verification
```

## Smart Features

### URL Caching
- Cached results show instantly with "Cached" badge
- 1-hour cache lifetime (configurable)
- Prevents redundant API calls
- Full scan history maintained

### Crash Prevention
- Invalid URLs handled gracefully
- Timeout protection (35s for URLScan, 20s for analysis pipeline)
- Memory monitoring with auto-cleanup
- Error fallbacks with safe defaults

### Smart Filtering
- 60+ whitelisted safe domains (google.com, github.com, etc.)
- Automatically skips known-safe sites
- Always scans shortened URLs and login pages
- Custom whitelist/blacklist support

## Security & Privacy

- **Zero data collection** - Everything runs locally
- **No screenshot storage** - AI analysis happens in real-time
- **OAuth 2.0** - Standard Google authentication
- **Encrypted tokens** - Gmail credentials stored securely
- **Optional monitoring** - All features can be disabled
- **Sandboxed analysis** - URLScan.io runs in isolated VMs

## Development

### Testing

```bash
# Test URLScan.io
node test-urlscan.js https://example.com

# Test Bright Data
node test-brightdata.js

# Test email verification
node test-email-verifier.js
```

### Building

```bash
npm run build
```

### Debugging

- Main process logs: Terminal output
- Renderer logs: DevTools (`Cmd+Option+I`)
- Look for `[ScamShield]`, `[RekaScreen]`, `[Gmail]` prefixes

## Troubleshooting

**Reka AI not working**
- Check `REKA_API_KEY` in `.env`
- Restart app after adding key
- Enable in Settings > Reka AI Vision Mode

**URLScan.io timeout**
- Normal: 2-3 minutes per scan
- Check API key validity
- Verify rate limits not exceeded

**Gmail connection failed**
- Enable Gmail API in Google Cloud Console
- Verify OAuth credentials
- Check redirect URI: `http://127.0.0.1:42862/oauth2callback`

## What's Real vs Mock

**Production-Ready:**
- URLScan.io VM sandbox analysis ✅
- Reka AI vision screen monitoring ✅
- Bright Data threat intelligence ✅
- Gmail OAuth integration ✅
- URL caching system ✅
- Clipboard & screen monitoring ✅
- Risk scoring & alerts ✅

**Mock (Future):**
- Fetch.ai agent analysis
- Deepgram audio transcription

## Tech Stack

- **Electron** - Desktop framework
- **URLScan.io** - URL sandbox analysis
- **Reka AI** - Vision AI for screen monitoring
- **Bright Data** - WHOIS & threat intelligence
- **Google APIs** - Gmail integration
- **Tesseract.js** - OCR for screen URLs

## Credits

Built for CalHacks 2025.

## License

MIT
