/**
 * Bright Data Threat Intelligence Client (FIXED)
 *
 * Properly integrated with Bright Data's API requirements:
 * - Correct request format (array of objects)
 * - dataset_id parameter support
 * - Async/sync scraping support
 * - WHOIS via whoiser library (not Bright Data)
 */

const axios = require('axios');
const { whoisDomain } = require('whoiser');

const BRIGHTDATA_API_BASE = 'https://api.brightdata.com/datasets/v3';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 30; // Max 60 seconds of polling

class BrightDataClient {
  constructor(options = {}) {
    this.apiToken = options.apiToken || process.env.BRIGHTDATA_API_TOKEN;
    this.linkedinDatasetId = options.linkedinDatasetId || process.env.BRIGHTDATA_LINKEDIN_DATASET_ID;
    this.customDatasetId = options.customDatasetId || process.env.BRIGHTDATA_CUSTOM_DATASET_ID;
    this.enabled = !!this.apiToken;

    if (!this.enabled) {
      console.warn('[BrightData] API token not configured. Bright Data features disabled.');
    }
  }

  /**
   * Analyze URL using Bright Data Web Scraper API (FIXED)
   *
   * NOTE: This requires a custom dataset_id from your Bright Data dashboard.
   * If you don't have one, this method will return an error.
   *
   * @param {string} url - URL to analyze
   * @param {string} datasetId - Optional dataset ID (uses BRIGHTDATA_CUSTOM_DATASET_ID if not provided)
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeUrl(url, datasetId = null) {
    if (!this.enabled) {
      return {
        error: 'Bright Data not configured',
        enabled: false,
        success: false
      };
    }

    const targetDatasetId = datasetId || this.customDatasetId;

    if (!targetDatasetId) {
      console.warn('[BrightData] No dataset_id configured. Cannot analyze URL.');
      return {
        error: 'No dataset_id configured. Set BRIGHTDATA_CUSTOM_DATASET_ID in .env',
        enabled: true,
        success: false,
        help: 'Create a custom dataset at https://brightdata.com/cp/datasets'
      };
    }

    try {
      console.log(`[BrightData] Analyzing URL with dataset ${targetDatasetId}:`, url);

      // CORRECT FORMAT: Array of input objects
      const response = await axios.post(
        `${BRIGHTDATA_API_BASE}/trigger?dataset_id=${targetDatasetId}&format=json`,
        [
          { url: url } // Input as array element
        ],
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: REQUEST_TIMEOUT_MS
        }
      );

      // Response contains snapshot_id for async job
      const snapshotId = response.data.snapshot_id;
      console.log(`[BrightData] Job submitted, snapshot_id: ${snapshotId}`);

      // Poll for results
      const results = await this.pollSnapshot(snapshotId);

      if (results.success && results.data && results.data.length > 0) {
        // Analyze for scam indicators
        const indicators = this.detectScamIndicators(results.data[0]);

        return {
          success: true,
          url,
          indicators,
          rawData: results.data[0],
          snapshotId,
          timestamp: new Date().toISOString()
        };
      }

      return results;

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
   * Poll for snapshot results (async scraping)
   *
   * @param {string} snapshotId - Snapshot ID from trigger request
   * @returns {Promise<Object>} Snapshot results
   */
  async pollSnapshot(snapshotId, maxAttempts = MAX_POLL_ATTEMPTS) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `${BRIGHTDATA_API_BASE}/snapshot/${snapshotId}?format=json`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`
            },
            timeout: REQUEST_TIMEOUT_MS
          }
        );

        const status = response.data.status;
        console.log(`[BrightData] Snapshot ${snapshotId} status: ${status} (attempt ${attempt + 1}/${maxAttempts})`);

        if (status === 'ready') {
          return {
            success: true,
            status: 'ready',
            data: response.data.data || [],
            snapshotId
          };
        }

        if (status === 'failed') {
          return {
            success: false,
            status: 'failed',
            error: 'Snapshot job failed',
            snapshotId
          };
        }

        // Status is 'running' or 'pending', wait and retry
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

      } catch (error) {
        console.error(`[BrightData] Polling error (attempt ${attempt + 1}):`, error.message);

        if (attempt === maxAttempts - 1) {
          return {
            success: false,
            error: 'Polling timeout - job took too long',
            snapshotId
          };
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    return {
      success: false,
      error: 'Polling timeout',
      snapshotId
    };
  }

  /**
   * Get WHOIS data using whoiser library (NOT Bright Data)
   *
   * This is more reliable and doesn't require Bright Data API calls.
   *
   * @param {string} domain - Domain to lookup
   * @returns {Promise<Object>} WHOIS data
   */
  async getWhoisData(domain) {
    try {
      console.log('[BrightData/WHOIS] Fetching WHOIS data for:', domain);

      const whoisData = await whoisDomain(domain, {
        timeout: 10000,
        follow: 2 // Follow up to 2 redirects
      });

      // Parse the WHOIS data
      const domainInfo = whoisData[domain] || {};

      // Extract relevant fields (varies by TLD)
      const createdDate = this.extractWhoisField(domainInfo, ['created', 'creation date', 'creation_date', 'registered']);
      const expiresDate = this.extractWhoisField(domainInfo, ['expires', 'expiry date', 'expiration date', 'registry expiry date']);
      const registrar = this.extractWhoisField(domainInfo, ['registrar']);
      const status = this.extractWhoisField(domainInfo, ['status', 'domain status']);

      // Calculate domain age
      let domainAgeDays = null;
      if (createdDate) {
        try {
          const created = new Date(createdDate);
          const now = new Date();
          domainAgeDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        } catch (e) {
          console.warn('[BrightData/WHOIS] Failed to parse creation date:', createdDate);
        }
      }

      return {
        success: true,
        domain,
        whois: {
          creationDate: createdDate,
          expirationDate: expiresDate,
          registrar,
          status,
          domainAgeDays,
          raw: domainInfo
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[BrightData/WHOIS] WHOIS lookup failed:', error.message);
      return {
        error: error.message,
        domain,
        success: false
      };
    }
  }

  /**
   * Extract WHOIS field (handles different field names)
   */
  extractWhoisField(whoisData, fieldNames) {
    for (const fieldName of fieldNames) {
      const value = whoisData[fieldName] || whoisData[fieldName.toLowerCase()];
      if (value) {
        // If array, return first element
        return Array.isArray(value) ? value[0] : value;
      }
    }
    return null;
  }

  /**
   * Search LinkedIn using Bright Data's LinkedIn People dataset (FIXED)
   *
   * @param {string} profileUrl - LinkedIn profile URL
   * @returns {Promise<Object>} Profile data
   */
  async searchLinkedIn(profileUrl) {
    if (!this.enabled) {
      return {
        error: 'Bright Data not configured',
        enabled: false,
        success: false
      };
    }

    if (!this.linkedinDatasetId) {
      console.warn('[BrightData] No LinkedIn dataset_id configured.');
      return {
        error: 'No LinkedIn dataset_id configured. Set BRIGHTDATA_LINKEDIN_DATASET_ID in .env',
        enabled: true,
        success: false,
        help: 'Get dataset ID from https://brightdata.com/products/datasets/linkedin'
      };
    }

    try {
      console.log('[BrightData] Searching LinkedIn profile:', profileUrl);

      // CORRECT FORMAT: Array with profile URL
      const response = await axios.post(
        `${BRIGHTDATA_API_BASE}/trigger?dataset_id=${this.linkedinDatasetId}&format=json`,
        [
          { url: profileUrl }
        ],
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: REQUEST_TIMEOUT_MS
        }
      );

      const snapshotId = response.data.snapshot_id;
      console.log(`[BrightData] LinkedIn job submitted, snapshot_id: ${snapshotId}`);

      // Poll for results
      const results = await this.pollSnapshot(snapshotId);

      if (results.success && results.data && results.data.length > 0) {
        const profile = results.data[0];
        return {
          success: true,
          profile: {
            name: profile.name || profile.full_name,
            title: profile.title || profile.headline,
            company: profile.company || profile.current_company,
            email: profile.email || null,
            profileUrl: profileUrl,
            location: profile.location,
            ...profile
          },
          snapshotId,
          timestamp: new Date().toISOString()
        };
      }

      return results;

    } catch (error) {
      console.error('[BrightData] LinkedIn search failed:', error.message);
      return {
        error: error.message,
        profileUrl,
        success: false
      };
    }
  }

  /**
   * Batch analyze multiple URLs (async)
   *
   * @param {Array<string>} urls - URLs to analyze
   * @param {string} datasetId - Dataset ID to use
   * @returns {Promise<Object>} Job info with snapshot_id
   */
  async batchAnalyze(urls, datasetId = null) {
    if (!this.enabled) {
      return { error: 'Bright Data not configured', enabled: false };
    }

    const targetDatasetId = datasetId || this.customDatasetId;

    if (!targetDatasetId) {
      return {
        error: 'No dataset_id configured',
        help: 'Set BRIGHTDATA_CUSTOM_DATASET_ID in .env'
      };
    }

    try {
      console.log(`[BrightData] Starting batch analysis for ${urls.length} URLs`);

      // CORRECT FORMAT: Array of input objects
      const inputs = urls.map(url => ({ url }));

      const response = await axios.post(
        `${BRIGHTDATA_API_BASE}/trigger?dataset_id=${targetDatasetId}&format=json`,
        inputs,
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
        snapshotId: response.data.snapshot_id,
        urlCount: urls.length,
        message: 'Batch job started. Use pollSnapshot() to retrieve results.'
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
   * Analyze scraped data for scam indicators
   *
   * @param {Object} data - Scraped page data
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

    // Check for login/password forms
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

    // Check for excessive external links
    if (data.links && data.links.length > 50) {
      indicators.excessiveExternalLinks = true;
    }

    // Check for suspicious scripts
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
