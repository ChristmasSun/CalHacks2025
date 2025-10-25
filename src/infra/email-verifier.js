/**
 * Email Authenticity Verifier using Bright Data
 *
 * Validates if email senders are legitimate by:
 * 1. Checking if sender domain matches claimed company
 * 2. Detecting brand impersonation and typosquatting
 * 3. Validating domain age and registrar via WHOIS
 * 4. Comparing against known legitimate company domains
 */

const { brightDataClient } = require('./brightdata');
const { LRUCache } = require('lru-cache');

// Cache verified emails to avoid duplicate checks
const emailVerificationCache = new LRUCache({
  max: 1000, // Cache up to 1000 verified emails
  ttl: 1000 * 60 * 60 * 24 // 24 hour TTL (emails don't change often)
});

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function calculateStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Known legitimate company domains (major brands)
const LEGITIMATE_DOMAINS = {
  // Financial
  'paypal.com': { name: 'PayPal', aliases: ['paypal.me'] },
  'chase.com': { name: 'Chase Bank', aliases: [] },
  'bankofamerica.com': { name: 'Bank of America', aliases: ['bofa.com'] },
  'wellsfargo.com': { name: 'Wells Fargo', aliases: [] },
  'citibank.com': { name: 'Citibank', aliases: ['citi.com'] },

  // Tech companies
  'apple.com': { name: 'Apple', aliases: ['icloud.com', 'me.com'] },
  'microsoft.com': { name: 'Microsoft', aliases: ['outlook.com', 'live.com', 'hotmail.com'] },
  'google.com': { name: 'Google', aliases: ['gmail.com', 'youtube.com'] },
  'amazon.com': { name: 'Amazon', aliases: ['amazon.aws'] },
  'meta.com': { name: 'Meta', aliases: ['facebook.com', 'instagram.com'] },

  // Services
  'ups.com': { name: 'UPS', aliases: [] },
  'fedex.com': { name: 'FedEx', aliases: [] },
  'usps.com': { name: 'USPS', aliases: ['usps.gov'] },
  'irs.gov': { name: 'IRS', aliases: [] },

  // Retail
  'walmart.com': { name: 'Walmart', aliases: [] },
  'target.com': { name: 'Target', aliases: [] },
  'costco.com': { name: 'Costco', aliases: [] },
};

// Common typosquatting patterns
const TYPOSQUAT_PATTERNS = [
  { find: /paypa1/i, real: 'paypal' },
  { find: /g00gle/i, real: 'google' },
  { find: /amaz0n/i, real: 'amazon' },
  { find: /app1e/i, real: 'apple' },
  { find: /micros0ft/i, real: 'microsoft' },
];

class EmailVerifier {
  constructor() {
    this.enabled = brightDataClient.enabled;
  }

  /**
   * Main verification function for email authenticity
   *
   * @param {Object} emailData
   * @param {string} emailData.from - Full from header (e.g., "PayPal Security <scam@paypal-verify.com>")
   * @param {string} emailData.subject - Email subject line
   * @param {string} emailData.body - Email body content
   * @returns {Promise<Object>} Verification results with risk score
   */
  async verifyEmail({ from, subject, body }) {
    // Parse sender name and email first
    const parsed = this.parseEmailAddress(from);
    const cacheKey = `${parsed.email}:${parsed.name}`;

    // Check cache first
    const cached = emailVerificationCache.get(cacheKey);
    if (cached) {
      console.log(`[EmailVerifier] Using cached result for: ${from}`);
      return cached;
    }

    const result = {
      legitimate: true,
      riskScore: 0,
      warnings: [],
      details: {}
    };

    result.details.senderName = parsed.name;
    result.details.senderEmail = parsed.email;
    result.details.senderDomain = parsed.domain;

    console.log(`[EmailVerifier] Verifying: ${from}`);

    // 1. Check for brand impersonation in sender name
    const brandCheck = this.checkBrandImpersonation(parsed.name, parsed.domain);
    if (brandCheck.suspicious) {
      result.riskScore += 30;
      result.warnings.push(brandCheck.warning);
      result.legitimate = false;
    }

    // 2. Check for typosquatting in domain
    const typosquatCheck = this.checkTyposquatting(parsed.domain);
    if (typosquatCheck.suspicious) {
      result.riskScore += 40;
      result.warnings.push(typosquatCheck.warning);
      result.legitimate = false;
    }

    // 3. Check against known legitimate domains
    const knownDomainCheck = this.checkKnownDomain(parsed.domain, parsed.name);
    if (knownDomainCheck.suspicious) {
      result.riskScore += knownDomainCheck.riskScore;
      result.warnings.push(knownDomainCheck.warning);
      result.legitimate = false;
    }

    // 4. Domain age check - DISABLED (Bright Data WHOIS API not working correctly)
    // The current Bright Data implementation returns 404 for WHOIS lookups
    // TODO: Implement proper WHOIS lookup or use alternative service
    // Commenting out to avoid error spam:
    /*
    if (this.enabled && parsed.domain) {
      try {
        const whoisData = await brightDataClient.getWhoisData(parsed.domain);
        if (whoisData.success) {
          const domainAgeCheck = this.checkDomainAge(whoisData.whois);
          if (domainAgeCheck.suspicious) {
            result.riskScore += domainAgeCheck.riskScore;
            result.warnings.push(domainAgeCheck.warning);
            result.legitimate = false;
          }
          result.details.whois = whoisData.whois;
        }
      } catch (error) {
        console.warn('[EmailVerifier] WHOIS lookup failed:', error.message);
      }
    }
    */

    // 5. Check subject line and body for urgency/phishing patterns
    const contentCheck = this.checkEmailContent(subject, body);
    if (contentCheck.suspicious) {
      result.riskScore += contentCheck.riskScore;
      result.warnings.push(...contentCheck.warnings);
    }

    // Final risk assessment
    result.riskLevel = this.calculateRiskLevel(result.riskScore);

    console.log(`[EmailVerifier] Risk score: ${result.riskScore}/100 (${result.riskLevel})`);

    // Cache the result for 24 hours
    emailVerificationCache.set(cacheKey, result);

    return result;
  }

  /**
   * Parse email address from full "Name <email@domain.com>" format
   */
  parseEmailAddress(fullAddress) {
    const match = fullAddress.match(/^(.+?)\s*<([^>]+)>$/);

    if (match) {
      const name = match[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      const email = match[2].trim().toLowerCase();
      const domain = email.split('@')[1] || '';

      return { name, email, domain };
    }

    // Fallback: just an email address without name
    const email = fullAddress.trim().toLowerCase();
    const domain = email.split('@')[1] || '';

    return { name: '', email, domain };
  }

  /**
   * Check if sender name claims to be from a company but domain doesn't match
   */
  checkBrandImpersonation(senderName, senderDomain) {
    const nameLower = senderName.toLowerCase();

    // Check if sender name mentions a brand
    for (const [domain, info] of Object.entries(LEGITIMATE_DOMAINS)) {
      const brandName = info.name.toLowerCase();

      // Sender claims to be from this brand
      if (nameLower.includes(brandName)) {
        // Check if domain matches
        const allValidDomains = [domain, ...info.aliases];
        const domainMatches = allValidDomains.some(validDomain =>
          senderDomain === validDomain || senderDomain.endsWith('.' + validDomain)
        );

        if (!domainMatches) {
          return {
            suspicious: true,
            warning: `⚠️ Sender claims to be from "${info.name}" but email is from "${senderDomain}" (IMPERSONATION)`,
            brand: info.name,
            claimedDomain: domain,
            actualDomain: senderDomain
          };
        }
      }
    }

    return { suspicious: false };
  }

  /**
   * Detect typosquatting in domain names
   */
  checkTyposquatting(domain) {
    // Check for common character substitutions
    for (const pattern of TYPOSQUAT_PATTERNS) {
      if (pattern.find.test(domain)) {
        return {
          suspicious: true,
          warning: `⚠️ Domain contains suspicious spelling similar to "${pattern.real}" (TYPOSQUATTING)`,
          suspected: pattern.real
        };
      }
    }

    // Check for suspicious extra words in known domains
    for (const [legitimateDomain, info] of Object.entries(LEGITIMATE_DOMAINS)) {
      const baseName = legitimateDomain.split('.')[0]; // e.g., "paypal" from "paypal.com"

      // Check if domain contains the brand name but isn't the legitimate domain
      if (domain.includes(baseName) && domain !== legitimateDomain) {
        // Allow subdomains of legitimate domains
        if (!domain.endsWith('.' + legitimateDomain)) {
          // Suspicious patterns like "paypal-verify.com", "secure-paypal.com"
          if (domain.includes('-') || domain.includes('verify') || domain.includes('secure')) {
            return {
              suspicious: true,
              warning: `⚠️ Domain "${domain}" looks similar to legitimate "${legitimateDomain}" but with extra words (SUSPICIOUS)`,
              legitimate: legitimateDomain
            };
          }
        }
      }
    }

    return { suspicious: false };
  }

  /**
   * Check if sender claims to be from a known brand but uses wrong domain
   */
  checkKnownDomain(senderDomain, senderName) {
    // If domain is known legitimate, all good
    if (LEGITIMATE_DOMAINS[senderDomain]) {
      return { suspicious: false };
    }

    // Check if any legitimate domain is a substring (subdomain check)
    for (const [domain, info] of Object.entries(LEGITIMATE_DOMAINS)) {
      if (senderDomain.endsWith('.' + domain) || info.aliases.some(alias => senderDomain.endsWith('.' + alias))) {
        return { suspicious: false };
      }
    }

    // Check for high similarity to known domains (fuzzy matching)
    for (const [legitimateDomain, info] of Object.entries(LEGITIMATE_DOMAINS)) {
      const similarity = calculateStringSimilarity(senderDomain, legitimateDomain);

      // If domain is 70%+ similar to a known domain, flag it
      if (similarity > 0.7 && similarity < 1.0) {
        return {
          suspicious: true,
          warning: `⚠️ Domain "${senderDomain}" is suspiciously similar to legitimate "${legitimateDomain}" (${Math.round(similarity * 100)}% match)`,
          riskScore: 35,
          legitimate: legitimateDomain,
          similarity: similarity
        };
      }
    }

    return { suspicious: false };
  }

  /**
   * Check domain age from WHOIS data
   */
  checkDomainAge(whoisData) {
    if (!whoisData || !whoisData.creation_date) {
      return { suspicious: false };
    }

    const creationDate = new Date(whoisData.creation_date);
    const now = new Date();
    const ageInDays = Math.floor((now - creationDate) / (1000 * 60 * 60 * 24));

    // Very young domains are suspicious for phishing
    if (ageInDays < 30) {
      return {
        suspicious: true,
        warning: `⚠️ Domain is only ${ageInDays} days old (VERY NEW - suspicious for phishing)`,
        riskScore: 35,
        ageInDays
      };
    }

    if (ageInDays < 90) {
      return {
        suspicious: true,
        warning: `Domain is ${ageInDays} days old (relatively new)`,
        riskScore: 20,
        ageInDays
      };
    }

    return { suspicious: false };
  }

  /**
   * Check email content for phishing patterns
   */
  checkEmailContent(subject, body) {
    const warnings = [];
    let riskScore = 0;
    let suspicious = false;

    const contentLower = (subject + ' ' + body).toLowerCase();

    // Urgency phrases
    const urgencyPhrases = [
      'urgent action required',
      'act now',
      'immediate attention',
      'verify your account',
      'suspended account',
      'confirm your identity',
      'unusual activity',
      'security alert',
      'expire',
      'limited time'
    ];

    const foundUrgency = urgencyPhrases.filter(phrase => contentLower.includes(phrase));
    if (foundUrgency.length > 0) {
      suspicious = true;
      riskScore += Math.min(20, foundUrgency.length * 10);
      warnings.push(`Contains urgency language: "${foundUrgency.join('", "')}"`);
    }

    // Payment/financial requests
    const financialPhrases = [
      'wire transfer',
      'send payment',
      'bitcoin',
      'gift card',
      'update payment',
      'confirm payment'
    ];

    const foundFinancial = financialPhrases.filter(phrase => contentLower.includes(phrase));
    if (foundFinancial.length > 0) {
      suspicious = true;
      riskScore += 25;
      warnings.push(`⚠️ Requests payment/financial action: "${foundFinancial.join('", "')}"`);
    }

    // Personal info requests
    if (contentLower.includes('social security') ||
        contentLower.includes('ssn') ||
        contentLower.includes('password') ||
        contentLower.includes('credit card')) {
      suspicious = true;
      riskScore += 30;
      warnings.push('⚠️ Requests sensitive personal information (HIGHLY SUSPICIOUS)');
    }

    return { suspicious, riskScore, warnings };
  }

  /**
   * Calculate overall risk level
   */
  calculateRiskLevel(score) {
    if (score >= 75) return 'high';
    if (score >= 45) return 'medium';
    return 'low';
  }

  /**
   * Batch verify multiple emails
   */
  async verifyBatch(emails) {
    const results = [];

    for (const email of emails) {
      try {
        const result = await this.verifyEmail(email);
        results.push({ ...email, verification: result });
      } catch (error) {
        console.error('[EmailVerifier] Failed to verify email:', error);
        results.push({
          ...email,
          verification: {
            error: error.message,
            riskScore: 0,
            legitimate: true
          }
        });
      }
    }

    return results;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: emailVerificationCache.size,
      max: emailVerificationCache.max,
      ttl: emailVerificationCache.ttl,
      itemCount: emailVerificationCache.size
    };
  }

  /**
   * Clear the email verification cache
   */
  clearCache() {
    emailVerificationCache.clear();
    console.log('[EmailVerifier] Cache cleared');
  }
}

// Export singleton instance
const emailVerifier = new EmailVerifier();

module.exports = { emailVerifier, EmailVerifier };
