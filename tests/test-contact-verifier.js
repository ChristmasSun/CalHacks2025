/**
 * Test Script for Contact Verification
 *
 * Tests the person verifier with various scenarios
 *
 * Usage: node test-contact-verifier.js
 */

require('dotenv').config();
const { personVerifier } = require('./src/infra/person-verifier');

// Test text samples
const testSamples = [
  {
    name: 'LinkedIn Message - Legitimate',
    text: `Hi! I'm John Smith from Google Inc.

I came across your profile and wanted to reach out about a potential collaboration.

Best regards,
John Smith
Senior Engineer at Google
john.smith@google.com
linkedin.com/in/johnsmith`
  },
  {
    name: 'LinkedIn Message - Suspicious (Personal Email)',
    text: `Hello,

I'm Sarah Johnson, CEO of Microsoft Corporation.

I'd like to discuss a business opportunity with you.

Regards,
Sarah Johnson
CEO, Microsoft
sarah.ceo2023@gmail.com`
  },
  {
    name: 'Email Signature - Legitimate',
    text: `Thanks for reaching out!

Let's schedule a call next week.

Best,
Michael Chen
Product Manager
Apple Inc.
michael.chen@apple.com
(408) 555-1234`
  },
  {
    name: 'Phishing Attempt - Wrong Domain',
    text: `Dear valued customer,

This is Tim Cook from Apple Support Team.

We need to verify your account immediately.

Contact me at:
tim.cook@apple-support.net
Phone: (555) 123-4567`
  },
  {
    name: 'Suspicious - Suspicious TLD',
    text: `Hello,

I'm Jennifer Williams, HR Director at Amazon.

I have an urgent job offer for you.

Jennifer Williams
HR Director
Amazon Inc.
j.williams@amazon-careers.xyz`
  },
  {
    name: 'Simple Contact Info',
    text: `Name: Robert Martinez
Email: robert.martinez@netflix.com
Company: Netflix
Title: Senior Developer`
  }
];

async function runTests() {
  console.log('='.repeat(70));
  console.log('Contact Verification Test Suite');
  console.log('='.repeat(70));
  console.log('');

  if (!personVerifier.enabled) {
    console.log('⚠️  Bright Data is disabled (no API token configured)');
    console.log('  - Basic verification will still work');
    console.log('  - LinkedIn search and advanced features disabled');
    console.log('');
  } else {
    console.log('✓ Bright Data integration enabled');
    console.log('');
  }

  for (const [index, sample] of testSamples.entries()) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Test ${index + 1}/${testSamples.length}: ${sample.name}`);
    console.log(`${'─'.repeat(70)}`);
    console.log('Input Text:');
    console.log(sample.text.substring(0, 200) + (sample.text.length > 200 ? '...' : ''));
    console.log('');

    try {
      const result = await personVerifier.analyzeText(sample.text);

      // Display parsed contact info
      console.log('📋 Extracted Contact Information:');
      if (result.contact.name) {
        console.log(`  Name: ${result.contact.name}`);
      }
      if (result.contact.email) {
        console.log(`  Email: ${result.contact.email}`);
      }
      if (result.contact.company) {
        console.log(`  Company: ${result.contact.company}`);
      }
      if (result.contact.title) {
        console.log(`  Title: ${result.contact.title}`);
      }
      if (result.contact.phone) {
        console.log(`  Phone: ${result.contact.phone}`);
      }

      console.log('');

      // Display verification results
      console.log('🔍 Verification Results:');
      console.log(`  Status: ${result.verification.verified ? '✓ VERIFIED' : '⚠️  NOT VERIFIED'}`);
      console.log(`  Confidence: ${result.verification.confidence}%`);
      console.log(`  Risk Score: ${result.verification.riskScore}/100`);
      console.log(`  Risk Level: ${result.verification.riskLevel.toUpperCase()}`);

      if (result.verification.matches && result.verification.matches.length > 0) {
        console.log('');
        console.log('✓ Positive Indicators:');
        result.verification.matches.forEach(match => {
          console.log(`  • ${match}`);
        });
      }

      if (result.verification.warnings && result.verification.warnings.length > 0) {
        console.log('');
        console.log('⚠️  Warnings:');
        result.verification.warnings.forEach(warning => {
          console.log(`  • ${warning}`);
        });
      }

    } catch (error) {
      console.error(`✗ Test ERROR: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Test Complete');
  console.log('='.repeat(70));
}

// Run tests
console.log('\nStarting contact verification tests...\n');
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
