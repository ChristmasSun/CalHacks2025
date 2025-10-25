/**
 * Test script for LinkedIn verification via BrightData
 */

require('dotenv').config();

const { linkedInVerifier } = require('./src/infra/linkedin-verifier');
const { personVerifier } = require('./src/infra/person-verifier');

async function testLinkedInVerification() {
  console.log('🧪 Testing LinkedIn Verification via BrightData\n');

  // Test Case 1: Search by name only
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 1: Search for "James Smith" on LinkedIn');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const result1 = await linkedInVerifier.verifyPerson({
      name: 'James Smith',
      email: null,
      text: null
    });

    console.log('Result:', JSON.stringify(result1, null, 2));
    console.log('\n✅ Test 1 complete\n');
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }

  // Test Case 2: Verify with email cross-reference
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 2: Verify "John Doe" with email john@acme.com');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const result2 = await linkedInVerifier.verifyPerson({
      name: 'John Doe',
      email: 'john@acme.com',
      text: null
    });

    console.log('Result:', JSON.stringify(result2, null, 2));
    console.log('\n✅ Test 2 complete\n');
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }

  // Test Case 3: Full person verification with pasted text
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 3: Analyze contact text with personVerifier');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const contactText = `
Hi,

I'm James Smith, Senior Product Manager at Google.

Email: james.smith@google.com
LinkedIn: linkedin.com/in/jamessmith

Let me know if you'd like to discuss!

Best,
James
  `;

  try {
    const result3 = await personVerifier.analyzeText(contactText);

    console.log('Parsed Contact:', JSON.stringify(result3.contact, null, 2));
    console.log('\nVerification:', JSON.stringify(result3.verification, null, 2));
    console.log('\n✅ Test 3 complete\n');
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }

  // Test Case 4: Suspicious email with mismatched domain
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 4: Verify person with mismatched email domain');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const suspiciousText = `
Hi,

I'm Sarah Johnson, CEO of Microsoft.

Email: sarah.johnson@gmail.com

Looking forward to connecting!
  `;

  try {
    const result4 = await personVerifier.analyzeText(suspiciousText);

    console.log('Parsed Contact:', JSON.stringify(result4.contact, null, 2));
    console.log('\nVerification:', JSON.stringify(result4.verification, null, 2));
    console.log('\n✅ Test 4 complete\n');
  } catch (error) {
    console.error('❌ Test 4 failed:', error.message);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('All tests complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Run tests
testLinkedInVerification()
  .then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
