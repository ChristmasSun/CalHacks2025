/**
 * LinkedIn Verification via BrightData API
 *
 * Uses BrightData's LinkedIn dataset to:
 * 1. Discover LinkedIn profiles by name
 * 2. Verify email addresses match LinkedIn profiles
 * 3. Cross-reference sender information with public LinkedIn data
 */

const axios = require('axios');

const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY || 'e2e1f10cf9d189632321fade4603ee8060560d4a547c2087cd26522e12dcb449';
const BRIGHTDATA_DATASET_ID = process.env.BRIGHTDATA_LINKEDIN_DATASET_ID || 'gd_l1viktl72bvl7bjuj0';

class LinkedInVerifier {
  constructor() {
    this.cache = new Map(); // Cache LinkedIn lookups
  }

  /**
   * Search for LinkedIn profiles by name
   * @param {string} firstName - First name
   * @param {string} lastName - Last name
   * @returns {Promise<Array>} - Array of LinkedIn profile matches
   */
  async searchByName(firstName, lastName) {
    const cacheKey = `${firstName}:${lastName}`.toLowerCase();

    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`[LinkedIn] Using cached result for: ${firstName} ${lastName}`);
      return this.cache.get(cacheKey);
    }

    try {
      console.log(`[LinkedIn] Searching BrightData for: ${firstName} ${lastName}`);

      const response = await axios.post(
        `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${BRIGHTDATA_DATASET_ID}&include_errors=true&type=discover_new&discover_by=name`,
        [
          {
            first_name: firstName,
            last_name: lastName
          }
        ],
        {
          headers: {
            'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      // BrightData returns a snapshot_id that we need to poll for results
      const snapshotId = response.data?.snapshot_id;

      if (!snapshotId) {
        console.warn('[LinkedIn] No snapshot_id returned from BrightData');
        return [];
      }

      console.log(`[LinkedIn] Snapshot ID: ${snapshotId}, waiting for results...`);

      // Poll for results (BrightData processes async)
      const results = await this.pollForResults(snapshotId);

      // Cache results for 1 hour
      this.cache.set(cacheKey, results);
      setTimeout(() => this.cache.delete(cacheKey), 60 * 60 * 1000);

      return results;
    } catch (error) {
      console.error(`[LinkedIn] Search failed for ${firstName} ${lastName}:`, error.message);
      return [];
    }
  }

  /**
   * Poll BrightData for LinkedIn search results
   * @param {string} snapshotId - BrightData snapshot ID
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Array>} - LinkedIn profiles
   */
  async pollForResults(snapshotId, maxAttempts = 75, progressCallback = null) {
    // 75 attempts * 2s = 150s = 2.5 minutes
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls

        // Send progress update
        if (progressCallback) {
          const progress = Math.floor((i / maxAttempts) * 100);
          progressCallback({
            attempt: i + 1,
            maxAttempts,
            progress,
            message: `Searching LinkedIn... ${progress}%`
          });
        }

        const response = await axios.get(
          `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
          {
            headers: {
              'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`
            },
            timeout: 10000
          }
        );

        // Check if results are ready
        if (response.data && Array.isArray(response.data)) {
          console.log(`[LinkedIn] Found ${response.data.length} profile(s)`);
          return response.data;
        }

        console.log(`[LinkedIn] Poll attempt ${i + 1}/${maxAttempts}, still processing...`);
      } catch (error) {
        if (error.response?.status === 404) {
          // Results not ready yet, continue polling
          continue;
        }
        console.error(`[LinkedIn] Poll error:`, error.message);
        break;
      }
    }

    console.warn('[LinkedIn] Polling timed out, no results found');
    return [];
  }

  /**
   * Extract person's name from email signature or text
   * @param {string} text - Email body or signature
   * @returns {Object} - { firstName, lastName } or null
   */
  extractNameFromText(text) {
    // Try to find patterns like "John Doe", "Regards, John Doe", "Best, John Doe"
    const patterns = [
      /(?:from|regards|best|sincerely|thanks),?\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /([A-Z][a-z]+)\s+([A-Z][a-z]+)\s*<[^>]+@/i, // "John Doe <email@domain>"
      /^([A-Z][a-z]+)\s+([A-Z][a-z]+)$/m, // Standalone name on a line
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          firstName: match[1],
          lastName: match[2]
        };
      }
    }

    return null;
  }

  /**
   * Extract email domain from email address
   * @param {string} email - Email address
   * @returns {string} - Domain (e.g., "company.com")
   */
  extractDomain(email) {
    const match = email.match(/@([^>]+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Check if email matches LinkedIn profile
   * @param {Object} profile - LinkedIn profile from BrightData
   * @param {string} email - Email address to verify
   * @returns {boolean} - True if email seems to match the profile
   */
  doesEmailMatchProfile(profile, email) {
    if (!profile || !email) return false;

    const domain = this.extractDomain(email);
    if (!domain) return false;

    // Check if current company domain matches email domain
    if (profile.current_company?.name) {
      const companyName = profile.current_company.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const emailDomain = domain.split('.')[0]; // Get main domain part

      if (companyName.includes(emailDomain) || emailDomain.includes(companyName)) {
        console.log(`[LinkedIn] ✅ Email domain "${domain}" matches current company "${profile.current_company.name}"`);
        return true;
      }
    }

    // Check experience companies
    if (profile.experience && Array.isArray(profile.experience)) {
      for (const exp of profile.experience) {
        const companyName = exp.company?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        const emailDomain = domain.split('.')[0];

        if (companyName.includes(emailDomain) || emailDomain.includes(companyName)) {
          console.log(`[LinkedIn] ✅ Email domain "${domain}" matches past company "${exp.company}"`);
          return true;
        }
      }
    }

    // Check education institutions
    if (profile.education && Array.isArray(profile.education)) {
      for (const edu of profile.education) {
        const schoolName = edu.title?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        const emailDomain = domain.split('.')[0];

        if (schoolName.includes(emailDomain) || emailDomain.includes(schoolName)) {
          console.log(`[LinkedIn] ✅ Email domain "${domain}" matches education "${edu.title}"`);
          return true;
        }
      }
    }

    console.log(`[LinkedIn] ⚠️ Email domain "${domain}" does NOT match profile companies/education`);
    return false;
  }

  /**
   * Verify a person's identity using email and LinkedIn
   * @param {Object} params - { email, name, text }
   * @returns {Promise<Object>} - Verification result
   */
  async verifyPerson({ email, name, text }) {
    try {
      console.log('[LinkedIn] Starting person verification...');

      // Extract name from email or text
      let firstName, lastName;

      if (name) {
        const parts = name.split(' ');
        firstName = parts[0];
        lastName = parts[parts.length - 1];
      } else if (text) {
        const extracted = this.extractNameFromText(text);
        if (extracted) {
          firstName = extracted.firstName;
          lastName = extracted.lastName;
        }
      } else if (email) {
        // Try to extract name from email (e.g., john.doe@company.com)
        const emailName = email.split('@')[0];
        const parts = emailName.split(/[._]/);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts[parts.length - 1];
        }
      }

      if (!firstName || !lastName) {
        return {
          verified: false,
          confidence: 0,
          reason: 'Could not extract first and last name from input',
          profiles: []
        };
      }

      console.log(`[LinkedIn] Extracted name: ${firstName} ${lastName}`);

      // Search LinkedIn via BrightData
      const profiles = await this.searchByName(firstName, lastName);

      if (profiles.length === 0) {
        return {
          verified: false,
          confidence: 30,
          reason: `No LinkedIn profile found for "${firstName} ${lastName}"`,
          warning: 'Could not verify this person exists on LinkedIn',
          profiles: []
        };
      }

      // If we have an email, check if it matches any profile
      if (email) {
        const matchingProfiles = profiles.filter(profile =>
          this.doesEmailMatchProfile(profile, email)
        );

        if (matchingProfiles.length > 0) {
          const bestMatch = matchingProfiles[0];
          return {
            verified: true,
            confidence: 95,
            reason: `Verified: ${firstName} ${lastName} exists on LinkedIn`,
            profile: {
              name: bestMatch.name,
              position: bestMatch.position,
              company: bestMatch.current_company?.name,
              location: bestMatch.location,
              url: bestMatch.url,
              avatar: bestMatch.avatar
            },
            emailMatch: true,
            profiles: matchingProfiles.slice(0, 3)
          };
        } else {
          // Found LinkedIn profile but email doesn't match
          const bestMatch = profiles[0];
          return {
            verified: false,
            confidence: 50,
            reason: `Found LinkedIn profile for "${firstName} ${lastName}" but email domain doesn't match`,
            warning: `Email domain doesn't match ${bestMatch.current_company?.name || 'their current company'}`,
            profile: {
              name: bestMatch.name,
              position: bestMatch.position,
              company: bestMatch.current_company?.name,
              location: bestMatch.location
            },
            emailMatch: false,
            profiles: profiles.slice(0, 3)
          };
        }
      } else {
        // No email provided, just confirm LinkedIn profile exists
        const bestMatch = profiles[0];
        return {
          verified: true,
          confidence: 70,
          reason: `Found LinkedIn profile for "${firstName} ${lastName}"`,
          note: 'No email provided for cross-verification',
          profile: {
            name: bestMatch.name,
            position: bestMatch.position,
            company: bestMatch.current_company?.name,
            location: bestMatch.location,
            url: bestMatch.url
          },
          emailMatch: null,
          profiles: profiles.slice(0, 3)
        };
      }
    } catch (error) {
      console.error('[LinkedIn] Verification failed:', error);
      return {
        verified: false,
        confidence: 0,
        reason: 'LinkedIn verification failed',
        error: error.message,
        profiles: []
      };
    }
  }
}

// Export singleton instance
module.exports = {
  linkedInVerifier: new LinkedInVerifier()
};
