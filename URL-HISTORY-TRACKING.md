# URL History Tracking Implementation

## Overview
The app now tracks previously scanned URLs and prevents duplicate scans. This improves performance by avoiding unnecessary re-scans and reduces load on the scanning services.

## How It Works

### 1. **URL History Module** (`src/core/url-history.js`)
- Maintains a persistent history of scanned URLs
- Uses URL fingerprinting to normalize URLs (removes query params and fragments)
- Stores metadata: timestamp, risk score, risk level, summary
- Auto-expires entries after 30 days (configurable)
- Limits history to 10,000 URLs (configurable)
- Persists history to `url-history.json`

**Key Methods:**
- `hasBeenScanned(url)` - Check if URL was previously scanned
- `getHistory(url)` - Retrieve cached scan result
- `recordScan(url, result)` - Record a new scan
- `clearHistory()` - Reset all history
- `getStats()` - Get tracking statistics

### 2. **Scan Queue Integration** (`src/core/scan-queue.js`)
- Before adding a URL to the scan queue, checks if it's in history
- If found and still valid (within 30 days), returns cached result immediately
- If new, performs the scan and records it in history
- Updated stats: `totalSkipped` tracks duplicate attempts

**Flow:**
```
URL enqueue request
    ↓
Check history.hasBeenScanned()
    ↓
Found in history? → Return cached result (instant, counted as skipped)
    ↓
Not in history? → Add to queue for scanning
    ↓
After scan completes → urlHistory.recordScan()
```

### 3. **Clipboard Monitor Integration** (`src/core/clipboard-monitor.js`)
- When a URL is detected in clipboard, checks if already scanned
- If already scanned, logs and skips triggering scan (configurable)
- Prevents clipboard monitor from triggering duplicate scans
- Can be disabled via `skipAlreadyScanned` option

## Data Persistence

History is stored in `url-history.json` at the project root:

```json
[
  {
    "url": "https://example.com/page",
    "fingerprint": "sha256_hash",
    "timestamp": 1729881234567,
    "scanDate": "2025-10-25T14:20:34.567Z",
    "riskScore": 45,
    "riskLevel": "medium",
    "summary": "Suspicious patterns detected"
  }
]
```

## Configuration

### URLHistory Options
```javascript
const history = new URLHistory({
  maxSize: 10000,        // Max URLs to track (default: 10000)
  retentionDays: 30      // Keep history for N days (default: 30)
});
```

### ClipboardMonitor Options
```javascript
const monitor = new ClipboardMonitor({
  pollInterval: 500,           // Check clipboard every 500ms (default: 500)
  skipAlreadyScanned: true     // Skip duplicate URLs (default: true)
});
```

## Statistics

The ScanQueue now tracks:
- `totalQueued` - URLs added to queue
- `totalProcessed` - URLs actually scanned
- `totalFailed` - Scans that failed
- `totalSkipped` - URLs skipped due to history match
- `averageScanTime` - Average time per scan

Access via: `scanQueue.getStats()`

## URL Fingerprinting

URLs are normalized before tracking to handle variations:

```
https://example.com/page?foo=bar&baz=qux
https://example.com/page?baz=qux&foo=bar
https://example.com/page
```

All three → Same fingerprint → Treated as duplicate

This prevents rescanning the same page with different query parameters (tracking pixels, session IDs, etc.).

## Benefits

1. **Performance**: Duplicate scans return cached results instantly
2. **Resource Efficiency**: Reduces unnecessary external API calls
3. **User Experience**: Faster response for re-checked URLs
4. **Privacy**: Local history not shared externally
5. **Smart Deduplication**: Query parameters don't trigger re-scans

## Manual Operations

### Clear History
```javascript
const { urlHistory } = require('./src/core/url-history');
urlHistory.clearHistory();
```

### Get Statistics
```javascript
console.log(urlHistory.getStats());
// { totalTracked: 234, maxSize: 10000, retentionDays: 30 }
```

### Export History
```javascript
const entries = urlHistory.getAllEntries();
console.log(entries);
```

## Future Enhancements

- [ ] UI to view/manage scan history
- [ ] Ability to force re-scan despite history
- [ ] Export history to CSV
- [ ] Configurable retention periods per risk level
- [ ] Analytics on repeat scans
