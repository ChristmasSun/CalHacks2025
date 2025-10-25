/**
 * Bright Data Threat Intelligence Client
 *
 * Provides enhanced scam detection capabilities:
 * - WHOIS data collection for domain analysis
 * - Web scraping for phishing indicator detection
 * - Threat intelligence from security sources
 */

const axios = require('axios');

const BRIGHTDATA_API_BASE = 'https://api.brightdata.com/datasets/v3';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

class BrightDataClient {
  constructor(apiToken = process.env.BRIGHTDATA_API_TOKEN) {
    this.apiToken = apiToken;
    this.enabled = !!apiToken;

    if (!this.enabled) {
      console.warn('[BrightData] API token not configured. Bright Data features disabled.');
    }
  }

  /**
   * Extract domain metadata and analyze page content for scam indicators
   * Uses synchronous scraping for real-time analysis
   *
   * @param {string} url - URL to analyze
   * @returns {Promise<Object>} Analysis results with scam indicators
   */
  async analyzeUrl(url) {
    if (!this.enabled) {
      return { error: 'Bright Data not configured', enabled: false };
    }

    try {
      console.log('[BrightData] Analyzing URL:', url);

      // Use Bright Data Web Scraper API to extract page metadata
      const response = await axios.post(
        `${BRIGHTDATA_API_BASE}/scrape`,
        {
          url: url,
          format: 'json',
          // Extract key indicators for scam detection
          fields: [
            'title',
            'meta_description',
            'links',
            'forms',
            'scripts',
            'external_resources'
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: REQUEST_TIMEOUT_MS
        }
      );

      const data = response.data;

      // Analyze for scam indicators
      const indicators = this.detectScamIndicators(data);

      return {
        success: true,
        url,
        indicators,
        rawData: data,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[BrightData] URL analysis failed:', error.message);
      return {
        error: error.message,
        url,
        success: false
      };
    }
  }

  /**
   * Collect WHOIS data for domain risk assessment
   *
   * @param {string} domain - Domain to lookup (e.g., 'example.com')
   * @returns {Promise<Object>} WHOIS data including registration date, registrar, etc.
   */
  async getWhoisData(domain) {
    if (!this.enabled) {
      return { error: 'Bright Data not configured', enabled: false };
    }

    try {
      console.log('[BrightData] Fetching WHOIS data for:', domain);

      // Use Bright Data to scrape WHOIS information
      const response = await axios.post(
        `${BRIGHTDATA_API_BASE}/scrape`,
        {
          url: `https://www.whois.com/whois/${domain}`,
          format: 'json',
          fields: [
            'creation_date',
            'expiration_date',
            'registrar',
            'registrant_country',
            'name_servers',
            'status'
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: REQUEST_TIMEOUT_MS
        }
      );

      return {
        success: true,
        domain,
        whois: response.data,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[BrightData] WHOIS lookup failed:', error.message);
      return {
        error: error.message,
        domain,
        success: false
      };
    }
  }

  /**
   * Batch analyze multiple URLs (asynchronous processing)
   * Useful for processing large lists of suspicious URLs
   *
   * @param {Array<string>} urls - Array of URLs to analyze
   * @returns {Promise<Object>} Job ID for tracking batch processing
   */
  async batchAnalyze(urls) {
    if (!this.enabled) {
      return { error: 'Bright Data not configured', enabled: false };
    }

    try {
      console.log(`[BrightData] Starting batch analysis for ${urls.length} URLs`);

      const response = await axios.post(
        `${BRIGHTDATA_API_BASE}/trigger`,
        {
          dataset_id: 'web_scraper',
          inputs: urls.map(url => ({ url })),
          format: 'json'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: REQUEST_TIMEOUT_MS
        }
      );

      return {
        success: true,
        jobId: response.data.snapshot_id,
        urlCount: urls.length,
        message: 'Batch job started. Use getBatchResults() to retrieve results.'
      };

    } catch (error) {
      console.error('[BrightData] Batch analysis failed:', error.message);
      return {
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Get results from a batch analysis job
   *
   * @param {string} jobId - Job ID from batchAnalyze()
   * @returns {Promise<Object>} Job status and results (if ready)
   */
  async getBatchResults(jobId) {
    if (!this.enabled) {
      return { error: 'Bright Data not configured', enabled: false };
    }

    try {
      const response = await axios.get(
        `${BRIGHTDATA_API_BASE}/snapshots/${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          },
          timeout: REQUEST_TIMEOUT_MS
        }
      );

      return {
        success: true,
        jobId,
        status: response.data.status, // 'collecting', 'digesting', 'ready'
        results: response.data.status === 'ready' ? response.data.data : null
      };

    } catch (error) {
      console.error('[BrightData] Failed to get batch results:', error.message);
      return {
        error: error.message,
        jobId,
        success: false
      };
    }
  }

  /**
   * Analyze scraped data for scam indicators
   *
   * @param {Object} data - Scraped page data from Bright Data
   * @returns {Object} Detected scam indicators
   */
  detectScamIndicators(data) {
    const indicators = {
      hasLoginForm: false,
      hasPasswordField: false,
      hasCreditCardForm: false,
      excessiveExternalLinks: false,
      suspiciousScripts: false,
      misleadingTitle: false,
      urgencyLanguage: false,
      score: 0
    };

    // Check for login/password forms (credential harvesting)
    if (data.forms && data.forms.length > 0) {
      const forms = JSON.stringify(data.forms).toLowerCase();
      indicators.hasLoginForm = forms.includes('login') || forms.includes('signin');
      indicators.hasPasswordField = forms.includes('password') || forms.includes('type="password"');
      indicators.hasCreditCardForm = forms.includes('card') || forms.includes('cvv') || forms.includes('credit');
    }

    // Check title for brand impersonation
    if (data.title) {
      const titleLower = data.title.toLowerCase();
      const suspiciousBrands = ['paypal', 'amazon', 'apple', 'microsoft', 'google', 'bank', 'verify', 'security'];
      indicators.misleadingTitle = suspiciousBrands.some(brand => titleLower.includes(brand));

      // Check for urgency language
      const urgencyWords = ['urgent', 'suspended', 'verify now', 'act now', 'limited time', 'expire'];
      indicators.urgencyLanguage = urgencyWords.some(word => titleLower.includes(word));
    }

    // Check for excessive external links (redirect chains)
    if (data.links && data.links.length > 50) {
      indicators.excessiveExternalLinks = true;
    }

    // Check for suspicious scripts (obfuscation, data exfiltration)
    if (data.scripts && data.scripts.length > 0) {
      const scripts = JSON.stringify(data.scripts).toLowerCase();
      indicators.suspiciousScripts = scripts.includes('eval(') ||
                                     scripts.includes('atob(') ||
                                     scripts.includes('fromcharcode');
    }

    // Calculate risk score
    if (indicators.hasLoginForm) indicators.score += 15;
    if (indicators.hasPasswordField) indicators.score += 20;
    if (indicators.hasCreditCardForm) indicators.score += 30;
    if (indicators.excessiveExternalLinks) indicators.score += 10;
    if (indicators.suspiciousScripts) indicators.score += 15;
    if (indicators.misleadingTitle) indicators.score += 20;
    if (indicators.urgencyLanguage) indicators.score += 10;

    return indicators;
  }
}

// Export singleton instance
const brightDataClient = new BrightDataClient();

module.exports = { brightDataClient, BrightDataClient };
