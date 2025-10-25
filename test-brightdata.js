/**
 * Test Script for Bright Data Integration
 *
 * Tests the Bright Data threat intelligence features:
 * - URL analysis for scam indicators
 * - WHOIS data collection
 * - Phishing detection
 *
 * Usage: node test-brightdata.js
 */

require('dotenv').config();
const { brightDataClient } = require('./src/infra/brightdata');

async function testBrightData() {
  console.log('='.repeat(60));
  console.log('Testing Bright Data Integration');
  console.log('='.repeat(60));

  if (!brightDataClient.enabled) {
    console.error('\n❌ Bright Data is not configured!');
    console.error('Please add BRIGHTDATA_API_TOKEN to your .env file.\n');
    process.exit(1);
  }

  console.log('\n✓ Bright Data client initialized\n');

  // Test URLs
  const testUrls = [
    'https://www.paypal.com', // Legitimate site
    'https://secure-paypal-verify.com', // Potential phishing (example)
    'https://google.com' // Known safe
  ];

  for (const url of testUrls) {
    console.log('-'.repeat(60));
    console.log(`Testing URL: ${url}`);
    console.log('-'.repeat(60));

    try {
      // Test URL analysis
      console.log('\n[1] Analyzing URL for scam indicators...');
      const analysis = await brightDataClient.analyzeUrl(url);

      if (analysis.success) {
        console.log('✓ Analysis successful!');
        console.log('\nDetected Indicators:');
        console.log(`  - Login Form: ${analysis.indicators.hasLoginForm}`);
        console.log(`  - Password Field: ${analysis.indicators.hasPasswordField}`);
        console.log(`  - Credit Card Form: ${analysis.indicators.hasCreditCardForm}`);
        console.log(`  - Misleading Title: ${analysis.indicators.misleadingTitle}`);
        console.log(`  - Urgency Language: ${analysis.indicators.urgencyLanguage}`);
        console.log(`  - Suspicious Scripts: ${analysis.indicators.suspiciousScripts}`);
        console.log(`  - Risk Score: ${analysis.indicators.score}/100`);
      } else {
        console.log('✗ Analysis failed:', analysis.error);
      }

      // Test WHOIS lookup
      const hostname = new URL(url).hostname;
      console.log(`\n[2] Fetching WHOIS data for ${hostname}...`);
      const whois = await brightDataClient.getWhoisData(hostname);

      if (whois.success) {
        console.log('✓ WHOIS data retrieved!');
        console.log('  Domain:', whois.domain);
        console.log('  Timestamp:', whois.timestamp);
      } else {
        console.log('✗ WHOIS lookup failed:', whois.error);
      }

    } catch (error) {
      console.error('✗ Test failed:', error.message);
    }

    console.log('\n');
  }

  console.log('='.repeat(60));
  console.log('Bright Data Test Complete');
  console.log('='.repeat(60));
}

// Run tests
testBrightData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
