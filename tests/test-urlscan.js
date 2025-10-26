#!/usr/bin/env node

/**
 * Test script for URLScan.io integration
 *
 * Usage:
 *   node test-urlscan.js <url>
 *   node test-urlscan.js https://example.com
 *
 * Make sure you have URLSCAN_API_KEY set in .env file first!
 */

require('dotenv').config();
const { inspectUrlInSandbox } = require('./src/infra/sandbox.js');

const testUrl = process.argv[2] || 'https://example.com';

console.log('=== URLScan.io Integration Test ===\n');
console.log(`Testing URL: ${testUrl}\n`);

if (!process.env.URLSCAN_API_KEY) {
  console.error('❌ ERROR: URLSCAN_API_KEY not found in .env file');
  console.error('\nPlease:');
  console.error('1. Create a .env file: cp .env.example .env');
  console.error('2. Add your API key to .env');
  console.error('3. Get API key from: https://urlscan.io/user/profile/\n');
  process.exit(1);
}

console.log('✓ API Key found\n');
console.log('Starting scan... (this may take 10-30 seconds)\n');

inspectUrlInSandbox(testUrl)
  .then(result => {
    console.log('\n=== SCAN RESULTS ===\n');

    // Basic info
    console.log('URL:', result.url);
    console.log('Hostname:', result.hostname);
    console.log('Scanned at:', result.observedAt);
    console.log('');

    // Security verdict
    console.log('=== SECURITY VERDICT ===');
    if (result.security) {
      console.log('Malicious:', result.security.malicious ? '⚠️  YES' : '✓ No');
      console.log('Phishing:', result.security.hasPhishing ? '⚠️  YES' : '✓ No');
      console.log('Malware:', result.security.hasMalware ? '⚠️  YES' : '✓ No');
      console.log('Risk Score:', result.security.score + '/100');
    } else {
      console.log('No security data available');
    }
    console.log('');

    // Network analysis
    console.log('=== NETWORK ANALYSIS ===');
    console.log('Total Requests:', result.networkRequests);
    console.log('Third-party Domains:', result.thirdPartyDomains);
    console.log('Redirects:', result.redirects?.length || 0);
    if (result.redirects && result.redirects.length > 1) {
      console.log('Redirect Chain:');
      result.redirects.forEach((redirect, i) => {
        console.log(`  ${i + 1}. ${redirect}`);
      });
    }
    console.log('');

    // Suspicious elements
    console.log('=== SUSPICIOUS ELEMENTS ===');
    if (result.domFlags && result.domFlags.length > 0) {
      console.log(`Found ${result.domFlags.length} suspicious elements:`);
      result.domFlags.forEach((flag, i) => {
        console.log(`  ${i + 1}. ${flag.issue}`);
        console.log(`     Selector: ${flag.selector}`);
      });
    } else {
      console.log('✓ No suspicious elements detected');
    }
    console.log('');

    // Server info
    if (result.meta) {
      console.log('=== SERVER INFO ===');
      console.log('IP:', result.meta.ip);
      console.log('Country:', result.meta.country);
      console.log('ASN:', result.meta.asn, result.meta.asnname);
      console.log('Server:', result.meta.server);
      console.log('');
    }

    // Links
    console.log('=== RESOURCES ===');
    if (result.screenshot) {
      console.log('Screenshot:', result.screenshot);
    }
    if (result.reportUrl) {
      console.log('Full Report:', result.reportUrl);
    }
    console.log('');

    // Error handling
    if (result.error) {
      console.log('⚠️  WARNING: Scan completed with errors:');
      console.log(result.error);
      console.log('');
    }

    console.log('=== TEST COMPLETE ===\n');

    // Summary
    const isSafe = !result.security?.malicious &&
                   !result.security?.hasPhishing &&
                   !result.security?.hasMalware &&
                   result.security?.score < 50;

    if (isSafe) {
      console.log('✅ URL appears to be SAFE based on URLScan analysis');
    } else {
      console.log('⚠️  URL shows RISK INDICATORS - use caution!');
    }
    console.log('');
  })
  .catch(error => {
    console.error('\n❌ TEST FAILED\n');
    console.error('Error:', error.message);
    console.error('');

    if (error.message.includes('URLSCAN_API_KEY')) {
      console.error('Make sure your API key is set in .env');
    } else if (error.message.includes('401')) {
      console.error('Your API key is invalid. Get a new one from:');
      console.error('https://urlscan.io/user/profile/');
    } else if (error.message.includes('429')) {
      console.error('Rate limit exceeded. Check your quotas at:');
      console.error('https://urlscan.io/user/quotas/');
    } else {
      console.error('Full error details:', error);
    }
    console.error('');
    process.exit(1);
  });
