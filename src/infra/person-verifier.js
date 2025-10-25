/**
 * Person & Contact Verification using Bright Data
 *
 * Verifies if a person is real and if their contact information matches public records:
 * 1. Searches for person on LinkedIn, professional directories
 * 2. Extracts their publicly available contact info
 * 3. Compares against claimed email/contact info
 * 4. Flags mismatches and suspicious patterns
 */

const { brightDataClient } = require('./brightdata');
const axios = require('axios');

class PersonVerifier {
  constructor() {
    this.enabled = brightDataClient.enabled;
  }

  /**
   * Parse contact information from pasted text
   * Extracts name, email, company, title, etc.
   *
   * @param {string} text - Pasted text (e.g., LinkedIn message, email signature)
   * @returns {Object} Parsed contact information
   */
  parseContactText(text) {
    const contact = {
      name: null,
      email: null,
      company: null,
      title: null,
      phone: null,
      linkedin: null,
      rawText: text
    };

    // Extract email addresses
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const emails = text.match(emailRegex);
    if (emails && emails.length > 0) {
      contact.email = emails[0].toLowerCase();
    }

    // Extract phone numbers (various formats)
    const phoneRegex = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
    const phones = text.match(phoneRegex);
    if (phones && phones.length > 0) {
      contact.phone = phones[0];
    }

    // Extract LinkedIn profile URLs
    const linkedinRegex = /linkedin\.com\/in\/([a-zA-Z0-9-]+)/i;
    const linkedinMatch = text.match(linkedinRegex);
    if (linkedinMatch) {
      contact.linkedin = linkedinMatch[1];
    }

    // Extract name (look for common patterns)
    // Pattern: "Name: John Doe" or "From: Jane Smith" or just "John Doe" at start
    const namePatterns = [
      /(?:Name|From|Contact):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/,
      /^([A-Z][a-z]+\s+[A-Z][a-z]+)/m,
      /Hi,?\s+I'm\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        contact.name = match[1].trim();
        break;
      }
    }

    // Extract company name
    const companyPatterns = [
      /(?:Company|Organization):\s*([A-Z][a-zA-Z\s&]+)/,
      /at\s+([A-Z][a-zA-Z\s&]+)(?:\s|$)/,
      /from\s+([A-Z][a-zA-Z\s&]+)(?:\s|$)/i
    ];

    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match) {
        contact.company = match[1].trim();
        break;
      }
    }

    // Extract job title
    const titlePatterns = [
      /(?:Title|Role|Position):\s*([A-Z][a-zA-Z\s]+)/,
      /([A-Z][a-zA-Z\s]+)\s+at\s+/
    ];

    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        contact.title = match[1].trim();
        break;
      }
    }

    return contact;
  }

  /**
   * Verify if a person exists online and extract their real contact info
   *
   * @param {Object} claimedContact - Contact info from parsed text
   * @returns {Promise<Object>} Verification results
   */
  async verifyPerson(claimedContact) {
    const result = {
      verified: false,
      confidence: 0,
      matches: [],
      warnings: [],
      publicInfo: null,
      riskScore: 0,
      riskLevel: 'low'
    };

    console.log('[PersonVerifier] Verifying:', claimedContact.name, claimedContact.email);

    // If no name provided, can't verify
    if (!claimedContact.name) {
      result.warnings.push('No name provided - cannot verify identity');
      result.riskScore = 30;
      result.riskLevel = 'low';
      return result;
    }

    try {
      // 1. Search for person on LinkedIn (via Bright Data)
      if (this.enabled) {
        const linkedinData = await this.searchLinkedIn(claimedContact.name, claimedContact.company);
        if (linkedinData) {
          result.publicInfo = linkedinData;
          result.matches.push('Found on LinkedIn');
          result.confidence += 40;
        } else {
          result.warnings.push('⚠️ Person not found on LinkedIn or professional networks');
          result.riskScore += 35;
        }
      }

      // 2. Verify email domain matches company
      if (claimedContact.email && claimedContact.company) {
        const emailDomain = claimedContact.email.split('@')[1];
        const companyDomain = this.inferDomainFromCompany(claimedContact.company);

        if (companyDomain && emailDomain !== companyDomain) {
          // Check if it's a known mismatch (e.g., gmail.com for a company email)
          const isPersonalEmail = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(emailDomain);

          if (isPersonalEmail) {
            result.warnings.push(`⚠️ Uses personal email (${emailDomain}) instead of company domain`);
            result.riskScore += 25;
          } else {
            result.warnings.push(`⚠️ Email domain "${emailDomain}" doesn't match company "${claimedContact.company}" (expected: ${companyDomain})`);
            result.riskScore += 40;
          }
        } else if (companyDomain && emailDomain === companyDomain) {
          result.matches.push('Email domain matches company');
          result.confidence += 30;
        }
      }

      // 3. Compare claimed email against public profile email (if found)
      if (result.publicInfo && result.publicInfo.email && claimedContact.email) {
        const publicEmail = result.publicInfo.email.toLowerCase();
        const claimedEmail = claimedContact.email.toLowerCase();

        if (publicEmail === claimedEmail) {
          result.matches.push('✓ Email matches public profile');
          result.confidence += 30;
          result.verified = true;
        } else {
          result.warnings.push(`⚠️ Email mismatch: claimed "${claimedEmail}" but public profile shows "${publicEmail}"`);
          result.riskScore += 50;
        }
      }

      // 4. Check if email domain is suspicious
      if (claimedContact.email) {
        const emailDomain = claimedContact.email.split('@')[1];
        const suspiciousTLDs = ['.xyz', '.tk', '.ml', '.ga', '.cf', '.top', '.loan', '.click'];

        if (suspiciousTLDs.some(tld => emailDomain.endsWith(tld))) {
          result.warnings.push(`⚠️ Email uses suspicious TLD: ${emailDomain}`);
          result.riskScore += 30;
        }
      }

      // Calculate overall verification status
      if (result.confidence >= 60) {
        result.verified = true;
      }

      // Determine risk level
      result.riskLevel = result.riskScore >= 70 ? 'high' :
                         result.riskScore >= 40 ? 'medium' : 'low';

      console.log(`[PersonVerifier] Verification complete: confidence=${result.confidence}%, risk=${result.riskScore}`);

      return result;

    } catch (error) {
      console.error('[PersonVerifier] Verification failed:', error.message);
      result.warnings.push(`Verification error: ${error.message}`);
      return result;
    }
  }

  /**
   * Search for person on LinkedIn using Bright Data
   *
   * @param {string} name - Person's name
   * @param {string} company - Company name (optional)
   * @returns {Promise<Object|null>} LinkedIn profile data or null
   */
  async searchLinkedIn(name, company = null) {
    if (!this.enabled) {
      return null;
    }

    try {
      console.log(`[PersonVerifier] Searching LinkedIn for: ${name}${company ? ` at ${company}` : ''}`);

      // Use Bright Data to search LinkedIn
      // Note: This requires LinkedIn dataset access via Bright Data
      const searchQuery = company ? `${name} ${company}` : name;

      const response = await axios.post(
        'https://api.brightdata.com/datasets/v3/scrape',
        {
          url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(searchQuery)}`,
          format: 'json',
          fields: ['name', 'title', 'company', 'email', 'profile_url']
        },
        {
          headers: {
            'Authorization': `Bearer ${brightDataClient.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      // Parse first result
      if (response.data && response.data.length > 0) {
        const profile = response.data[0];
        return {
          name: profile.name || null,
          title: profile.title || null,
          company: profile.company || null,
          email: profile.email || null,
          profileUrl: profile.profile_url || null,
          source: 'linkedin'
        };
      }

      return null;

    } catch (error) {
      console.error('[PersonVerifier] LinkedIn search failed:', error.message);
      return null;
    }
  }

  /**
   * Infer company domain from company name
   * e.g., "Google Inc." -> "google.com"
   */
  inferDomainFromCompany(companyName) {
    if (!companyName) return null;

    // Remove common suffixes
    const cleaned = companyName
      .toLowerCase()
      .replace(/\s+(inc|llc|ltd|corporation|corp|limited|company|co)\.?$/i, '')
      .trim();

    // Common company -> domain mappings
    const knownMappings = {
      'google': 'google.com',
      'microsoft': 'microsoft.com',
      'amazon': 'amazon.com',
      'apple': 'apple.com',
      'meta': 'meta.com',
      'facebook': 'facebook.com',
      'netflix': 'netflix.com',
      'tesla': 'tesla.com',
      'uber': 'uber.com',
      'airbnb': 'airbnb.com'
    };

    // Check known mappings first
    for (const [key, domain] of Object.entries(knownMappings)) {
      if (cleaned.includes(key)) {
        return domain;
      }
    }

    // Otherwise, infer: "Acme Corporation" -> "acme.com"
    const simpleName = cleaned.split(/\s+/)[0]; // Take first word
    return `${simpleName}.com`;
  }

  /**
   * Analyze pasted text and verify contact
   * Main entry point for the feature
   *
   * @param {string} text - Pasted text
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeText(text) {
    console.log('[PersonVerifier] Analyzing text...');

    // Parse contact information
    const contact = this.parseContactText(text);

    // Verify the person
    const verification = await this.verifyPerson(contact);

    return {
      contact,
      verification,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Quick check if text contains contact information
   */
  hasContactInfo(text) {
    const hasEmail = /@/.test(text);
    const hasName = /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text);
    const hasPhone = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);

    return hasEmail || (hasName && hasPhone);
  }
}

// Export singleton instance
const personVerifier = new PersonVerifier();

module.exports = { personVerifier, PersonVerifier };
