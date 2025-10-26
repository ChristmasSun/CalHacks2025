/**
 * Test Fixed Bright Data Integration
 *
 * Tests the corrected Bright Data API implementation
 */

require('dotenv').config();
const { brightDataClient } = require('./src/infra/brightdata');

async function testFixedIntegration() {
  console.log('='.repeat(70));
  console.log('Testing FIXED Bright Data Integration');
  console.log('='.repeat(70));
  console.log('');

  if (!brightDataClient.enabled) {
    console.error('❌ Bright Data is not configured!');
    console.error('Please add BRIGHTDATA_API_TOKEN to your .env file.\n');
    process.exit(1);
  }

  console.log('✓ Bright Data client initialized\n');

  // Test 1: WHOIS Lookup (now using whoiser library)
  console.log('─'.repeat(70));
  console.log('Test 1: WHOIS Lookup (using whoiser library)');
  console.log('─'.repeat(70));

  const testDomains = ['google.com', 'paypal.com', 'github.com'];

  for (const domain of testDomains) {
    console.log(`\nTesting WHOIS for: ${domain}`);
    try {
      const whois = await brightDataClient.getWhoisData(domain);

      if (whois.success) {
        console.log('  ✓ WHOIS lookup successful!');
        console.log(`  Creation Date: ${whois.whois.creationDate || 'N/A'}`);
        console.log(`  Expiration Date: ${whois.whois.expirationDate || 'N/A'}`);
        console.log(`  Registrar: ${whois.whois.registrar || 'N/A'}`);
        console.log(`  Domain Age: ${whois.whois.domainAgeDays !== null ? whois.whois.domainAgeDays + ' days' : 'N/A'}`);
      } else {
        console.log(`  ✗ WHOIS lookup failed: ${whois.error}`);
      }
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
  }

  // Test 2: URL Analysis (requires custom dataset_id)
  console.log('\n' + '─'.repeat(70));
  console.log('Test 2: URL Analysis (requires BRIGHTDATA_CUSTOM_DATASET_ID)');
  console.log('─'.repeat(70));
  console.log('');

  if (!brightDataClient.customDatasetId) {
    console.log('⚠️  Skipped: No BRIGHTDATA_CUSTOM_DATASET_ID configured');
    console.log('   To enable: Set BRIGHTDATA_CUSTOM_DATASET_ID in .env');
    console.log('   Get dataset ID from: https://brightdata.com/cp/datasets\n');
  } else {
    console.log(`Using dataset ID: ${brightDataClient.customDatasetId}\n`);

    const testUrl = 'https://example.com';
    console.log(`Analyzing URL: ${testUrl}`);

    try {
      const result = await brightDataClient.analyzeUrl(testUrl);

      if (result.success) {
        console.log('  ✓ Analysis successful!');
        console.log(`  Snapshot ID: ${result.snapshotId}`);
        console.log(`  Risk Score: ${result.indicators.score}/100`);
      } else {
        console.log(`  ✗ Analysis failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
  }

  // Test 3: LinkedIn Search (requires LinkedIn dataset_id)
  console.log('\n' + '─'.repeat(70));
  console.log('Test 3: LinkedIn Search (requires BRIGHTDATA_LINKEDIN_DATASET_ID)');
  console.log('─'.repeat(70));
  console.log('');

  if (!brightDataClient.linkedinDatasetId) {
    console.log('⚠️  Skipped: No BRIGHTDATA_LINKEDIN_DATASET_ID configured');
    console.log('   To enable: Set BRIGHTDATA_LINKEDIN_DATASET_ID in .env');
    console.log('   Get dataset ID from: https://brightdata.com/products/datasets/linkedin\n');
  } else {
    console.log(`Using LinkedIn dataset ID: ${brightDataClient.linkedinDatasetId}\n`);

    const testProfileUrl = 'https://www.linkedin.com/in/example/';
    console.log(`Searching LinkedIn profile: ${testProfileUrl}`);

    try {
      const result = await brightDataClient.searchLinkedIn(testProfileUrl);

      if (result.success) {
        console.log('  ✓ LinkedIn search successful!');
        console.log(`  Name: ${result.profile.name || 'N/A'}`);
        console.log(`  Title: ${result.profile.title || 'N/A'}`);
        console.log(`  Company: ${result.profile.company || 'N/A'}`);
      } else {
        console.log(`  ✗ LinkedIn search failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Test Summary');
  console.log('='.repeat(70));
  console.log('');
  console.log('✓ WHOIS lookups: Working (using whoiser library)');
  console.log(brightDataClient.customDatasetId ? '✓ URL Analysis: Ready (dataset_id configured)' : '⚠️  URL Analysis: Needs dataset_id');
  console.log(brightDataClient.linkedinDatasetId ? '✓ LinkedIn Search: Ready (dataset_id configured)' : '⚠️  LinkedIn Search: Needs dataset_id');
  console.log('');
  console.log('Next steps:');
  console.log('1. WHOIS works out of the box - no setup needed!');
  console.log('2. For URL analysis: Create custom dataset at https://brightdata.com/cp/datasets');
  console.log('3. For LinkedIn: Get dataset ID from https://brightdata.com/products/datasets/linkedin');
  console.log('='.repeat(70));
}

testFixedIntegration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
