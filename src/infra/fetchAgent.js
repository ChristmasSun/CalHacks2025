// Mock wrapper for Fetch.ai agent interactions. Swap with the real SDK when available.
// const { Agent } = require('@fetchai/agent-sdk');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function queryFetchAgent({ url, persona = 'scam-sleuth' } = {}) {
  await delay(180);

  const normalizedUrl = url?.trim() ?? '';
  const syntheticVerdict =
    normalizedUrl.includes('bank') || normalizedUrl.includes('login') ? 'high-risk' : 'needs-review';

  return {
    persona,
    url: normalizedUrl,
    verdict: syntheticVerdict,
    confidence: syntheticVerdict === 'high-risk' ? 0.82 : 0.55,
    highlights: [
      {
        type: 'keyword',
        value: 'urgent action required',
        weight: 0.7
      },
      {
        type: 'brand-impersonation',
        value: 'Impersonates known institution',
        weight: 0.6
      }
    ]
  };
}

module.exports = {
  queryFetchAgent
};
