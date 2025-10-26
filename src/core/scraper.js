// Enrichment layer that combines URLScan.io data with additional metadata
// Domain age and registrar info now comes from URLScan.io instead of mock data

const { brightDataClient } = require('../infra/brightdata');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function enrichWithScrapedMetadata(analysis) {
  const { url, sandboxMetadata } = analysis;
  await delay(200);

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch (_error) {
      return 'unknown-host';
    }
  })();

  // Extract REAL domain metadata from URLScan.io
  const domainMeta = sandboxMetadata?.domainMeta || {};

  // Use real domain age from URLScan.io, or null if not available
  const domainAgeDays = domainMeta.domainAgeDays !== undefined
    ? domainMeta.domainAgeDays
    : null;

  // Calculate reputation score from real domain age (if available)
  let reputationScore = 50; // Default neutral score
  if (domainAgeDays !== null) {
    // Young domains are suspicious: 0-30 days = low score, older = higher score
    reputationScore = Math.min(100, Math.max(0, domainAgeDays * 2));
  }

  // Use real registrar info from URLScan.io
  const registrar = domainMeta.registrar || null;
  const registrantCountry = domainMeta.registrantCountry || null;

  // ========================================
  // Bright Data Enhanced Threat Intelligence
  // ========================================
  let brightDataAnalysis = null;
  let brightDataWhois = null;

  // Only run Bright Data enrichment if API is actually configured
  // (prevents unnecessary WHOIS timeouts when Bright Data is disabled)
  if (url && brightDataClient.enabled && process.env.BRIGHTDATA_API_TOKEN) {
    try {
      console.log('[Scraper] Enriching with Bright Data threat intelligence...');

      // Run both analyses in parallel with 20-second timeout (reduced to prevent freezes)
      const brightDataPromise = Promise.all([
        brightDataClient.analyzeUrl(url).catch(err => {
          console.warn('[Scraper] Bright Data URL analysis failed:', err.message);
          return { success: false, error: err.message };
        }),
        brightDataClient.getWhoisData(hostname).catch(err => {
          console.warn('[Scraper] WHOIS lookup failed:', err.message);
          return { success: false, error: err.message };
        })
      ]);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Bright Data timeout after 20 seconds')), 20000)
      );

      const [urlAnalysis, whoisData] = await Promise.race([
        brightDataPromise,
        timeoutPromise
      ]);

      brightDataAnalysis = urlAnalysis.success ? urlAnalysis.indicators : null;
      brightDataWhois = whoisData.success ? whoisData.whois : null;

      if (brightDataAnalysis) {
        console.log(`[Scraper] Bright Data detected ${brightDataAnalysis.score} risk points from page analysis`);
      }
      if (brightDataWhois) {
        console.log('[Scraper] Bright Data WHOIS data retrieved successfully');
      }
    } catch (error) {
      console.warn('[Scraper] Bright Data enrichment failed (may have timed out):', error.message);
    }
  }

  return {
    ...analysis,
    brightData: {
      url,
      hostname,
      reputationScore,
      whois: {
        domainAgeDays, // REAL data from URLScan.io (or null)
        registrar,     // REAL data from URLScan.io (or null)
        registrantCountry, // REAL data from URLScan.io (or null)
        contactEmails: [],
        source: domainAgeDays !== null ? 'urlscan.io' : 'unavailable',
        // Additional WHOIS data from Bright Data (if available)
        brightDataWhois
      },
      redirects: analysis.sandboxMetadata?.redirects ?? [],
      // Enhanced threat indicators from Bright Data
      indicators: brightDataAnalysis,
      enabled: brightDataClient.enabled
    }
  };
}

module.exports = {
  enrichWithScrapedMetadata
};
