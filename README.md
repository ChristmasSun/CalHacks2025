# Detectify - AI-Powered Scam Detection

Real-time scam detection platform that protects users across emails, URLs, and screen content using advanced AI analysis and threat intelligence.

## Features

### Core Protection
- **Real URLScan.io Integration** - Analyzes URLs in isolated VMs with malware/phishing detection
- **Reka AI Screen Monitoring** - Full-screen AI analysis to detect scams in any app (Instagram DMs, iMessage, WhatsApp, etc.)
- **Gmail Integration** - OAuth-based email scanning with AI-powered verification
- **Email Authenticity Verification** - Detects brand impersonation, typosquatting, and phishing
- **Bright Data Threat Intelligence** - Enhanced scam detection with WHOIS and phishing indicators
- **Clipboard Monitoring** - Auto-detects and analyzes copied URLs
- **Screen OCR Monitoring** - Extracts and scans URLs visible on screen

### User Experience
- **Pristine White Dashboard** - Clean, modern UI with onboarding flow
- **System Tray Integration** - Runs silently in background with quick access
- **Global Keyboard Shortcuts**:
  - `Cmd/Ctrl+Shift+C` - Toggle dashboard
  - `Cmd/Ctrl+Shift+S` - Manual Reka AI screen scan
- **Real-time Alerts** - Top-right dropdown notifications for threats
- **Scan History & Analytics** - Track all scans with detailed stats and timeline
- **Settings Panel** - Customize monitoring, notifications, and thresholds

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# Required
URLSCAN_API_KEY=your_urlscan_api_key

# Optional but recommended
REKA_API_KEY=your_reka_api_key
BRIGHTDATA_API_TOKEN=your_brightdata_token
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

### 3. Get API Keys

**URLScan.io (Required):**
1. Sign up at [https://urlscan.io/](https://urlscan.io/)
2. Get API key from [profile page](https://urlscan.io/user/profile/)

**Reka AI (Optional - for screen monitoring):**
1. Sign up at [https://platform.reka.ai](https://platform.reka.ai)
2. Get API key from dashboard

**Bright Data (Optional - for enhanced detection):**
1. Sign up at [https://brightdata.com/](https://brightdata.com/)
2. Get API token from dashboard

**Google OAuth (Optional - for Gmail integration):**
1. Create project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Gmail API
3. Create OAuth 2.0 Desktop App credentials
4. Add credentials to `.env`

### 4. Run the App

```bash
npm start
```

Press `Cmd/Ctrl+Shift+C` to show/hide the dashboard.

## Architecture

### Project Structure

```
src/
├── electron/
│   ├── main.js          # Main process - orchestrates everything
│   ├── preload.js       # IPC bridge (secure)
│   ├── control.js       # Dashboard UI controller
│   ├── control.html     # Main dashboard
│   ├── overlay.js       # Alert overlay controller
│   └── overlay.html     # Top-right alert notifications
├── core/
│   ├── clipboard-monitor.js    # Auto-detect URLs from clipboard
│   ├── screen-ocr-monitor.js   # Extract URLs from screen via OCR
│   ├── reka-screen-monitor.js  # AI-powered full-screen analysis
│   ├── reka-vision.js          # Reka AI vision service
│   ├── scan-queue.js           # Rate-limited URLScan.io queue
│   ├── scan-history.js         # Persistent scan tracking
│   ├── url-filter.js           # Whitelist/blacklist system
│   ├── scraper.js              # Combines URLScan + Bright Data
│   └── scorer.js               # Multi-signal risk scoring
└── infra/
    ├── sandbox.js              # URLScan.io VM analysis
    ├── brightdata.js           # Bright Data client
    ├── email-verifier.js       # Email authenticity checker
    ├── person-verifier.js      # LinkedIn profile verification
    ├── fetchAgent.js           # Fetch.ai agent (mock)
    └── deepgram.js             # Audio transcription (mock)
```

### Analysis Flow

1. **URL Detection**
   - Clipboard monitor detects copied URLs
   - Screen OCR extracts URLs from screen
   - Manual input from dashboard
   - Active window monitoring

2. **Filtering & Queuing**
   - URL filter checks whitelist/blacklist
   - Scan cache deduplicates recent scans
   - Queue manages URLScan.io rate limits

3. **Analysis Layers**
   - **URLScan.io**: VM sandbox analysis (2-3 min)
   - **Bright Data**: WHOIS, phishing indicators, brand analysis
   - **Risk Scorer**: Combines all signals into 0-100 score

4. **Alert & Storage**
   - High-risk URLs trigger overlay alerts
   - All scans saved to history
   - Stats updated in real-time

### Reka AI Screen Monitoring

The crown jewel feature - monitors your entire screen with AI vision:

1. **Setup**: Enable in Settings > AI Screen Monitor
2. **Modes**:
   - **Manual Check**: Press `Cmd+Shift+S` to scan
   - **Always Check**: Automatic scans every 30 seconds
3. **Analysis**: Reka AI analyzes screenshot for:
   - Phishing attempts
   - Urgency tactics
   - Emotional manipulation
   - Suspicious requests (money, credentials, gift cards)
   - Impersonation attempts
4. **Alerts**: Risk score ≥ 40 triggers dropdown alert with:
   - Risk percentage
   - Threat summary
   - Specific threats detected
   - Recommendations

### Gmail Integration

1. Click **Connect Gmail** in dashboard
2. Approve OAuth consent
3. App scans recent emails (last 14 days)
4. Email verification checks:
   - Brand impersonation
   - Typosquatting (paypa1.com, g00gle.com)
   - Domain age and reputation
   - Urgency/pressure language
   - Suspicious keywords
5. Toggle **Gmail Monitoring** in Settings to enable/disable

### Clipboard Monitoring

Automatically detects URLs copied to clipboard:

1. Monitors clipboard every 500ms
2. Smart filtering:
   - Skips known-safe domains (google.com, github.com, etc.)
   - Always scans suspicious patterns (login pages, shortened URLs)
3. LRU cache (1-hour TTL) deduplicates scans
4. Rate-limited queue respects URLScan.io limits

## Features in Detail

### Dashboard Tabs

**Overview**
- Real-time protection status
- Quick stats (threats blocked, scans, safe URLs)
- Gmail connection status

**History**
- Recent scans with timestamps
- Risk scores and reasons
- Filter by risk level
- Export to CSV

**Settings**
- URL Scanning toggle
- Gmail Monitoring toggle
- AI Screen Monitor (Manual/Always)
- Sound alerts
- Desktop notifications

### Risk Scoring

Risk scores (0-100) combine multiple signals:

**High Risk (70-100):**
- URLScan.io flagged as malicious
- Very young domains (< 7 days)
- Multiple phishing indicators
- Known malware/credential harvesting

**Medium Risk (40-69):**
- Moderate age domains (< 30 days)
- Some suspicious patterns
- Urgency language detected
- Personal email for business

**Low Risk (0-39):**
- Established domains
- No suspicious indicators
- Clean URLScan.io results

### Alert System

**Overlay Alerts:**
- Top-right corner dropdown
- Shows risk percentage
- Brief threat summary
- Click "Learn More" for:
  - Detection signals
  - Specific threats found
  - Recommended actions
- Auto-dismiss after 30 seconds (high-risk stays longer)

**Scan History:**
- All scans logged to disk
- Persistent across app restarts
- Exportable to CSV
- Clear history option in Settings

### Whitelist/Blacklist

Located in `url-whitelist-blacklist.json`:

**Default Whitelist (60+ domains):**
- google.com, github.com, microsoft.com
- stanford.edu, berkeley.edu
- netflix.com, spotify.com
- etc.

**Custom Rules:**
```json
{
  "whitelist": ["mytrustedsite.com"],
  "blacklist": ["knownscam.xyz"],
  "suspiciousPatterns": ["login", "verify", "urgent"]
}
```

## Development

### Testing Individual Components

```bash
# Test URLScan.io integration
node test-urlscan.js https://example.com

# Test Bright Data WHOIS
node test-brightdata.js

# Test email verification
node test-email-verifier.js

# Test LinkedIn verification
node test-linkedin-verification.js
```

### Building for Production

```bash
npm run build
```

Output in `dist/` directory.

### Debugging

**Main Process:**
```bash
# Logs appear in terminal
npm start
```

**Renderer Process:**
- Open DevTools: `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
- Console logs show UI events

**IPC Communication:**
- Look for `[ScamShield]`, `[RekaScreen]`, `[Gmail]` prefixes in logs

## Configuration

### Environment Variables

```env
# Required
URLSCAN_API_KEY=your_api_key

# Optional - Reka AI (screen monitoring)
REKA_API_KEY=your_reka_key

# Optional - Bright Data (enhanced detection)
BRIGHTDATA_API_TOKEN=your_token

# Optional - Gmail integration
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:42862/oauth2callback

# Optional - Deepgram (future)
DEEPGRAM_API_KEY=your_key
```

### Settings Storage

- **Renderer Settings**: `localStorage` in renderer process
- **Scan History**: `~/Library/Application Support/calhacks2025/scan-history.json`
- **Gmail Tokens**: `~/Library/Application Support/calhacks2025/gmail-tokens.json`
- **URL History**: `./url-history.json`
- **User Rules**: `./url-whitelist-blacklist.json`

### Customization

**Change Alert Threshold:**
```javascript
// In main.js
rekaScreenMonitor = new RekaScreenMonitor({
  alertThreshold: 50, // Default: 40
  // ...
});
```

**Change Scan Intervals:**
- Manual mode: 999999999ms (essentially disabled)
- Always mode: 30000ms (30 seconds)
- Adjust via Settings UI

## API Integrations

### URLScan.io

**What it provides:**
- VM-based URL analysis
- Screenshot capture
- Network traffic analysis
- Redirect chain tracking
- Malware/phishing detection
- Security verdicts from multiple engines

**Rate limits:**
- Free tier: 50 scans/day
- Paid: Higher limits

### Reka AI

**What it provides:**
- Multimodal vision AI
- Screenshot analysis
- Text recognition and understanding
- Context-aware scam detection
- Structured JSON responses

**Models used:**
- `reka-flash`: Fast vision-capable model

### Bright Data

**What it provides:**
- Real-time WHOIS data
- Domain age verification
- Phishing indicator detection
- Brand impersonation analysis
- Urgency language detection
- Obfuscated script detection

### Google Gmail API

**What it provides:**
- OAuth 2.0 authentication
- Read-only access to messages
- Message metadata (subject, from, date)
- Message snippets
- Refresh tokens for persistent access

## Troubleshooting

**"Reka AI monitoring not available"**
- Check `REKA_API_KEY` in `.env`
- Restart the app after adding the key
- Test connection: logs show "Reka AI connected successfully"

**"URLScan.io timeout"**
- Scans take 2-3 minutes normally
- Check your API key is valid
- Verify rate limits not exceeded

**"Gmail connection failed"**
- Ensure Gmail API is enabled in Google Cloud Console
- Check OAuth credentials are correct
- Verify redirect URI matches: `http://127.0.0.1:42862/oauth2callback`

**Stats showing old data**
- Demo mode was auto-enabled (now disabled)
- Clear history: Settings > Clear All History
- Delete scan history file manually if needed

**Traffic light buttons covering content**
- Fixed with proper padding in dashboard header
- `padding-top: 48px` and `padding-left: 90px`

## Security & Privacy

- **No data collection**: Everything runs locally
- **Encrypted storage**: Gmail tokens stored securely
- **OAuth 2.0**: Standard Google authentication
- **No screenshots stored**: Reka AI analysis happens in real-time
- **Optional monitoring**: All features can be disabled
- **Sandboxed analysis**: URLScan.io runs in isolated VMs

## What's Real vs Mock

**Real & Production-Ready:**
- URLScan.io VM sandbox analysis
- Reka AI vision screen monitoring
- Bright Data threat intelligence
- Gmail OAuth integration
- Email authenticity verification
- Risk scoring algorithm
- Clipboard & screen monitoring
- Scan history & analytics
- Alert overlay system

**Mock (Ready to Implement):**
- Fetch.ai agent analysis
- Deepgram audio transcription

## Future Enhancements

- [ ] Browser extension
- [ ] Mobile app (iOS/Android)
- [ ] SMS/iMessage integration
- [ ] Phone call screening
- [ ] VirusTotal integration
- [ ] PhishTank integration
- [ ] Machine learning model training
- [ ] Community threat sharing

## Credits

Built for CalHacks 2025.

**Technologies:**
- Electron - Desktop framework
- URLScan.io - URL sandbox analysis
- Reka AI - Vision AI
- Bright Data - Threat intelligence
- Google APIs - Gmail integration
- Tesseract.js - OCR (screen monitoring)

## License

MIT
