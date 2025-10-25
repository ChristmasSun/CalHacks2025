/**
 * Test Script for Email Authenticity Verification
 *
 * Tests the email verifier with various phishing and legitimate email scenarios
 *
 * Usage: node test-email-verifier.js
 */

require('dotenv').config();
const { emailVerifier } = require('./src/infra/email-verifier');

// Test email samples
const testEmails = [
  {
    name: 'Legitimate PayPal',
    from: 'PayPal Service <service@paypal.com>',
    subject: 'Your PayPal receipt',
    body: 'Thank you for your recent payment.'
  },
  {
    name: 'PayPal Phishing (Typosquatting)',
    from: 'PayPal Security <security@paypal-verify.com>',
    subject: 'Urgent: Verify your PayPal account now',
    body: 'Your account has been suspended. Click here to verify your identity immediately.'
  },
  {
    name: 'PayPal Phishing (Character Substitution)',
    from: 'PayPal Support <support@paypa1.com>',
    subject: 'Action required: Confirm your payment method',
    body: 'We detected unusual activity. Please confirm your credit card information.'
  },
  {
    name: 'Brand Impersonation (Claimed PayPal, but wrong domain)',
    from: 'PayPal Security Team <noreply@secure-payments.net>',
    subject: 'Security Alert: Suspicious login detected',
    body: 'Someone tried to access your PayPal account. Verify your identity now.'
  },
  {
    name: 'Legitimate Amazon',
    from: 'Amazon.com <order-update@amazon.com>',
    subject: 'Your Amazon.com order has shipped',
    body: 'Your order #123-456-789 has been shipped and is on its way.'
  },
  {
    name: 'Amazon Phishing',
    from: 'Amazon Security <security@amazon-account.net>',
    subject: 'URGENT: Your Amazon account will be suspended',
    body: 'Immediate action required. Your account shows unusual activity. Confirm your payment method or your account will be closed.'
  },
  {
    name: 'IRS Scam',
    from: 'IRS Collections <collections@irs-taxrefund.com>',
    subject: 'Final Notice: Tax Refund Pending',
    body: 'You have a pending tax refund. Act now to claim your refund before it expires. Wire transfer required.'
  },
  {
    name: 'Bank Phishing',
    from: 'Chase Bank Security <alerts@chase-online.net>',
    subject: 'Verify your account - Urgent',
    body: 'Your Chase account has been locked due to suspicious activity. Update your information immediately to avoid permanent suspension.'
  },
  {
    name: 'Generic Phishing',
    from: 'System Administrator <admin@secure-login.xyz>',
    subject: 'Password Reset Required',
    body: 'Your email password will expire in 24 hours. Click here to reset your password and avoid account closure.'
  },
  {
    name: 'Legitimate Google',
    from: 'Google <no-reply@accounts.google.com>',
    subject: 'Security alert',
    body: 'We noticed a new sign-in to your Google Account.'
  }
];

async function runTests() {
  console.log('='.repeat(70));
  console.log('Email Authenticity Verification Test Suite');
  console.log('='.repeat(70));
  console.log('');

  let testsPassed = 0;
  let testsFailed = 0;

  for (const [index, email] of testEmails.entries()) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Test ${index + 1}/${testEmails.length}: ${email.name}`);
    console.log(`${'─'.repeat(70)}`);

    console.log(`From:    ${email.from}`);
    console.log(`Subject: ${email.subject}`);
    console.log(`Body:    ${email.body.substring(0, 60)}${email.body.length > 60 ? '...' : ''}`);
    console.log('');

    try {
      const result = await emailVerifier.verifyEmail({
        from: email.from,
        subject: email.subject,
        body: email.body
      });

      console.log(`Result: ${result.legitimate ? '✓ LEGITIMATE' : '⚠️  SUSPICIOUS'}`);
      console.log(`Risk Score: ${result.riskScore}/100`);
      console.log(`Risk Level: ${result.riskLevel.toUpperCase()}`);

      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach((warning, i) => {
          console.log(`  ${i + 1}. ${warning}`);
        });
      } else {
        console.log('\nNo warnings detected.');
      }

      if (result.details.senderDomain) {
        console.log(`\nSender Domain: ${result.details.senderDomain}`);
      }

      // Check if result matches expected (phishing emails should be flagged)
      const isPhishingTest = email.name.toLowerCase().includes('phishing') ||
                            email.name.toLowerCase().includes('scam') ||
                            email.name.toLowerCase().includes('impersonation');

      if (isPhishingTest && !result.legitimate) {
        console.log('\n✓ Test PASSED - Correctly identified as suspicious');
        testsPassed++;
      } else if (!isPhishingTest && result.legitimate) {
        console.log('\n✓ Test PASSED - Correctly identified as legitimate');
        testsPassed++;
      } else {
        console.log('\n✗ Test FAILED - Incorrect classification');
        testsFailed++;
      }

    } catch (error) {
      console.error(`✗ Test ERROR: ${error.message}`);
      testsFailed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Test Summary');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${testEmails.length}`);
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Success Rate: ${Math.round((testsPassed / testEmails.length) * 100)}%`);
  console.log('='.repeat(70));

  if (emailVerifier.enabled) {
    console.log('\n✓ Bright Data integration is enabled');
    console.log('  - Domain age verification: Active');
    console.log('  - WHOIS lookups: Active');
  } else {
    console.log('\n⚠️  Bright Data integration is disabled');
    console.log('  - Add BRIGHTDATA_API_TOKEN to .env for enhanced verification');
    console.log('  - Domain age checks and WHOIS lookups will be skipped');
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
console.log('\nStarting email verification tests...\n');
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
