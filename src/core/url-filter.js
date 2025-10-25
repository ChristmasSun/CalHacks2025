/**
 * URL Filter
 *
 * Smart filtering system to determine which URLs should be scanned.
 * - Whitelist: Known-safe domains (don't scan)
 * - Blacklist: Always scan these patterns
 * - User rules: Custom whitelist/blacklist
 */

const fs = require('fs');
const path = require('path');

class URLFilter {
  constructor() {
    // Known-safe domains that we won't scan (Top sites + dev resources)
    this.whitelist = new Set([
      // Search engines
      'google.com',
      'bing.com',
      'duckduckgo.com',
      'yahoo.com',

      // Social media (mainstream)
      'youtube.com',
      'facebook.com',
      'twitter.com',
      'x.com',
      'instagram.com',
      'linkedin.com',
      'reddit.com',
      'tiktok.com',

      // Tech / Dev
      'github.com',
      'gitlab.com',
      'stackoverflow.com',
      'stackexchange.com',
      'npmjs.com',
      'pypi.org',
      'docker.com',

      // Cloud providers
      'aws.amazon.com',
      'azure.microsoft.com',
      'cloud.google.com',
      'cloudflare.com',

      // E-commerce (major)
      'amazon.com',
      'ebay.com',
      'walmart.com',
      'target.com',

      // Education / Reference
      'wikipedia.org',
      'wikimedia.org',
      'medium.com',

      // Tech companies
      'apple.com',
      'microsoft.com',
      'ibm.com',
      'oracle.com',
      'salesforce.com',

      // News (major outlets)
      'nytimes.com',
      'washingtonpost.com',
      'wsj.com',
      'reuters.com',
      'bbc.com',
      'cnn.com',

      // CDNs / Infrastructure
      'jsdelivr.net',
      'unpkg.com',
      'cdnjs.com',
      'googleapis.com',

      // Local development
      'localhost',
      '127.0.0.1',
      'lvh.me'
    ]);

    // Suspicious patterns that should ALWAYS be scanned
    this.blacklist = [
      /login/i,
      /signin/i,
      /verify/i,
      /suspend/i,
      /urgent/i,
      /account.*security/i,
      /confirm.*identity/i,
      /update.*payment/i,
      /unlock.*account/i,
      /unusual.*activity/i,
      /security.*alert/i,

      // Suspicious TLDs with hyphens/numbers
      /-\w+\.xyz$/,
      /-\w+\.top$/,
      /-\w+\.click$/,

      // IP addresses in URLs (often suspicious)
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,

      // Shortened URLs (always scan)
      /bit\.ly/i,
      /tinyurl\.com/i,
      /goo\.gl/i,
      /t\.co/i,
      /ow\.ly/i,

      // Common phishing patterns
      /paypal.*verify/i,
      /apple.*id.*verify/i,
      /amazon.*account/i,
      /microsoft.*security/i,
      /google.*alert/i
    ];

    // User-defined rules (loaded from file)
    this.userWhitelist = new Set();
    this.userBlacklist = new Set();

    // Stats
    this.stats = {
      totalChecked: 0,
      whitelisted: 0,
      blacklisted: 0,
      scanned: 0
    };
  }

  /**
   * Determine if a URL should be scanned
   * @param {string} url - URL to check
   * @returns {boolean} - true if should scan, false if should skip
   */
  shouldScan(url) {
    this.stats.totalChecked++;

    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const fullURL = url.toLowerCase();

      // Priority 1: User blacklist (highest priority - always scan)
      if (this.userBlacklist.has(hostname)) {
        console.log('[URLFilter] User blacklist match:', hostname);
        this.stats.blacklisted++;
        return true;
      }

      // Priority 2: User whitelist (skip scanning)
      if (this.userWhitelist.has(hostname)) {
        console.log('[URLFilter] User whitelist match:', hostname);
        this.stats.whitelisted++;
        return false;
      }

      // Priority 3: Global whitelist (known-safe domains)
      const isWhitelisted = Array.from(this.whitelist).some(domain => {
        return hostname === domain || hostname.endsWith('.' + domain);
      });

      if (isWhitelisted) {
        console.log('[URLFilter] Global whitelist match:', hostname);
        this.stats.whitelisted++;
        return false;
      }

      // Priority 4: Blacklist patterns (always scan suspicious patterns)
      const isBlacklisted = this.blacklist.some(pattern => pattern.test(fullURL));

      if (isBlacklisted) {
        console.log('[URLFilter] Blacklist pattern match:', url);
        this.stats.blacklisted++;
        return true;
      }

      // Priority 5: Default behavior - scan unknown URLs
      console.log('[URLFilter] Unknown URL, will scan:', hostname);
      this.stats.scanned++;
      return true;

    } catch (error) {
      console.error('[URLFilter] Invalid URL format:', url, error.message);
      return false;
    }
  }

  /**
   * Add domain to user whitelist
   * @param {string} domain - Domain to whitelist
   */
  addToUserWhitelist(domain) {
    const normalized = domain.toLowerCase().replace(/^www\./, '');
    this.userWhitelist.add(normalized);
    this.saveUserRules();
    console.log('[URLFilter] Added to user whitelist:', normalized);
  }

  /**
   * Add domain to user blacklist
   * @param {string} domain - Domain to blacklist
   */
  addToUserBlacklist(domain) {
    const normalized = domain.toLowerCase().replace(/^www\./, '');
    this.userBlacklist.add(normalized);
    this.saveUserRules();
    console.log('[URLFilter] Added to user blacklist:', normalized);
  }

  /**
   * Remove domain from user whitelist
   * @param {string} domain - Domain to remove
   */
  removeFromUserWhitelist(domain) {
    const normalized = domain.toLowerCase().replace(/^www\./, '');
    this.userWhitelist.delete(normalized);
    this.saveUserRules();
    console.log('[URLFilter] Removed from user whitelist:', normalized);
  }

  /**
   * Remove domain from user blacklist
   * @param {string} domain - Domain to remove
   */
  removeFromUserBlacklist(domain) {
    const normalized = domain.toLowerCase().replace(/^www\./, '');
    this.userBlacklist.delete(normalized);
    this.saveUserRules();
    console.log('[URLFilter] Removed from user blacklist:', normalized);
  }

  /**
   * Save user rules to file
   */
  saveUserRules() {
    try {
      const rulesPath = path.join(__dirname, '../../user-rules.json');
      const rules = {
        whitelist: Array.from(this.userWhitelist),
        blacklist: Array.from(this.userBlacklist),
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
      console.log('[URLFilter] Saved user rules to', rulesPath);
    } catch (error) {
      console.error('[URLFilter] Failed to save user rules:', error.message);
    }
  }

  /**
   * Load user rules from file
   */
  loadUserRules() {
    try {
      const rulesPath = path.join(__dirname, '../../user-rules.json');
      if (fs.existsSync(rulesPath)) {
        const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
        this.userWhitelist = new Set(rules.whitelist || []);
        this.userBlacklist = new Set(rules.blacklist || []);
        console.log('[URLFilter] Loaded user rules:', {
          whitelist: this.userWhitelist.size,
          blacklist: this.userBlacklist.size
        });
      } else {
        console.log('[URLFilter] No user rules file found, using defaults');
      }
    } catch (error) {
      console.error('[URLFilter] Failed to load user rules:', error.message);
    }
  }

  /**
   * Get current statistics
   * @returns {Object} - Stats object
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalChecked: 0,
      whitelisted: 0,
      blacklisted: 0,
      scanned: 0
    };
  }
}

module.exports = { URLFilter };
