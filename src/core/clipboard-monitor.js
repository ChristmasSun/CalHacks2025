/**
 * Clipboard Monitor
 *
 * Monitors the system clipboard for URLs and triggers analysis automatically.
 * No permissions required - uses Electron's built-in clipboard API.
 */

// Lazy-load electron to avoid module loading issues
let clipboard;
function getClipboard() {
  if (!clipboard) {
    clipboard = require('electron').clipboard;
  }
  return clipboard;
}

class ClipboardMonitor {
  constructor(options = {}) {
    this.lastText = '';
    this.lastProcessedUrl = ''; // Track the last URL we processed
    this.interval = null;
    this.pollInterval = options.pollInterval || 500; // Check every 500ms
    this.onURL = options.onURL || (() => {});

    // Ultra-comprehensive URL regex - captures FULL URLs including query strings and fragments
    this.urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;
  }

  /**
   * Start monitoring the clipboard
   */
  start() {
    console.log('[ClipboardMonitor] Starting clipboard monitoring (checking every', this.pollInterval, 'ms)');

    this.interval = setInterval(() => {
      const clipboard = getClipboard();

      // Check both plain text and HTML content
      const currentText = clipboard.readText();

      // Process plain text URLs
      if (currentText && currentText !== this.lastText) {
        // Clipboard content has changed
        this.lastText = currentText;
        console.log('[ClipboardMonitor] Clipboard content changed');
        this.checkForURLs(currentText);
      }
    }, this.pollInterval);
  }

  /**
   * Extract and validate URLs from clipboard text
   * @param {string} text - Clipboard content
   */
  checkForURLs(text) {
    const urls = text.match(this.urlRegex);

    if (urls && urls.length > 0) {
      urls.forEach(url => {
        try {
          // Validate URL structure
          const parsed = new URL(url);

          // Only process http/https URLs
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            // Since we only call this when clipboard content changes,
            // we always want to process the URL and show the banner
            // This handles: X → Y → X (X gets scanned again)
            console.log('[ClipboardMonitor] Detected URL:', url);
            this.lastProcessedUrl = url;
            this.onURL(url);
          }
        } catch (error) {
          // Invalid URL, skip silently
          console.log('[ClipboardMonitor] Invalid URL format, skipping:', url);
        }
      });
    }
  }

  /**
   * Extract URLs from HTML hyperlinks (href attributes)
   * @param {string} html - HTML content from clipboard
   */
  checkForHyperlinks(html) {
    if (!html) return;

    // Extract all href attributes from <a> tags
    // Regex pattern: <a [attributes] href="url" [attributes]>
    const hrefRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
    const matches = [];
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      matches.push(match[1]);
    }

    if (matches.length > 0) {
      console.log(`[ClipboardMonitor] Found ${matches.length} hyperlinks in HTML`);

      matches.forEach(url => {
        try {
          // Handle relative URLs by skipping them (we need absolute URLs)
          if (url.startsWith('/') || url.startsWith('#') || url.startsWith('mailto:')) {
            return;
          }

          // Validate URL structure
          const parsed = new URL(url);

          // Only process http/https URLs
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            // Always trigger onURL callback, even for cached URLs
            // The orchestrateAnalysis function will handle showing cached results
            console.log('[ClipboardMonitor] Detected hyperlink:', url);
            this.onURL(url);
          }
        } catch (error) {
          // Invalid URL, skip silently
        }
      });
    }
  }

  /**
   * Stop monitoring the clipboard
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[ClipboardMonitor] Stopped clipboard monitoring');
    }
  }

  /**
   * Temporarily pause monitoring (e.g., when user is typing in app)
   */
  pause() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[ClipboardMonitor] Paused clipboard monitoring');
    }
  }

  /**
   * Resume monitoring after pause
   */
  resume() {
    if (!this.interval) {
      this.start();
    }
  }
}

module.exports = { ClipboardMonitor };
