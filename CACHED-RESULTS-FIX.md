# Cached Results Display Fix

## Problem
When scanning a URL that had been scanned before, the app would:
1. Skip the actual scan (cached)
2. **Not display the risk assessment** to the user
3. Appear to do nothing

The user reported: "even if you've already scanned the hyperlink, it should say if it is safe or unsafe"

## Root Cause
The scan queue was returning cached results in a different format:
```javascript
{
  cached: true,
  url: "...",
  previousScan: {
    riskScore: 75,
    riskLevel: "high",
    summary: "..."
  }
}
```

But the `orchestrateAnalysis` function wasn't handling this format - it would skip enrichment/scoring but then have no assessment to display.

## Solution

### 1. Detect Cached Results
**File:** `src/electron/main.js:634-639`
```javascript
// Check if this is a cached result
if (sandboxMetadata?.cached && sandboxMetadata?.previousScan) {
  cachedResult = sandboxMetadata.previousScan;
  console.log('[ScamShield] ✅ Using cached scan result for:', url);
}
```

### 2. Convert Cached Format to Assessment Format
**File:** `src/electron/main.js:647-658`
```javascript
if (cachedResult) {
  // Convert cached result format to assessment format
  assessment = {
    risk_score: cachedResult.riskScore || 0,
    risk_level: cachedResult.riskLevel || 'unknown',
    summary: cachedResult.summary || 'Previously scanned URL (cached result)',
    rawSignals: [],
    recommendations: [],
    cached: true,
    cachedAt: cachedResult.scanDate
  };
}
```

### 3. Pass Cached Flag to UI
**File:** `src/electron/main.js:685`
```javascript
const scanResult = {
  risk: assessment.risk_score || 0,
  reason: assessment.summary || 'Analysis complete',
  url: url || audioFile,
  source: autoDetected?.source || 'manual',
  blocked: assessment.risk_score >= 70,
  cached: assessment.cached || false // NEW: Indicate cached result
};
```

### 4. Display Cached Badge in UI
**File:** `src/electron/control.js:113`
```javascript
const cachedBadge = result.cached
  ? '<span class="cached-badge" style="font-size: 10px; opacity: 0.7; margin-left: 6px;">📋 Cached</span>'
  : '';

// Add to title
<div class="scan-result-title">${riskLevelText}${cachedBadge}</div>
```

## How It Works Now

### First Scan of a URL:
1. User scans `http://example-scam.com`
2. URLScan.io processes it (takes 10-30 seconds)
3. Risk assessment is calculated
4. Result is displayed: **"HIGH RISK - 85%"**
5. Result is cached in URL history

### Second Scan of Same URL:
1. User scans `http://example-scam.com` again
2. System detects it was previously scanned
3. Cached result is retrieved instantly (< 1ms)
4. Result is displayed: **"HIGH RISK - 85% 📋 Cached"**
5. User sees the same risk assessment, but faster

## Benefits

1. ✅ **Always shows risk assessment** (cached or not)
2. ✅ **Instant results** for previously scanned URLs
3. ✅ **Visual indicator** (📋 Cached badge) so users know it's from cache
4. ✅ **Saves API quota** - doesn't re-scan the same URL repeatedly
5. ✅ **Better UX** - immediate feedback even for known URLs

## Testing

### Test Case 1: First Scan
```bash
npm start
# Scan: http://google.com
# Expected: Shows "SAFE - 10%" after 10-30 seconds
```

### Test Case 2: Cached Scan
```bash
# Scan: http://google.com (same URL again)
# Expected: Shows "SAFE - 10% 📋 Cached" instantly
```

### Test Case 3: High Risk Cached
```bash
# Scan: http://google.com.cust_login.ie (scam URL)
# First scan: Shows "HIGH RISK - 90%"
# Second scan: Shows "HIGH RISK - 90% 📋 Cached" instantly
```

## Cache Behavior

### Cache Duration
- URLs are cached for **30 days** (configurable in `url-history.js:16`)
- After 30 days, a fresh scan will be performed

### Cache Storage
- Stored in: `url-history.json` in the app's userData directory
- Format: JSON file with risk scores and summaries
- Max size: 10,000 URLs (oldest entries pruned automatically)

### Cache Key (Fingerprinting)
URLs are normalized before caching:
- Query parameters are removed
- Fragments are removed
- Example:
  - `https://example.com/page?id=123#section`
  - → Cached as: `https://example.com/page`

This means:
- `https://example.com?ref=twitter`
- `https://example.com?ref=facebook`
- Both use the same cached result

## Console Output

### Before Fix (Cached Scan):
```
[ScanQueue] URL already scanned, returning cached result: http://google.com
[ScamShield] Starting analysis for http://google.com
```
(No result displayed)

### After Fix (Cached Scan):
```
[ScanQueue] URL already scanned, returning cached result: http://google.com
[ScamShield] ✅ Using cached scan result for: http://google.com
[ScamShield] Cached risk score: 10 | Level: low
[ScamShield] Using cached assessment: { risk_score: 10, risk_level: 'low', ... }
```
(Result properly displayed with 📋 Cached badge)

## Edge Cases Handled

1. **Missing cached data** - Falls back to fresh scan
2. **Corrupted cache** - Ignored, fresh scan performed
3. **Expired cache entries** - Automatically removed
4. **Cache size limit** - Oldest 10% pruned when limit exceeded

## Configuration

To adjust cache behavior, edit `src/core/url-history.js`:

```javascript
this.maxSize = options.maxSize || 10000; // Max URLs to cache
this.retentionDays = options.retentionDays || 30; // Cache duration
```

## Future Improvements

Potential enhancements:
1. Add "Rescan" button to force fresh analysis
2. Show cache age in tooltip (e.g., "Scanned 2 hours ago")
3. Different cache durations for safe vs. risky URLs
4. User-configurable cache settings in UI
5. Export/import cache data
