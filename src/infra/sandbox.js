// Real URLScan.io integration for URL analysis in isolated sandbox environment
// Docs: https://urlscan.io/docs/api/

require('dotenv').config();
const axios = require('axios');

const URLSCAN_API_KEY = process.env.URLSCAN_API_KEY;
const URLSCAN_API_BASE = 'https://urlscan.io/api/v1';
const URLSCAN_VISIBILITY = process.env.URLSCAN_VISIBILITY || 'public';

// Retry configuration (REDUCED to prevent freezing)
const MAX_POLL_ATTEMPTS = 15; // 15 attempts (was 30) = 30 seconds max
const POLL_INTERVAL_MS = 2000; // 2 seconds between polls
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout per request

/**
 * Submit URL to URLScan.io for analysis
 * @param {string} url - URL to scan
 * @returns {Promise<string>} - UUID of the scan
 */
async function submitScan(url) {
  if (!URLSCAN_API_KEY) {
    throw new Error('URLSCAN_API_KEY not set. Please add it to your .env file.');
  }

  try {
    const response = await axios.post(
      `${URLSCAN_API_BASE}/scan/`,
      {
        url,
        visibility: URLSCAN_VISIBILITY,
        tags: ['scam-detection', 'calhacks2025']
      },
      {
        headers: {
          'API-Key': URLSCAN_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: REQUEST_TIMEOUT_MS
      }
    );

    return response.data.uuid;
  } catch (error) {
    if (error.response) {
      const errorMsg = error.response.data?.message || error.response.statusText;
      console.error(`[URLScan] Submission failed (${error.response.status}): ${errorMsg}`);

      // For immediate failures (DNS errors, invalid URLs, etc.), throw immediately
      // These don't need polling - they failed at submission
      throw new Error(`URLScan submission failed: ${error.response.status} - ${errorMsg}`);
    }

    console.error(`[URLScan] Submission error: ${error.message}`);
    throw new Error(`URLScan submission failed: ${error.message}`);
  }
}

/**
 * Poll for scan results
 * @param {string} uuid - Scan UUID
 * @returns {Promise<object>} - Scan results
 */
async function pollResults(uuid) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const response = await axios.get(
        `${URLSCAN_API_BASE}/result/${uuid}/`,
        { timeout: REQUEST_TIMEOUT_MS }
      );

      // Success - scan is complete
      return response.data;
    } catch (error) {
      // 404 means scan is still processing
      if (error.response && error.response.status === 404) {
        console.log(`[URLScan] Waiting for scan ${uuid}... (attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS})`);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        continue;
      }

      // Other errors
      throw new Error(`URLScan poll failed: ${error.message}`);
    }
  }

  throw new Error('URLScan timeout: Scan took too long to complete');
}

/**
 * Extract relevant security signals from URLScan results
 * @param {object} results - Full URLScan API response
 * @returns {object} - Normalized security data
 */
function extractSecuritySignals(results) {
  const page = results.page || {};
  const verdicts = results.verdicts || {};
  const lists = results.lists || {};
  const data = results.data || {};

  // Extract redirect chain
  const redirects = (data.requests || [])
    .filter(req => req.response?.redirectResponse)
    .map(req => req.request?.url || req.response?.url)
    .filter(Boolean);

  // Extract DOM flags (suspicious elements)
  const domFlags = [];

  // Check for login/password forms
  const links = data.links || [];
  const hasLoginForm = links.some(link =>
    link.href?.includes('login') ||
    link.href?.includes('signin') ||
    link.href?.includes('password')
  );
  if (hasLoginForm) {
    domFlags.push({
      selector: 'form[action*="login"]',
      issue: 'Credential form detected'
    });
  }

  // Check for suspicious keywords in page content
  const suspiciousKeywords = ['urgent', 'verify', 'suspend', 'unusual activity', 'confirm identity'];
  const pageText = page.text || '';
  suspiciousKeywords.forEach(keyword => {
    if (pageText.toLowerCase().includes(keyword)) {
      domFlags.push({
        selector: 'body',
        issue: `Suspicious keyword detected: "${keyword}"`
      });
    }
  });

  // Network analysis
  const networkRequests = (data.requests || []).length;
  const thirdPartyDomains = new Set(
    (data.requests || [])
      .map(req => {
        try {
          return new URL(req.request?.url || '').hostname;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  ).size;

  // Extract domain metadata (age, registrar, etc.)
  const domainMeta = {};

  // URLScan.io provides domain age in days via page.domain_age
  if (page.domain_age !== undefined && page.domain_age !== null) {
    domainMeta.domainAgeDays = page.domain_age;
  }

  // Some scans include certificate/TLS info with domain creation date
  if (page.tlsAge !== undefined && page.tlsAge !== null) {
    domainMeta.tlsAgeDays = page.tlsAge;
  }

  // Registrar info sometimes available in lists
  if (lists.domains && lists.domains.length > 0) {
    const domainInfo = lists.domains.find(d => d.domain === page.domain);
    if (domainInfo) {
      domainMeta.registrar = domainInfo.registrar;
      domainMeta.registrantCountry = domainInfo.country;
    }
  }

  return {
    url: page.url || results.task?.url,
    hostname: page.domain,
    observedAt: results.task?.time || new Date().toISOString(),
    redirects: redirects.length > 0 ? redirects : [results.task?.url],
    networkRequests,
    thirdPartyDomains,
    domFlags,
    domainMeta, // Add domain metadata from URLScan
    verdicts: {
      overall: verdicts.overall || {},
      urlscan: verdicts.urlscan || {},
      engines: verdicts.engines || {},
      community: verdicts.community || {}
    },
    lists: {
      ips: lists.ips || [],
      urls: lists.urls || [],
      domains: lists.domains || []
    },
    security: {
      score: page.score || 0,
      malicious: verdicts.overall?.malicious || false,
      hasPhishing: verdicts.overall?.categories?.includes('phishing') || false,
      hasMalware: verdicts.overall?.categories?.includes('malware') || false
    },
    meta: {
      server: page.server,
      ip: page.ip,
      asn: page.asn,
      asnname: page.asnname,
      country: page.country
    },
    screenshot: results.task?.screenshotURL,
    reportUrl: results.task?.reportURL
  };
}

/**
 * Inspect URL in URLScan.io sandbox
 * @param {string} url - URL to inspect
 * @returns {Promise<object>} - Security analysis results
 */
async function inspectUrlInSandbox(url) {
  // Validate URL
  try {
    new URL(url);
  } catch (_error) {
    throw new Error(`Invalid URL: ${url}`);
  }

  console.log(`[URLScan] Submitting URL for analysis: ${url}`);

  try {
    // Submit scan
    const uuid = await submitScan(url);
    console.log(`[URLScan] Scan submitted successfully. UUID: ${uuid}`);

    // Poll for results
    console.log(`[URLScan] Waiting for scan to complete...`);
    const rawResults = await pollResults(uuid);
    console.log(`[URLScan] Scan complete!`);

    // Extract and normalize security signals
    const securityData = extractSecuritySignals(rawResults);

    // Store raw results for debugging
    securityData.rawResults = rawResults;

    return securityData;
  } catch (error) {
    console.error(`[URLScan] Error analyzing URL:`, error.message);

    // Return degraded data if URLScan fails
    return {
      url,
      hostname: new URL(url).hostname,
      observedAt: new Date().toISOString(),
      redirects: [url],
      networkRequests: 0,
      domFlags: [],
      error: error.message,
      verdicts: {
        overall: { malicious: false }
      },
      security: {
        score: 0,
        malicious: false,
        hasPhishing: false,
        hasMalware: false
      }
    };
  }
}

module.exports = {
  inspectUrlInSandbox
};
