/**
 * Clipboard Monitor
 *
 * Monitors the system clipboard for URLs and triggers analysis automatically.
 * No permissions required - uses Electron's built-in clipboard API.
 */

const { clipboard } = require('electron');
const { urlHistory } = require('./url-history');

class ClipboardMonitor {
  constructor(options = {}) {
    this.lastText = '';
    this.interval = null;
    this.pollInterval = options.pollInterval || 500; // Check every 500ms
    this.onURL = options.onURL || (() => {});
    this.skipAlreadyScanned = options.skipAlreadyScanned !== false; // Default to true

    // Enhanced URL regex that matches most URL patterns
    this.urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  }

  /**
   * Start monitoring the clipboard
   */
  start() {
    console.log('[ClipboardMonitor] Starting clipboard monitoring (checking every', this.pollInterval, 'ms)');

    this.interval = setInterval(() => {
      const currentText = clipboard.readText();

      // Only process if clipboard content changed
      if (currentText && currentText !== this.lastText) {
        this.lastText = currentText;
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
            // Skip if already scanned (unless disabled)
            if (this.skipAlreadyScanned && urlHistory.hasBeenScanned(url)) {
              console.log('[ClipboardMonitor] URL already scanned, skipping:', url);
              return;
            }

            console.log('[ClipboardMonitor] Detected URL:', url);
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
