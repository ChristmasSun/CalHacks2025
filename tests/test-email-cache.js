/**
 * Test Email Verification Caching
 * Verifies that duplicate emails are cached and not re-verified
 */

require('dotenv').config();
const { emailVerifier } = require('./src/infra/email-verifier');

async function testCaching() {
  console.log('='.repeat(60));
  console.log('Email Verification Cache Test');
  console.log('='.repeat(60));
  console.log('');

  const testEmail = {
    from: 'PayPal Security <security@paypal-verify.com>',
    subject: 'Urgent: Verify your PayPal account',
    body: 'Your account has been suspended.'
  };

  console.log('Test: Verify same email 3 times');
  console.log('Expected: 1st = full verification, 2nd & 3rd = cached\n');

  // First verification - should do full check
  console.log('[1] First verification (should be fresh):');
  const start1 = Date.now();
  const result1 = await emailVerifier.verifyEmail(testEmail);
  const time1 = Date.now() - start1;
  console.log(`   Risk Score: ${result1.riskScore}/100`);
  console.log(`   Time: ${time1}ms`);
  console.log(`   Cached: NO (fresh verification)\n`);

  // Second verification - should use cache
  console.log('[2] Second verification (should be cached):');
  const start2 = Date.now();
  const result2 = await emailVerifier.verifyEmail(testEmail);
  const time2 = Date.now() - start2;
  console.log(`   Risk Score: ${result2.riskScore}/100`);
  console.log(`   Time: ${time2}ms`);
  console.log(`   Cached: ${time2 < 5 ? 'YES (instant!)' : 'NO'}\n`);

  // Third verification - should also use cache
  console.log('[3] Third verification (should be cached):');
  const start3 = Date.now();
  const result3 = await emailVerifier.verifyEmail(testEmail);
  const time3 = Date.now() - start3;
  console.log(`   Risk Score: ${result3.riskScore}/100`);
  console.log(`   Time: ${time3}ms`);
  console.log(`   Cached: ${time3 < 5 ? 'YES (instant!)' : 'NO'}\n`);

  // Show cache stats
  const stats = emailVerifier.getCacheStats();
  console.log('='.repeat(60));
  console.log('Cache Statistics:');
  console.log(`  Items in cache: ${stats.itemCount}`);
  console.log(`  Max capacity: ${stats.max}`);
  console.log(`  TTL: ${stats.ttl / 1000 / 60 / 60} hours`);
  console.log('='.repeat(60));

  // Performance comparison
  console.log('');
  console.log('Performance:');
  console.log(`  1st call (fresh):  ${time1}ms`);
  console.log(`  2nd call (cached): ${time2}ms`);
  console.log(`  3rd call (cached): ${time3}ms`);
  if (time2 < time1 && time3 < time1) {
    console.log(`  ✓ Cache is working! ${Math.round((time1 / time2) * 10) / 10}x faster`);
  } else {
    console.log('  ✗ Cache may not be working properly');
  }
}

testCaching().catch(console.error);
