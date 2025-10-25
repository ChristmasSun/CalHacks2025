// Mock Bright Data scraping enrichment. Replace with real Bright Data calls when ready.

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function enrichWithScrapedMetadata(analysis) {
  const { url } = analysis;
  await delay(200);

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch (_error) {
      return 'unknown-host';
    }
  })();

  const domainAgeDays = Math.floor(Math.random() * 45) + 1;
  const riskKeywords = ['urgent payment', 'limited offer', 'IRS'];

  return {
    ...analysis,
    brightData: {
      url,
      hostname,
      reputationScore: Math.max(0, 100 - domainAgeDays * 1.7),
      whois: {
        domainAgeDays,
        registrar: 'Mock Registrar LLC',
        registrantCountry: 'PA',
        contactEmails: []
      },
      redirects: analysis.sandboxMetadata?.redirects ?? [],
      keywordMatches: riskKeywords.filter((keyword) => keyword && Math.random() > 0.4)
    }
  };
}

module.exports = {
  enrichWithScrapedMetadata
};
