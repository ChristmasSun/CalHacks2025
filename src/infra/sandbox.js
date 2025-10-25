// Placeholder Playwright/Puppeteer automation that pretends to visit the URL in a headless browser.
// Swap with Playwright's `chromium.launch()` or Puppeteer's `puppeteer.launch()` for real runs.

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function inspectUrlInSandbox(url) {
  await delay(220);

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch (_error) {
      return 'invalid-host';
    }
  })();

  return {
    url,
    hostname,
    observedAt: new Date().toISOString(),
    redirects: [
      `${url}`,
      `${url.replace('http://', 'https://')}`
    ],
    networkRequests: 37,
    domFlags: [
      {
        selector: 'form[action*="login"]',
        issue: 'Credential form detected'
      },
      {
        selector: 'a[href*="reset"]',
        issue: 'Password reset lure'
      }
    ]
  };
}

module.exports = {
  inspectUrlInSandbox
};
