# Email Authenticity Verification

## Overview

ScamShield automatically verifies email authenticity when scanning Gmail messages. This feature detects phishing attempts by analyzing sender information, domain legitimacy, and email content patterns.

## Performance & Caching

ScamShield intelligently caches email verification results:
- **24-hour cache** - Same sender won't be re-verified for 24 hours
- **Instant lookups** - Cached results return in <1ms
- **1000 email capacity** - Stores up to 1000 verified senders
- **Automatic cleanup** - Old entries expire automatically

**Example:**
```
1st verification: 2ms (full analysis)
2nd verification: 0ms (cached - instant!)
3rd verification: 0ms (cached - instant!)
```

Test caching: `node test-email-cache.js`

## How It Works

When you connect Gmail to ScamShield, every incoming email is automatically analyzed for:

1. **Brand Impersonation** - Detects when sender claims to be from a company but uses a different domain
2. **Typosquatting** - Identifies domains that mimic legitimate brands with character substitutions
3. **Domain Similarity** - Flags domains suspiciously similar to known legitimate domains
4. **Urgency Language** - Detects pressure tactics common in phishing emails
5. **Financial Requests** - Warns about payment, wire transfer, or gift card requests
6. **Personal Info Requests** - Flags requests for passwords, SSN, credit cards

## Test Results

Our test suite achieved **90% accuracy** detecting phishing emails across various scenarios:

### ✓ Successfully Detected (9/10)
- PayPal typosquatting (paypal-verify.com)
- Character substitution (paypa1.com)
- Brand impersonation (claims PayPal but wrong domain)
- Amazon phishing variants
- IRS scam emails
- Banking phishing attempts
- Legitimate emails (correctly marked as safe)

### Example Detections

#### PayPal Phishing
```
From: PayPal Security <security@paypal-verify.com>
Subject: Urgent: Verify your PayPal account now

⚠️ DETECTED:
- Brand impersonation (claims PayPal, uses paypal-verify.com)
- Typosquatting (paypal-verify.com mimics paypal.com)
- Risk Score: 70/100 (MEDIUM)
```

#### Character Substitution
```
From: PayPal Support <support@paypa1.com>
Subject: Confirm your payment method

⚠️ DETECTED:
- Character substitution (paypa1.com uses "1" instead of "l")
- 90% similarity to legitimate paypal.com
- Requests sensitive information
- Risk Score: 145/100 (HIGH)
```

## Verified Legitimate Domains

The verifier includes a database of legitimate company domains:

### Financial Services
- PayPal (paypal.com, paypal.me)
- Chase Bank (chase.com)
- Bank of America (bankofamerica.com, bofa.com)
- Wells Fargo (wellsfargo.com)
- Citibank (citibank.com, citi.com)

### Technology Companies
- Apple (apple.com, icloud.com, me.com)
- Microsoft (microsoft.com, outlook.com, live.com, hotmail.com)
- Google (google.com, gmail.com, youtube.com)
- Amazon (amazon.com)
- Meta (meta.com, facebook.com, instagram.com)

### Services & Retail
- UPS, FedEx, USPS
- IRS (irs.gov)
- Walmart, Target, Costco

## Risk Scoring

Emails are scored 0-100 based on detected indicators:

| Risk Level | Score | Actions |
|------------|-------|---------|
| **High** | 75-100 | ⚠️ Flagged as dangerous, shown in dashboard |
| **Medium** | 45-74 | ⚠️ Flagged as suspicious, shown in dashboard |
| **Low** | 0-44 | Monitored, not flagged unless other indicators |

### Scoring Breakdown

| Indicator | Points | Example |
|-----------|--------|---------|
| Brand impersonation | +30 | Claims "PayPal" but wrong domain |
| Typosquatting | +40 | paypa1.com, g00gle.com |
| Domain similarity (70%+) | +35 | paypal-secure.com vs paypal.com |
| Domain age < 30 days | +35 | Newly registered domain (requires Bright Data) |
| Domain age 30-90 days | +20 | Young domain (requires Bright Data) |
| Urgency language | +10-20 | "Act now", "verify immediately" |
| Financial request | +25 | Wire transfer, gift card, bitcoin |
| Personal info request | +30 | SSN, password, credit card |

## Integration with Gmail

Email verification runs automatically when:
1. Gmail is connected via OAuth
2. ScamShield refreshes your inbox
3. The "Refresh Gmail" button is clicked in dashboard

### Example Gmail Dashboard Output

```
Suspicious Messages (3):

1. "Urgent: Verify your PayPal account"
   From: security@paypal-verify.com
   Reasons:
   - ⚠️ Brand impersonation (PAYPAL)
   - ⚠️ Typosquatting detected
   - Urgency language detected

2. "Your Amazon account will be suspended"
   From: security@amazon-account.net
   Reasons:
   - ⚠️ Brand impersonation (AMAZON)
   - Domain similarity: 85% match
   - Urgency language detected

3. "IRS Tax Refund Pending - Final Notice"
   From: collections@irs-taxrefund.com
   Reasons:
   - ⚠️ Brand impersonation (IRS)
   - ⚠️ Requests payment (wire transfer)
   - Urgency language detected
```

## Optional: Bright Data Enhancement

When Bright Data is enabled, email verification gains additional capabilities:

- **Domain Age Verification** - WHOIS lookups to check how old the domain is
- **Registrar Information** - Identify suspicious registrars
- **Historical Data** - Cross-reference against known scam domains

To enable:
```bash
# Add to .env
BRIGHTDATA_API_TOKEN=your_token_here
```

## Testing

Run the test suite to see email verification in action:

```bash
node test-email-verifier.js
```

This tests 10 scenarios including:
- Legitimate emails from PayPal, Amazon, Google
- Various phishing attempts
- Typosquatting variants
- Brand impersonation
- IRS and banking scams

## Known Limitations

1. **Generic Phishing** - Emails from unknown domains without brand claims may not be flagged (e.g., "admin@secure-login.xyz")
2. **Subdomain Spoofing** - Legitimate subdomains are allowed (e.g., noreply.paypal.com)
3. **New Brands** - Only major brands are in the verified database
4. **Language** - Currently optimized for English phishing patterns

## Expanding the Database

To add more legitimate domains to the verifier:

Edit `src/infra/email-verifier.js`:

```javascript
const LEGITIMATE_DOMAINS = {
  'yourcompany.com': {
    name: 'Your Company',
    aliases: ['yourcompany.io', 'yourcompany.net']
  },
  // ... add more
};
```

## Architecture

```
Gmail Message
    ↓
extractHeader() - Parse sender, subject, body
    ↓
emailVerifier.verifyEmail() - Analyze authenticity
    ↓
    ├─ parseEmailAddress() - Extract name, email, domain
    ├─ checkBrandImpersonation() - Match name vs domain
    ├─ checkTyposquatting() - Detect character tricks
    ├─ checkKnownDomain() - Compare to legitimate list
    ├─ checkDomainAge() - WHOIS lookup (Bright Data)
    └─ checkEmailContent() - Analyze subject + body
    ↓
Risk Score + Warnings
    ↓
Gmail Dashboard (if suspicious)
```

## API Usage

You can use the email verifier programmatically:

```javascript
const { emailVerifier } = require('./src/infra/email-verifier');

const result = await emailVerifier.verifyEmail({
  from: 'PayPal Security <security@paypal-verify.com>',
  subject: 'Urgent: Verify your account',
  body: 'Your account has been suspended...'
});

console.log(result);
// {
//   legitimate: false,
//   riskScore: 70,
//   riskLevel: 'medium',
//   warnings: [
//     '⚠️ Brand impersonation detected',
//     '⚠️ Typosquatting: paypal-verify.com'
//   ],
//   details: {
//     senderName: 'PayPal Security',
//     senderEmail: 'security@paypal-verify.com',
//     senderDomain: 'paypal-verify.com'
//   }
// }
```

## Privacy & Security

- **Local Processing** - All email analysis happens on your device
- **No Email Storage** - Emails are analyzed in memory, not stored
- **OAuth Only** - Uses Google's secure OAuth flow
- **Token Storage** - Gmail tokens stored locally in encrypted format
- **No Third-Party Sharing** - Email content never sent to external services

## Support

For issues or questions:
1. Check the test suite: `node test-email-verifier.js`
2. Review logs in terminal during Gmail refresh
3. Verify Gmail connection is active
4. Check that `evaluateMessageRisk()` is being called

## Future Enhancements

Potential improvements:
- Machine learning model for advanced pattern recognition
- Community-sourced phishing domain database
- Real-time threat intelligence feeds
- Multi-language support
- Image-based phishing detection (analyzing email attachments)
- Link verification (checking URLs in email body)
