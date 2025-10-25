# LinkedIn Verification Integration

## Overview

Enhanced the contact verification system to use **BrightData's LinkedIn API** for discovering and verifying people by name, then cross-referencing their email addresses with their LinkedIn profiles.

## Features

### 1. LinkedIn Profile Discovery
- **Search by Name**: Finds LinkedIn profiles using first and last name via BrightData's `discover_by=name` API
- **Automatic Extraction**: Extracts names from pasted text (emails, LinkedIn messages, signatures)
- **Profile Data**: Returns full LinkedIn profile including:
  - Name, position, company
  - Location
  - Experience history
  - Education
  - Profile URL

### 2. Email-to-LinkedIn Cross-Verification
- **Domain Matching**: Checks if email domain matches the person's current company on LinkedIn
- **Experience Verification**: Validates email domain against past companies
- **Education Verification**: Checks email domain against universities (for .edu addresses)
- **Confidence Scoring**: Calculates confidence based on match quality

### 3. Automatic Email Author Verification
When verifying emails, the system:
1. Extracts sender name from email (e.g., "John Doe <john@company.com>")
2. Searches LinkedIn for "John Doe"
3. Finds their LinkedIn profile and current company
4. Verifies that `john@company.com` matches their LinkedIn company
5. Flags mismatches (e.g., email claims Google but LinkedIn shows Microsoft)

## Implementation

### New Modules

#### `src/infra/linkedin-verifier.js`
```javascript
const { linkedInVerifier } = require('./src/infra/linkedin-verifier');

// Search by name
const profiles = await linkedInVerifier.searchByName('John', 'Doe');

// Verify person with email cross-check
const result = await linkedInVerifier.verifyPerson({
  email: 'john@acme.com',
  name: 'John Doe',
  text: 'Pasted LinkedIn message or email signature...'
});
```

**Key Methods:**
- `searchByName(firstName, lastName)` - Discovers LinkedIn profiles
- `pollForResults(snapshotId)` - Waits for BrightData async results
- `doesEmailMatchProfile(profile, email)` - Cross-validates email domain
- `verifyPerson({ email, name, text })` - Main verification entry point

### Updated Modules

#### `src/infra/person-verifier.js`
Now uses LinkedIn verification:
```javascript
const result = await personVerifier.analyzeText(contactText);

// Returns:
{
  contact: { name, email, company, title, phone, linkedin },
  verification: {
    verified: true/false,
    confidence: 95,
    linkedInProfile: { name, position, company, location, url },
    matches: ['Found on LinkedIn', 'Email domain matches company'],
    warnings: ['Email domain mismatch...']
  }
}
```

#### `src/infra/email-verifier.js`
- Now imports `linkedInVerifier` for sender validation
- Can cross-check email senders against their LinkedIn profiles

### UI Integration

#### Control Panel (`control.html` + `control.js`)
**Contact Verification Section:**
- Textarea to paste LinkedIn messages, emails, or contact info
- "Verify Contact" button triggers verification
- Results display shows:
  - ✅ Verification status with confidence %
  - 📋 Extracted contact information
  - 💼 LinkedIn profile card with:
    - Name, position, company
    - Location
    - Link to LinkedIn profile
  - ⚠️ Warnings for mismatches

## API Details

### BrightData LinkedIn API

**Endpoint:**
```
POST https://api.brightdata.com/datasets/v3/trigger
```

**Parameters:**
- `dataset_id`: `gd_l1viktl72bvl7bjuj0` (LinkedIn dataset)
- `type`: `discover_new`
- `discover_by`: `name`

**Request Body:**
```json
[
  {
    "first_name": "James",
    "last_name": "Smith"
  }
]
```

**Response:**
```json
{
  "snapshot_id": "sd_xxxxx"
}
```

**Polling Results:**
```
GET https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}?format=json
```

**Result Data:**
```json
[
  {
    "id": "...",
    "name": "James Smith",
    "position": "Senior Product Manager",
    "current_company": {
      "name": "Google",
      "company_id": "google"
    },
    "location": "San Francisco, CA",
    "url": "https://linkedin.com/in/jamessmith",
    "experience": [...],
    "education": [...]
  }
]
```

## Usage Examples

### Example 1: Verify Contact from Pasted Text
```javascript
// In control panel, user pastes:
const text = `
Hi, I'm John Doe
Senior Engineer at Google
john.doe@google.com
linkedin.com/in/johndoe
`;

// Click "Verify Contact"
// System:
// 1. Extracts: name="John Doe", email="john.doe@google.com"
// 2. Searches LinkedIn for "John Doe"
// 3. Finds profile showing current company = Google
// 4. Verifies email domain "google.com" matches LinkedIn company
// 5. Returns: ✅ Verified (95% confidence)
```

### Example 2: Detect Email Spoofing
```javascript
// User pastes:
const text = `
From: Sarah Johnson <sarah@gmail.com>
CEO of Microsoft

Let's discuss this urgent matter...
`;

// System:
// 1. Extracts: name="Sarah Johnson", email="sarah@gmail.com"
// 2. Searches LinkedIn for "Sarah Johnson"
// 3. Finds profile showing company = Microsoft
// 4. Detects mismatch: email is @gmail.com but should be @microsoft.com
// 5. Returns: ⚠️ Suspicious (50% confidence)
//    Warning: "Email domain doesn't match Microsoft"
```

### Example 3: Gmail Auto-Verification
When user connects Gmail, the system:
```javascript
// For each suspicious email:
const sender = "John Smith <john@scamcompany.xyz>";
const name = extractName(sender); // "John Smith"
const email = extractEmail(sender); // "john@scamcompany.xyz"

// Verify on LinkedIn
const result = await linkedInVerifier.verifyPerson({ name, email });

if (!result.verified || result.emailMatch === false) {
  // Flag email as suspicious
  gmailSuspiciousMessages.push({
    subject: "...",
    from: sender,
    reasons: ["LinkedIn profile doesn't match email domain"]
  });
}
```

## Configuration

### Environment Variables
```bash
# .env file
BRIGHTDATA_API_KEY=your_api_key_here
BRIGHTDATA_LINKEDIN_DATASET_ID=gd_l1viktl72bvl7bjuj0
```

### Caching
- LinkedIn searches are cached for 1 hour to avoid redundant API calls
- Cache uses LRU eviction with max 500 entries

### Rate Limiting
- BrightData API processes requests asynchronously
- Polling with 2-second intervals
- Max 10 polling attempts (20 seconds total wait time)
- Falls back gracefully if API times out

## Testing

Run the test script:
```bash
node test-linkedin-verification.js
```

Tests include:
1. Name-only search (e.g., "James Smith")
2. Name + email verification (e.g., "John Doe" + "john@acme.com")
3. Full text analysis (LinkedIn message parsing)
4. Mismatch detection (personal email vs. company)

## Benefits

### For Users
- ✅ **Verify Legitimacy**: Check if the person is real and their email matches their LinkedIn
- ✅ **Detect Impersonation**: Catch scammers claiming to be from companies
- ✅ **Auto-Scan Emails**: Automatically verify suspicious Gmail senders
- ✅ **One-Click Verification**: Paste text and get instant verification

### For Detection
- 🎯 **Improved Accuracy**: LinkedIn profiles provide ground truth about someone's identity
- 🎯 **Email Validation**: Cross-reference email domains with real employment data
- 🎯 **Brand Protection**: Detect people falsely claiming to work for companies
- 🎯 **Confidence Scoring**: Quantify verification certainty (0-100%)

## Future Enhancements

1. **Profile Photos**: Compare sender photo with LinkedIn avatar
2. **Connection Network**: Verify if sender has mutual connections
3. **Recent Activity**: Check if LinkedIn profile is active/abandoned
4. **Company Verification**: Cross-check company websites with LinkedIn data
5. **Bulk Verification**: Process multiple contacts at once
6. **Email Domain Registry**: Build database of verified company domains

## Limitations

- BrightData API is asynchronous (may take 20+ seconds)
- Common names (e.g., "John Smith") return many results
- API rate limits apply (check BrightData quota)
- LinkedIn profiles must be public to be discovered
- Email domain matching is heuristic (not 100% accurate)

## API Costs

- BrightData charges per API call
- Caching reduces redundant calls
- Consider implementing usage quotas for production

---

**Status**: ✅ Fully Implemented and Tested
**Integration**: Control Panel UI, Gmail Verification, Email Verification
**API**: BrightData LinkedIn Dataset (`discover_by=name`)
