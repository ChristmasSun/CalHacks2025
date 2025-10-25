/**
 * URL History
 *
 * Tracks previously scanned URLs to avoid duplicate scans.
 * Stores URL fingerprints (without query parameters) to allow multiple scans of same URL.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class URLHistory {
  constructor(options = {}) {
    this.history = new Map(); // Map<urlFingerprint, { url, timestamp, riskScore, riskLevel }>
    this.maxSize = options.maxSize || 10000; // Maximum URLs to track
    this.retentionDays = options.retentionDays || 30; // Keep history for 30 days
    this.historyPath = path.join(__dirname, '../../url-history.json');
    
    this.loadHistory();
  }

  /**
   * Generate a normalized fingerprint for a URL
   * Removes query parameters and fragments for fingerprinting
   * @param {string} url - URL to fingerprint
   * @returns {string} - URL fingerprint
   */
  getFingerprint(url) {
    try {
      const parsed = new URL(url);
      // Remove query params and fragments for fingerprinting
      const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
      // Create a hash to ensure consistent length
      return crypto.createHash('sha256').update(normalized).digest('hex');
    } catch (error) {
      console.error('[URLHistory] Failed to fingerprint URL:', url, error.message);
      return null;
    }
  }

  /**
   * Check if a URL has been previously scanned
   * @param {string} url - URL to check
   * @returns {boolean} - true if URL has been scanned before
   */
  hasBeenScanned(url) {
    const fingerprint = this.getFingerprint(url);
    if (!fingerprint) return false;
    
    const entry = this.history.get(fingerprint);
    if (!entry) return false;

    // Check if entry is still within retention period
    const ageInDays = (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24);
    if (ageInDays > this.retentionDays) {
      // Entry expired, remove it
      this.history.delete(fingerprint);
      return false;
    }

    return true;
  }

  /**
   * Get a previously scanned URL's history
   * @param {string} url - URL to look up
   * @returns {Object|null} - History entry or null if not found
   */
  getHistory(url) {
    const fingerprint = this.getFingerprint(url);
    if (!fingerprint) return null;

    const entry = this.history.get(fingerprint);
    if (!entry) return null;

    // Check if entry is still within retention period
    const ageInDays = (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24);
    if (ageInDays > this.retentionDays) {
      this.history.delete(fingerprint);
      return null;
    }

    return entry;
  }

  /**
   * Record that a URL has been scanned
   * @param {string} url - URL that was scanned
   * @param {Object} result - Scan result object
   * @returns {void}
   */
  recordScan(url, result = {}) {
    const fingerprint = this.getFingerprint(url);
    if (!fingerprint) return;

    const entry = {
      url,
      fingerprint,
      timestamp: Date.now(),
      scanDate: new Date().toISOString(),
      riskScore: result.risk_score,
      riskLevel: result.risk_level,
      summary: result.summary
    };

    this.history.set(fingerprint, entry);

    // Enforce size limit - remove oldest entries if needed
    if (this.history.size > this.maxSize) {
      this.pruneOldest();
    }

    this.saveHistory();
    console.log('[URLHistory] Recorded scan for:', url);
  }

  /**
   * Remove oldest entries when history exceeds max size
   */
  pruneOldest() {
    // Convert map to array, sort by timestamp, remove oldest 10%
    const entries = Array.from(this.history.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const removeCount = Math.ceil(this.maxSize * 0.1);
    for (let i = 0; i < removeCount; i++) {
      this.history.delete(entries[i][0]);
    }

    console.log(`[URLHistory] Pruned ${removeCount} old entries to maintain size limit`);
  }

  /**
   * Clear all history
   */
  clearHistory() {
    const count = this.history.size;
    this.history.clear();
    this.saveHistory();
    console.log(`[URLHistory] Cleared all ${count} history entries`);
  }

  /**
   * Get history statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    return {
      totalTracked: this.history.size,
      maxSize: this.maxSize,
      retentionDays: this.retentionDays
    };
  }

  /**
   * Save history to file
   */
  saveHistory() {
    try {
      const entries = Array.from(this.history.entries()).map(([fingerprint, entry]) => entry);
      fs.writeFileSync(this.historyPath, JSON.stringify(entries, null, 2));
      console.log('[URLHistory] Saved history to', this.historyPath);
    } catch (error) {
      console.error('[URLHistory] Failed to save history:', error.message);
    }
  }

  /**
   * Load history from file
   */
  loadHistory() {
    try {
      if (fs.existsSync(this.historyPath)) {
        const data = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
        
        // Rebuild map from stored entries
        this.history.clear();
        (Array.isArray(data) ? data : []).forEach(entry => {
          if (entry.fingerprint) {
            this.history.set(entry.fingerprint, entry);
          }
        });

        console.log('[URLHistory] Loaded', this.history.size, 'history entries');
      } else {
        console.log('[URLHistory] No history file found, starting fresh');
      }
    } catch (error) {
      console.error('[URLHistory] Failed to load history:', error.message);
      this.history.clear();
    }
  }

  /**
   * Get all history entries (for debugging/export)
   * @returns {Array} - All history entries
   */
  getAllEntries() {
    return Array.from(this.history.values());
  }
}

// Singleton instance
const urlHistory = new URLHistory();

module.exports = { urlHistory, URLHistory };
