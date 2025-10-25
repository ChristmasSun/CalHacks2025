# Bright Data Integration Guide

## Overview

ScamShield now integrates with **Bright Data** for enhanced threat intelligence and phishing detection. This optional but powerful feature adds real-time web analysis capabilities to complement URLScan.io's VM sandbox.

## What Bright Data Adds

### 1. **Real-Time Page Analysis**
- **Login form detection** - Identifies credential harvesting attempts
- **Password field scanning** - Flags sites requesting sensitive data
- **Credit card form detection** - Catches payment scams
- **Obfuscated script analysis** - Detects eval(), atob(), and other suspicious JS patterns
- **External link analysis** - Identifies excessive redirects and link farms

### 2. **Brand Impersonation Detection**
- Scans page titles and content for misleading brand names
- Flags common phishing targets (PayPal, Amazon, Apple, banks, etc.)
- Detects urgency language ("verify now", "suspended account", "act immediately")

### 3. **WHOIS Data Enrichment**
- Real-time domain registration data
- Registrar information
- Domain creation/expiration dates
- Registrant country
- Name server information

## Setup Instructions

### 1. Get Bright Data Credentials

1. Sign up at [https://brightdata.com/cp/start](https://brightdata.com/cp/start)
2. Navigate to your dashboard
3. Find your **API Token** (or create one)
4. Copy the token

### 2. Configure Environment

Add your token to `.env`:

```bash
BRIGHTDATA_API_TOKEN=your_brightdata_api_token_here
```

### 3. Test the Integration

Run the test script to verify everything works:

```bash
node test-brightdata.js
```

Expected output:
```
============================================================
Testing Bright Data Integration
============================================================

✓ Bright Data client initialized

------------------------------------------------------------
Testing URL: https://www.paypal.com
------------------------------------------------------------

[1] Analyzing URL for scam indicators...
✓ Analysis successful!

Detected Indicators:
  - Login Form: true
  - Password Field: true
  - Credit Card Form: false
  - Misleading Title: true
  - Urgency Language: false
  - Suspicious Scripts: false
  - Risk Score: 55/100

[2] Fetching WHOIS data for www.paypal.com...
✓ WHOIS data retrieved!
  Domain: www.paypal.com
  Timestamp: 2025-10-25T...
```

## How It Works

### Integration Flow

1. **URL Submitted** → User copies URL or browser tab changes
2. **URLScan.io Analysis** → Primary VM-based sandbox analysis
3. **Bright Data Enhancement** → Parallel threat intelligence enrichment
4. **Risk Scoring** → Combined signals produce final risk score

### Architecture

```
orchestrateAnalysis()  (main.js:514)
    ↓
enrichWithScrapedMetadata()  (scraper.js:8)
    ↓
brightDataClient.analyzeUrl()  (brightdata.js:30)
brightDataClient.getWhoisData()  (brightdata.js:88)
    ↓
scoreRisk()  (scorer.js:81)
    ↓
Risk Assessment + Alert
```

### Risk Scoring Weight

Bright Data signals are weighted **40%** of their raw score to complement URLScan.io's expert verdicts:

- **URLScan.io verdict**: Primary signal (90-95 points for malicious)
- **Bright Data indicators**: Secondary enhancement (+0-40 points)
- **Domain age**: Tertiary signal (+0-14 points, 40% weighted)

Example: If Bright Data detects a credential harvesting form (BD score: 50), it adds **20 points** to the final risk score.

## API Rate Limits

Bright Data enforces rate limits based on request type:

- **Single URL requests**: Standard rate limits apply
- **Batch requests**: Use `batchAnalyze()` for processing multiple URLs
- **429 errors**: Indicates rate limit exceeded, back off and retry

The ScamShield scan queue already handles rate limiting for URLScan.io, and Bright Data requests are made in parallel without blocking the main analysis pipeline.

## API Methods

### `analyzeUrl(url)`
Analyzes a URL for scam indicators in real-time.

**Returns:**
```javascript
{
  success: true,
  url: "https://example.com",
  indicators: {
    hasLoginForm: false,
    hasPasswordField: false,
    hasCreditCardForm: false,
    misleadingTitle: false,
    urgencyLanguage: false,
    suspiciousScripts: false,
    score: 15  // 0-100 risk score
  },
  timestamp: "2025-10-25T..."
}
```

### `getWhoisData(domain)`
Fetches WHOIS information for a domain.

**Returns:**
```javascript
{
  success: true,
  domain: "example.com",
  whois: {
    creation_date: "2020-01-15",
    registrar: "GoDaddy",
    registrant_country: "US",
    // ... additional WHOIS fields
  },
  timestamp: "2025-10-25T..."
}
```

### `batchAnalyze(urls)`
Submits multiple URLs for asynchronous processing.

**Returns:**
```javascript
{
  success: true,
  jobId: "abc123...",
  urlCount: 10,
  message: "Batch job started. Use getBatchResults() to retrieve results."
}
```

## Disabling Bright Data

If you want to disable Bright Data temporarily:

1. **Remove/comment** the `BRIGHTDATA_API_TOKEN` from `.env`, OR
2. The integration will gracefully degrade:
   ```
   [BrightData] API token not configured. Bright Data features disabled.
   ```

ScamShield will continue to work with URLScan.io alone - Bright Data is fully optional.

## Cost Considerations

Bright Data is a **paid service** with usage-based pricing:

- **Synchronous scraping**: Per-request charges
- **Data transfer**: Bandwidth costs
- **WHOIS lookups**: Minimal cost per query

For a hackathon demo or development:
- Use the test script sparingly to conserve credits
- Consider adding URL filtering to skip known-safe domains
- Monitor usage in the Bright Data dashboard

For production use:
- Implement caching to reduce duplicate requests (already done via LRU cache)
- Use batch processing for large URL lists
- Set up budget alerts in Bright Data dashboard

## Troubleshooting

### "API token not configured"
- Check `.env` file has `BRIGHTDATA_API_TOKEN=...`
- Restart the app after adding the token
- Verify no extra spaces or quotes around the token

### "Request failed" errors
- Check your Bright Data account has active credits
- Verify API token is valid and not expired
- Check network connectivity

### "Rate limit exceeded" (429)
- Wait 60 seconds and retry
- Consider implementing request throttling
- Use batch API for multiple URLs

### Integration not showing in logs
- Check that `brightDataClient.enabled` is true
- Look for `[Scraper] Enriching with Bright Data...` in logs
- Verify no errors during module initialization

## Security Notes

- **Never commit** your `.env` file with real API tokens
- Use `.env.example` as a template for team members
- Store tokens securely (use environment variables in production)
- Rotate tokens regularly for security best practices

## Support

For Bright Data API issues:
- Documentation: [https://docs.brightdata.com](https://docs.brightdata.com)
- Support: Contact Bright Data support team

For ScamShield integration issues:
- Check logs in terminal/console
- Review the test script output
- Inspect `src/infra/brightdata.js` for implementation details
