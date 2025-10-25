/**
 * Demo Mode
 *
 * Generates realistic test scans and threats for hackathon demos
 */

const DEMO_URLS = [
  // High risk threats
  {
    url: 'http://paypa1-secure-login.xyz',
    risk: 95,
    reason: '⚠️ URLScan.io flagged this URL as MALICIOUS. Phishing attempt detected - this site impersonates PayPal to steal credentials.',
    source: 'demo'
  },
  {
    url: 'http://amazon-verify-account.top',
    risk: 92,
    reason: 'Phishing attempt detected by URLScan.io VM analysis. Domain is only 3 days old (VERY NEW). Detected 2 suspicious element(s) (login forms, credential inputs).',
    source: 'demo'
  },
  {
    url: 'http://apple-id-locked.click',
    risk: 88,
    reason: '⚠️ Malware distribution detected by URLScan.io. Domain age (7 days) is relatively young. Bright Data detected credential/payment harvesting forms.',
    source: 'demo'
  },

  // Medium risk
  {
    url: 'http://limited-time-offer-now.xyz',
    risk: 65,
    reason: 'URLScan.io risk score: 65/100. Domain age (25 days) is relatively young. Detected 4 redirect hops.',
    source: 'demo'
  },
  {
    url: 'http://free-gift-card-generator.site',
    risk: 58,
    reason: 'Moderate risk indicators present. Domain age (18 days) is relatively young. Bright Data detected urgency/pressure language (common in scams).',
    source: 'demo'
  },

  // Low risk (safe)
  {
    url: 'https://www.google.com',
    risk: 5,
    reason: 'Low risk detected, but remain vigilant for unexpected changes.',
    source: 'demo'
  },
  {
    url: 'https://github.com',
    risk: 8,
    reason: 'Limited threat intelligence available - URL appears normal but analysis is incomplete.',
    source: 'demo'
  },
  {
    url: 'https://www.stanford.edu',
    risk: 3,
    reason: 'No issues detected. This appears to be a legitimate educational institution domain.',
    source: 'demo'
  }
];

class DemoMode {
  constructor() {
    this.enabled = false;
    this.demoIndex = 0;
    this.autoScanInterval = null;
  }

  /**
   * Enable demo mode
   */
  enable() {
    this.enabled = true;
    this.demoIndex = 0;
    console.log('[DemoMode] ✨ Demo mode ENABLED - realistic test scans will be generated');
  }

  /**
   * Disable demo mode
   */
  disable() {
    this.enabled = false;
    this.stopAutoScan();
    console.log('[DemoMode] Demo mode disabled');
  }

  /**
   * Check if demo mode is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get next demo scan result
   */
  getNextScan() {
    const scan = DEMO_URLS[this.demoIndex % DEMO_URLS.length];
    this.demoIndex++;
    return {
      ...scan,
      timestamp: new Date().toISOString(),
      blocked: scan.risk >= 70
    };
  }

  /**
   * Get a random demo scan
   */
  getRandomScan() {
    const randomIndex = Math.floor(Math.random() * DEMO_URLS.length);
    return {
      ...DEMO_URLS[randomIndex],
      timestamp: new Date().toISOString(),
      blocked: DEMO_URLS[randomIndex].risk >= 70
    };
  }

  /**
   * Get all demo URLs
   */
  getAllDemoUrls() {
    return [...DEMO_URLS];
  }

  /**
   * Start auto-scanning demo URLs
   */
  startAutoScan(callback, interval = 5000) {
    if (this.autoScanInterval) {
      this.stopAutoScan();
    }

    console.log(`[DemoMode] 🎬 Starting auto-scan demo (every ${interval}ms)`);

    this.autoScanInterval = setInterval(() => {
      const scan = this.getNextScan();
      console.log(`[DemoMode] 🎯 Auto-scanning: ${scan.url} (${scan.risk}% risk)`);
      callback(scan);
    }, interval);
  }

  /**
   * Stop auto-scanning
   */
  stopAutoScan() {
    if (this.autoScanInterval) {
      clearInterval(this.autoScanInterval);
      this.autoScanInterval = null;
      console.log('[DemoMode] Auto-scan stopped');
    }
  }

  /**
   * Generate demo history for statistics
   */
  generateDemoHistory(count = 50) {
    const history = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(Math.random() * 7); // Last 7 days
      const hoursAgo = Math.floor(Math.random() * 24);
      const timestamp = new Date(now - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000));

      const scan = DEMO_URLS[Math.floor(Math.random() * DEMO_URLS.length)];

      history.push({
        id: now - i,
        timestamp: timestamp.toISOString(),
        url: scan.url,
        riskScore: scan.risk,
        riskLevel: scan.risk >= 70 ? 'high' : scan.risk >= 40 ? 'medium' : 'low',
        reason: scan.reason,
        source: 'demo',
        blocked: scan.risk >= 70
      });
    }

    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

// Singleton instance
const demoMode = new DemoMode();

module.exports = { demoMode };
