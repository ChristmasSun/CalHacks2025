# URLScan.io Integration Setup Guide

## Overview
This project now uses **URLScan.io** for real VM-based URL analysis. URLScan.io runs URLs in an isolated sandbox and provides:
- Screenshots of the page
- DOM analysis
- Network traffic inspection
- Redirect chain tracking
- Malware/phishing detection
- Security verdicts from multiple engines

## Quick Start

### 1. Get Your URLScan.io API Key

1. Go to [https://urlscan.io/](https://urlscan.io/)
2. Create a free account (Sign Up in top right)
3. Verify your email
4. Go to your profile: [https://urlscan.io/user/profile/](https://urlscan.io/user/profile/)
5. Find your **API Key** in the "API" section
6. Copy the API key

### 2. Configure Environment Variables

1. Create a `.env` file in the project root:
```bash
cp .env.example .env
```

2. Edit `.env` and add your API key:
```bash
URLSCAN_API_KEY=your_actual_api_key_here
URLSCAN_VISIBILITY=public
```

**Important Notes:**
- `URLSCAN_VISIBILITY=public` means your scans will be publicly visible on URLScan.io
- For private scans, you need a paid plan and can set `URLSCAN_VISIBILITY=private`
- Never commit `.env` to git (it's already in `.gitignore`)

### 3. Install Dependencies

```bash
npm install
```

### 4. Test the Integration

You can test the URLScan.io integration with a sample URL:

```bash
node -e "
require('dotenv').config();
const { inspectUrlInSandbox } = require('./src/infra/sandbox.js');

inspectUrlInSandbox('https://example.com')
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => console.error('Error:', err.message));
"
```

Expected output:
- `[URLScan] Submitting URL for analysis: https://example.com`
- `[URLScan] Scan submitted successfully. UUID: <some-uuid>`
- `[URLScan] Waiting for scan to complete...`
- `[URLScan] Scan complete!`
- JSON output with security analysis

### 5. Run the App

```bash
npm start
```

The Electron app will start with a system tray icon. You can:
- Click the tray icon to show the scanner window
- Right-click the tray for options
- Use "Scan Example URL" to test URLScan integration

## How It Works

### Architecture

```
User Input (URL)
    ↓
src/electron/main.js (orchestrateAnalysis)
    ↓
src/infra/index.js (analyzeInput)
    ↓
src/infra/sandbox.js (inspectUrlInSandbox) ← URLScan.io API
    ↓
src/core/scraper.js (enrichWithScrapedMetadata)
    ↓
src/core/scorer.js (scoreRisk)
    ↓
Electron Notification + UI Update
```

### URLScan.io Integration Flow

1. **Submit Scan** (`submitScan` in sandbox.js)
   - POST to `https://urlscan.io/api/v1/scan/`
   - Returns a UUID for the scan
   - Tags: `scam-detection`, `calhacks2025`

2. **Poll for Results** (`pollResults` in sandbox.js)
   - GET `https://urlscan.io/api/v1/result/{uuid}/`
   - Polls every 2 seconds (up to 30 attempts = 60 seconds)
   - URLScan.io typically takes 10-30 seconds to complete

3. **Extract Security Signals** (`extractSecuritySignals` in sandbox.js)
   - Parses URLScan.io response
   - Extracts: redirects, network requests, DOM flags, verdicts
   - Detects: login forms, suspicious keywords, malicious behavior

4. **Score Risk** (`scoreRisk` in scorer.js)
   - Combines URLScan.io verdicts with other signals
   - Calculates risk score (0-100)
   - Generates human-readable explanations

## URLScan.io Data Structure

The `inspectUrlInSandbox` function returns:

```javascript
{
  url: "https://example.com",
  hostname: "example.com",
  observedAt: "2025-10-25T07:00:00.000Z",
  redirects: ["https://example.com"],
  networkRequests: 15,
  thirdPartyDomains: 3,
  domFlags: [
    {
      selector: "form[action*='login']",
      issue: "Credential form detected"
    }
  ],
  verdicts: {
    overall: { malicious: false, score: 0 },
    urlscan: { ... },
    engines: { ... },
    community: { ... }
  },
  lists: {
    ips: [...],
    urls: [...],
    domains: [...]
  },
  security: {
    score: 0,
    malicious: false,
    hasPhishing: false,
    hasMalware: false
  },
  meta: {
    server: "nginx",
    ip: "93.184.216.34",
    asn: "AS15133",
    asnname: "EDGECAST",
    country: "US"
  },
  screenshot: "https://urlscan.io/screenshots/...",
  reportUrl: "https://urlscan.io/result/{uuid}/"
}
```

## Rate Limits

**Free Tier Limits:**
- Check your account at [https://urlscan.io/user/quotas/](https://urlscan.io/user/quotas/)
- Typically: Several hundred scans per day
- Rate limiting is automatic - the API will return errors if you exceed limits

**Handling Rate Limits:**
- The code includes error handling and graceful degradation
- If URLScan fails, the app returns minimal data and continues
- Consider implementing caching for frequently scanned URLs

## Troubleshooting

### Error: "URLSCAN_API_KEY not set"
- Make sure `.env` file exists in project root
- Verify `URLSCAN_API_KEY=...` is set (no quotes needed)
- Restart the app after creating `.env`

### Error: "URLScan submission failed: 401"
- Your API key is invalid or expired
- Get a new API key from [https://urlscan.io/user/profile/](https://urlscan.io/user/profile/)

### Error: "URLScan submission failed: 429"
- You've hit rate limits
- Wait a few minutes and try again
- Check your quotas at [https://urlscan.io/user/quotas/](https://urlscan.io/user/quotas/)

### Error: "URLScan timeout: Scan took too long to complete"
- URLScan.io is experiencing delays (rare)
- Current timeout: 60 seconds (30 polls × 2 seconds)
- Try again or increase `MAX_POLL_ATTEMPTS` in sandbox.js

### Scan Returns "error" Field
- The scan failed but the app continued gracefully
- Check console logs for specific error messages
- Verify the URL is valid and accessible

## Testing with Known Scam URLs

**⚠️ WARNING:** Only test with URLs in a safe environment!

URLScan.io is safe to use with malicious URLs because:
- URLs are analyzed in isolated VMs
- No downloads to your machine
- Results viewed through API/web interface

Example test URLs (use at your own risk):
- PhishTank database: [https://phishtank.org/](https://phishtank.org/)
- URLhaus malware URLs: [https://urlhaus.abuse.ch/browse/](https://urlhaus.abuse.ch/browse/)

**Always:**
- Use URLScan.io to analyze, never visit directly
- Don't download files from suspicious URLs
- Check with your team before testing

## Next Steps

Now that URLScan.io is integrated, you can:

1. **Enhance Detection Logic** (scorer.js)
   - Add more sophisticated scoring based on URLScan data
   - Weight different signals appropriately
   - Fine-tune risk thresholds

2. **Add More API Integrations**
   - VirusTotal for multi-engine malware detection
   - PhishTank for phishing-specific checks
   - URLhaus for threat intelligence

3. **Improve UI**
   - Show screenshots from URLScan.io
   - Display network graph
   - Link to full URLScan.io report

4. **Add Caching**
   - Cache results to avoid re-scanning same URLs
   - Use Redis or simple in-memory cache
   - Expire cache after reasonable time (e.g., 1 hour)

## Resources

- **URLScan.io API Docs:** [https://urlscan.io/docs/api/](https://urlscan.io/docs/api/)
- **URLScan.io Search:** [https://urlscan.io/search/](https://urlscan.io/search/)
- **Your Scans:** [https://urlscan.io/user/submissions/](https://urlscan.io/user/submissions/)
- **API Quotas:** [https://urlscan.io/user/quotas/](https://urlscan.io/user/quotas/)

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify your `.env` configuration
3. Test API key manually: `curl -H "API-Key: YOUR_KEY" https://urlscan.io/api/v1/user/quotas/`
4. Check URLScan.io status: [https://status.urlscan.io/](https://status.urlscan.io/)

Happy hacking! 🎉
