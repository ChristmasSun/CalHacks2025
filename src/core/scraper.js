// Enrichment layer that combines URLScan.io data with additional metadata
// Domain age and registrar info now comes from URLScan.io instead of mock data

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

  // Mock keyword matching (could be enhanced with real page text analysis)
  const riskKeywords = ['urgent payment', 'limited offer', 'IRS'];

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
        source: domainAgeDays !== null ? 'urlscan.io' : 'unavailable'
      },
      redirects: analysis.sandboxMetadata?.redirects ?? [],
      keywordMatches: riskKeywords.filter((keyword) => keyword && Math.random() > 0.4)
    }
  };
}

module.exports = {
  enrichWithScrapedMetadata
};
