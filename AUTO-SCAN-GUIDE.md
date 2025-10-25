# Auto-Scan Feature Guide

## Overview

Your CalHacks scam detection app now **automatically scans URLs** that appear on your screen! No manual input needed - just copy a suspicious URL and the app detects and analyzes it in the background.

## How It Works

### Automatic Detection (Clipboard Monitoring)

1. **You copy any URL** from anywhere on your screen:
   - Email
   - Website
   - Message
   - Document
   - Literally anywhere

2. **App detects it instantly** (checks clipboard every 500ms)

3. **Smart filtering applied**:
   - ✅ Scans: Unknown domains, suspicious patterns, shortened URLs
   - ⏭️ Skips: Google.com, GitHub.com, and 60+ known-safe domains
   - 🔄 Deduplicates: Won't re-scan same URL within 1 hour

4. **URLScan.io analysis** (10-30 seconds):
   - Isolated VM execution
   - Malware/phishing detection
   - Network traffic analysis
   - Screenshot capture

5. **Alert appears** if dangerous:
   - System notification
   - Alert window (top-right corner)
   - Risk score + explanations

## User Interface

### System Tray Menu

Right-click the tray icon:

```
┌─────────────────────────────────┐
│ Open Dashboard                   │
├─────────────────────────────────┤
│ ✓ Auto-Scan Clipboard           │ ← Toggle on/off
│ View Scan Queue                  │ ← See pending scans
│ View Filter Stats                │ ← See what's being filtered
├─────────────────────────────────┤
│ Scan Example URL                 │
│ Analyze Sample Audio             │
├─────────────────────────────────┤
│ Quit                             │
└─────────────────────────────────┘
```

### Disabling Auto-Scan

If you want to temporarily disable automatic scanning:

1. Right-click system tray icon
2. Uncheck "Auto-Scan Clipboard"
3. URLs won't be scanned until you re-enable

## Smart Filtering

### Known-Safe Domains (Auto-Skipped)

The app won't scan these domains to save your URLScan.io quota:

**Search Engines:**
- google.com, bing.com, duckduckgo.com

**Social Media:**
- youtube.com, facebook.com, twitter.com, reddit.com, linkedin.com

**Tech/Dev:**
- github.com, gitlab.com, stackoverflow.com, npmjs.com

**E-commerce:**
- amazon.com, ebay.com, walmart.com

**Cloud Providers:**
- aws.amazon.com, azure.microsoft.com, cloud.google.com

**... and 40+ more trusted domains**

### Always Scanned (Suspicious Patterns)

These patterns **always** trigger a scan:

- Login pages (`/login`, `/signin`)
- Account verification URLs
- Payment updates
- Security alerts
- Shortened URLs (bit.ly, tinyurl, t.co)
- IP addresses in URLs
- Suspicious TLDs (.xyz, .top, .click with hyphens)

### Custom Rules

You can add your own whitelist/blacklist:

**Location:** `/Users/vedan/Documents/programming/CalHacks2025/user-rules.json`

```json
{
  "whitelist": [
    "mytrustedsite.com",
    "companyintranet.local"
  ],
  "blacklist": [
    "suspicious-domain.com"
  ]
}
```

The file is created automatically when you use the tray menu (future feature) or manually edit it.

## Deduplication & Caching

### How It Works

- **Scanned URLs are cached for 1 hour**
- Won't re-scan the same URL within that time
- Cache stores up to 500 URLs (LRU - oldest dropped first)
- Cache clears when app restarts

### Why This Matters

1. **Saves URLScan.io quota** - Free tier has limits
2. **Faster response** - Instant result for known URLs
3. **Reduces server load** - Be a good API citizen

## Scan Queue

### Why We Need It

URLScan.io takes 10-30 seconds per scan. If you copy multiple URLs quickly:

- They're added to a queue
- Processed one at a time
- Rate limited (2 seconds between submissions)

### Monitoring the Queue

Right-click tray → "View Scan Queue" shows:
```javascript
{
  totalQueued: 5,       // Total URLs ever queued
  totalProcessed: 3,    // Successfully scanned
  totalFailed: 0,       // Failed scans
  queueLength: 2,       // Currently waiting
  processing: true,     // Is a scan running?
  averageScanTime: 18000, // 18 seconds average
  estimatedWaitTime: 36000 // 36 seconds for 2 URLs
}
```

## Example Workflow

### Scenario: Suspicious Email

1. **Email arrives** with a link: `https://verify-paypal-secure.xyz/login`

2. **You copy the URL** (Cmd+C / Ctrl+C)

3. **App detects** (500ms later):
   ```
   [ClipboardMonitor] Detected URL: https://verify-paypal-secure.xyz/login
   [URLFilter] Blacklist pattern match (suspicious login URL)
   [ScamShield] Auto-scanning URL from clipboard...
   ```

4. **URLScan.io analyzes** (15 seconds):
   ```
   [URLScan] Submitting URL for analysis
   [URLScan] Scan submitted successfully. UUID: abc-123
   [URLScan] Waiting for scan to complete...
   [URLScan] Scan complete!
   ```

5. **Risk assessment** (instant):
   ```
   Risk Score: 85/100 (HIGH)
   - URLScan.io flagged as malicious
   - Phishing attempt detected
   - Domain age: 3 days old
   - Suspicious keyword: "verify"
   ```

6. **Alert appears**:
   - System notification pops up
   - Alert window in top-right corner
   - Shows risk details + recommendations

### Scenario: Safe URL

1. **You copy**: `https://github.com/anthropics/claude-code`

2. **App detects**:
   ```
   [ClipboardMonitor] Detected URL: https://github.com/anthropics/claude-code
   [URLFilter] Global whitelist match: github.com
   [ScamShield] URL filtered (known-safe domain), skipping
   ```

3. **No scan performed** - saves quota & time

## Technical Details

### Architecture

```
Clipboard → Monitor (500ms poll)
              ↓
         URL Filter
         (whitelist/blacklist)
              ↓
         Scan Cache
         (dedupe check)
              ↓
         Scan Queue
         (rate limiting)
              ↓
         URLScan.io
         (VM analysis)
              ↓
         Risk Scorer
         (aggregate signals)
              ↓
         Alert System
         (notifications)
```

### Files Involved

- **[src/core/clipboard-monitor.js](src/core/clipboard-monitor.js)** - Clipboard polling
- **[src/core/url-filter.js](src/core/url-filter.js)** - Whitelist/blacklist logic
- **[src/core/scan-queue.js](src/core/scan-queue.js)** - Queue management
- **[src/electron/main.js](src/electron/main.js)** - Integration layer

### Performance Impact

- **CPU:** < 1% (clipboard polling is very light)
- **Memory:** ~50MB for LRU cache + queues
- **Network:** Only when scanning (URLScan.io API)
- **Battery:** Minimal impact

## Limitations

### What It CAN Do

✅ Auto-detect URLs from clipboard
✅ Filter known-safe domains
✅ Queue multiple URLs
✅ Cache results for 1 hour
✅ Provide detailed risk analysis
✅ Show alerts for dangerous URLs

### What It CANNOT Do

❌ Detect URLs you haven't copied
❌ Scan URLs you only view (don't copy)
❌ Detect URLs in images (no OCR yet)
❌ Scan private/localhost URLs
❌ Bypass URLScan.io rate limits

### Future Enhancements (Not Yet Implemented)

- **Active window monitoring** - Scan URLs in browser tabs automatically
- **Browser extension** - Seamless integration with Chrome/Firefox
- **OCR scanning** - Detect URLs in screenshots
- **Bulk import** - Scan multiple URLs from file

## Troubleshooting

### URLs Not Being Detected

**Check:**
1. Is clipboard monitoring enabled? (Tray menu should show ✓)
2. Did you actually copy the URL? (Cmd+C / Ctrl+C)
3. Is it a valid URL format? (Must start with http:// or https://)

**Debug:**
```bash
# Run with debug logging
npm start
# Copy a URL and check console logs
```

### URLs Being Skipped

**Likely reasons:**
1. **Known-safe domain** - Check filter stats in tray menu
2. **Already scanned** - Cached for 1 hour
3. **Already in queue** - Check scan queue stats
4. **Invalid URL format** - Must be http(s)://

**Override:**
- Right-click tray → "Scan Example URL" to manually trigger
- Edit `user-rules.json` to blacklist a domain (forces scan)

### Scans Taking Too Long

URLScan.io typically takes 10-30 seconds:

- **Normal:** 10-15 seconds for simple pages
- **Slow:** 20-30 seconds for complex pages
- **Timeout:** 60 seconds maximum (then fails gracefully)

**If consistently slow:**
- Check URLScan.io status: https://status.urlscan.io/
- Verify your internet connection
- Check if you hit rate limits: https://urlscan.io/user/quotas/

### Too Many Scans

If you're burning through your URLScan.io quota:

1. **Disable auto-scan temporarily** (tray menu)
2. **Expand whitelist** in `user-rules.json`
3. **Check filter stats** - see what's being scanned
4. **Increase cache TTL** in main.js (currently 1 hour)

## Console Logs

### Normal Operation

```
[ScamShield] App ready
[ClipboardMonitor] Starting clipboard monitoring (checking every 500ms)
[URLFilter] Loaded user rules: { whitelist: 0, blacklist: 0 }
[ScamShield] Auto-scanning enabled (clipboard monitoring active)

[ClipboardMonitor] Detected URL: https://example.com
[URLFilter] Unknown URL, will scan: example.com
[ScamShield] Auto-scanning URL from clipboard...
[ScanQueue] Queued https://example.com (priority: 0, queue length: 1)
[ScanQueue] Starting queue processing (1 items)
[URLScan] Submitting URL for analysis: https://example.com
[URLScan] Scan submitted successfully. UUID: 123-abc
[URLScan] Waiting for scan to complete...
[URLScan] Scan complete!
[ScamShield] No alert needed (risk: low)
```

### With Filtering

```
[ClipboardMonitor] Detected URL: https://github.com/user/repo
[URLFilter] Global whitelist match: github.com
[ScamShield] URL filtered (known-safe domain), skipping
```

### With Alert

```
[ScamShield] Showing alert for https://suspicious.com (risk: high)
```

## Privacy & Security

### What Data Leaves Your Machine

**To URLScan.io:**
- The URL you copy (if not whitelisted)
- Your API key (for authentication)

**Nowhere else:**
- No clipboard content (except URLs)
- No screenshots
- No personal data

### URLScan.io Privacy

- **Free tier:** Scans are PUBLIC on URLScan.io
- **Don't scan:** Private URLs, localhost, internal tools
- **Paid tier:** Private scanning available

### Best Practices

1. **Don't copy sensitive URLs** while auto-scan is on
2. **Whitelist internal domains** in user-rules.json
3. **Disable auto-scan** when working with private systems
4. **Review URLScan.io submissions** at https://urlscan.io/user/submissions/

## Statistics

### Viewing Stats

**Scan Queue Stats:**
Right-click tray → "View Scan Queue" → Check console

**Filter Stats:**
Right-click tray → "View Filter Stats" → Check console

**Example Output:**
```javascript
// Filter stats
{
  totalChecked: 147,    // Total URLs checked
  whitelisted: 102,     // Skipped (safe)
  blacklisted: 12,      // Forced scan (suspicious)
  scanned: 33           // Scanned (unknown)
}

// Queue stats
{
  totalQueued: 33,
  totalProcessed: 31,
  totalFailed: 2,
  queueLength: 0,
  processing: false,
  averageScanTime: 14523  // 14.5 seconds
}
```

## Demo Tips

### For Hackathon Demo

**Prepare test URLs:**
```bash
# Safe URL (will be filtered)
echo "https://github.com/test" | pbcopy

# Suspicious URL (will be scanned)
echo "https://verify-account-urgent.xyz/login" | pbcopy

# Shortened URL (always scanned)
echo "https://bit.ly/suspicious" | pbcopy
```

**Show the flow:**
1. Start the app
2. Show tray menu (auto-scan is ON)
3. Copy safe URL → Shows "filtered" in console
4. Copy suspicious URL → Triggers scan → Shows alert
5. Show scan queue stats
6. Show filter stats

**Talking points:**
- "Completely automatic - no user input needed"
- "Smart filtering saves API quota"
- "Deduplication prevents repeat scans"
- "Real VM-based analysis via URLScan.io"
- "Graceful queue handling for multiple URLs"

## Summary

**Auto-scanning is now live!** Just copy any URL and the app handles the rest:

1. ✅ Automatic detection (clipboard)
2. ✅ Smart filtering (whitelist/blacklist)
3. ✅ Deduplication (1-hour cache)
4. ✅ Queue management (rate limiting)
5. ✅ Real analysis (URLScan.io VMs)
6. ✅ Instant alerts (if dangerous)

**No permissions needed.** No screen recording. Just clipboard access built into Electron.

**Try it now:**
1. `npm start`
2. Copy any URL
3. Watch the magic happen!

---

**Questions?** Check [SETUP.md](SETUP.md) for URLScan.io configuration or [INTEGRATION-SUMMARY.md](INTEGRATION-SUMMARY.md) for technical details.
