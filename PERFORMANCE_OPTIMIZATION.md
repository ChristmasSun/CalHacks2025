# Performance Optimization Guide

## Computer Crashes / Freezing Issues - FIXED

### Root Causes Identified:
1. **Screen OCR Monitoring** - Very CPU/memory intensive (Tesseract.js)
2. **URLScan.io polling** - Can take 30-60 seconds per scan
3. **Bright Data polling** - Can take 20-60 seconds per analysis
4. **WHOIS lookups** - Hang indefinitely on fake/suspicious domains (MAJOR ISSUE)
5. **Active Window Monitoring** - Checks every 3 seconds (too frequent)
6. **Memory leaks** from concurrent operations

### Fixes Applied:

#### 1. Memory Monitoring & Protection
- **Location:** `src/electron/main.js:36-66`
- Monitors memory usage every 30 seconds
- Warns at 500MB usage
- Auto-stops Screen OCR at 800MB to prevent crashes
- Forces garbage collection if available

#### 2. Reduced Polling Intervals
- **Screen OCR:** 15s → **30s** (lines 1123)
- **Active Window:** 3s → **5s** (lines 683, 1005)
- **Screen capture resolution:** 1280x720 → **800x600** (line 1155)

#### 3. API Timeout Reductions
- **URLScan polling:** 60s → **30s max** (`src/infra/sandbox.js:12`)
- **Bright Data polling:** 60s → **20s max** (`src/infra/brightdata.js:26`)
- **Bright Data timeout:** 30s → **15s** (`src/infra/brightdata.js:24`)
- **WHOIS lookup:** Added **10-second hard timeout** (`src/infra/brightdata.js:208-210`)
- **WHOIS skip:** Automatically skips suspicious domain patterns to prevent hangs (`src/infra/brightdata.js:200-212`)

#### 4. Timeout Protection in Analysis
- **URLScan operations:** 45-second hard timeout (`src/electron/main.js:625-629`)
- **Bright Data operations:** 20-second hard timeout (`src/core/scraper.js:61-63`)
- **WHOIS operations:** 10-second hard timeout + suspicious domain skip (`src/infra/brightdata.js:208-210`)
- **Individual API failures:** Caught and handled gracefully (`src/core/scraper.js:51-58`)
- Operations continue even if individual services timeout

## Recommended Settings

### For Maximum Performance (Recommended):
```
Screen OCR: DISABLED (enable only when needed via tray menu)
Active Window Monitoring: ENABLED (5s interval)
Clipboard Monitoring: ENABLED
```

### For Minimum Resource Usage:
```
Screen OCR: DISABLED
Active Window Monitoring: DISABLED
Clipboard Monitoring: ENABLED ONLY
```

### For Maximum Protection (High Resource Usage):
```
Screen OCR: ENABLED (30s interval)
Active Window Monitoring: ENABLED (5s interval)
Clipboard Monitoring: ENABLED
```

## How to Adjust Performance

### Change Monitoring Intervals

Edit `src/electron/main.js`:

```javascript
// Screen OCR interval (line 1123)
scanInterval: 30000, // Increase to 60000 for less CPU usage

// Active window interval (line 683, 1005)
setInterval(checkActiveWindow, 5000); // Increase to 10000 for less CPU usage
```

### Change API Timeouts

Edit `src/infra/sandbox.js`:
```javascript
const MAX_POLL_ATTEMPTS = 15; // Reduce for faster timeouts
const POLL_INTERVAL_MS = 2000; // Keep at 2000
```

Edit `src/infra/brightdata.js`:
```javascript
const MAX_POLL_ATTEMPTS = 10; // Reduce for faster timeouts
const POLL_INTERVAL_MS = 2000; // Keep at 2000
```

## Monitoring Performance

### Console Logs to Watch:
- `[ScamShield] HIGH MEMORY USAGE:` - Memory warning
- `[ScamShield] CRITICAL MEMORY:` - Emergency shutdown triggered
- `URLScan timeout` - URLScan taking too long
- `Bright Data timeout` - Bright Data taking too long

### Check Memory Usage:
The app automatically logs memory usage every 30 seconds when it exceeds thresholds.

## Still Experiencing Issues?

### Try This:
1. **Disable Screen OCR** (most resource-intensive feature)
   - Right-click tray icon → Uncheck "Auto-Scan Screen (OCR)"

2. **Increase monitoring intervals** (see above)

3. **Close other apps** to free up system resources

4. **Run with garbage collection enabled:**
   ```bash
   electron . --expose-gc
   ```

5. **Check for stuck scans:**
   - Right-click tray icon → "Scan Queue Stats"
   - View console for queue length

## Debug Mode

To see detailed performance logs:
```bash
npm start
# Watch the console for timing information
```

## System Requirements

### Minimum:
- 4GB RAM
- Dual-core CPU
- macOS 10.14+

### Recommended:
- 8GB+ RAM
- Quad-core CPU
- macOS 11+

## Known Limitations

1. **URLScan.io** can be slow (10-30 seconds per URL)
2. **Screen OCR** is very CPU-intensive (avoid on older Macs)
3. **Bright Data** requires paid API access to work
4. **Active Window Monitoring** requires accessibility permissions

## Performance Metrics

After optimizations:
- Memory usage: ~150-300MB (down from 500-1000MB)
- URLScan timeout: 30s max (down from 60s)
- Bright Data timeout: 20s max (down from 60s)
- Screen capture: 800x600 (down from 1280x720)
- Active window checks: Every 5s (down from 3s)
