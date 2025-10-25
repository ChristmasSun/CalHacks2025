/**
 * Demo Mode - Provides instant mock results for demonstrations
 *
 * Enable with: DEMO_MODE=true in .env
 *
 * Features:
 * - Instant LinkedIn verification (no 2-3 min wait)
 * - Pre-generated URLScan results
 * - Realistic mock data
 * - Perfect for live demos and presentations
 */

const DEMO_MODE = process.env.DEMO_MODE === 'true';

// Mock LinkedIn profiles
const MOCK_LINKEDIN_PROFILES = {
  'john smith': {
    verified: true,
    confidence: 95,
    reason: 'Verified: John Smith exists on LinkedIn',
    profile: {
      name: 'John Smith',
      position: 'Senior Software Engineer',
      company: 'Google',
      location: 'San Francisco, CA',
      url: 'https://linkedin.com/in/johnsmith'
    },
    emailMatch: true
  },
  'sarah johnson': {
    verified: true,
    confidence: 92,
    reason: 'Verified: Sarah Johnson exists on LinkedIn',
    profile: {
      name: 'Sarah Johnson',
      position: 'Product Manager',
      company: 'Microsoft',
      location: 'Seattle, WA',
      url: 'https://linkedin.com/in/sarahjohnson'
    },
    emailMatch: true
  },
  'mike chen': {
    verified: false,
    confidence: 40,
    reason: 'Found LinkedIn profile for "Mike Chen" but email domain doesn\'t match',
    warning: 'Email domain doesn\'t match TechCorp',
    profile: {
      name: 'Mike Chen',
      position: 'Software Developer',
      company: 'Amazon',
      location: 'New York, NY'
    },
    emailMatch: false
  },
  'jane doe': {
    verified: false,
    confidence: 30,
    reason: 'No LinkedIn profile found for "Jane Doe"',
    warning: 'Could not verify this person exists on LinkedIn',
    profiles: []
  }
};

// Mock URLScan results
const MOCK_URLSCAN_RESULTS = {
  'google.com': {
    verdict: { malicious: false, suspicious: false },
    security: { https: true, certificate: 'valid' },
    domainAge: 9125, // 25 years
    redirects: 0,
    phishing: false
  },
  'paypal.com': {
    verdict: { malicious: false, suspicious: false },
    security: { https: true, certificate: 'valid' },
    domainAge: 8395, // 23 years
    redirects: 0,
    phishing: false
  },
  'amazon.com': {
    verdict: { malicious: false, suspicious: false },
    security: { https: true, certificate: 'valid' },
    domainAge: 10220, // 28 years
    redirects: 0,
    phishing: false
  },
  'suspicious-site.com': {
    verdict: { malicious: true, suspicious: true },
    security: { https: false, certificate: 'invalid' },
    domainAge: 12, // 12 days
    redirects: 3,
    phishing: true
  },
  'phishing-paypal.com': {
    verdict: { malicious: true, suspicious: true },
    security: { https: false, certificate: 'none' },
    domainAge: 5, // 5 days
    redirects: 0,
    phishing: true
  }
};

// Mock email verification results
const MOCK_EMAIL_RESULTS = {
  'notification@paypal.com': {
    legitimate: true,
    riskScore: 5,
    riskLevel: 'low',
    warnings: []
  },
  'admin@g00gle.com': {
    legitimate: false,
    riskScore: 95,
    riskLevel: 'high',
    warnings: [
      'Typosquatting detected: g00gle.com vs google.com',
      'Domain registered 3 days ago',
      'No SPF/DKIM records found'
    ]
  },
  'support@amaz0n.com': {
    legitimate: false,
    riskScore: 90,
    riskLevel: 'high',
    warnings: [
      'Typosquatting detected: amaz0n.com vs amazon.com',
      'Suspicious TLD',
      'Domain age: 7 days'
    ]
  }
};

class DemoMode {
  constructor() {
    this.enabled = DEMO_MODE;

    if (this.enabled) {
      console.log('[DemoMode] 🎬 DEMO MODE ENABLED - Using mock data for instant results');
    }
  }

  /**
   * Get mock LinkedIn verification result
   */
  getMockLinkedInResult(firstName, lastName, email = null) {
    if (!this.enabled) return null;

    const fullName = `${firstName} ${lastName}`.toLowerCase();

    // Check if we have a mock profile
    const mockResult = MOCK_LINKEDIN_PROFILES[fullName];

    if (mockResult) {
      console.log(`[DemoMode] 🎬 Returning instant mock LinkedIn result for: ${fullName}`);

      // If email provided, validate domain match
      if (email && mockResult.profile) {
        const emailDomain = email.split('@')[1];
        const companyDomain = mockResult.profile.company.toLowerCase().replace(/\s+/g, '') + '.com';

        if (emailDomain === companyDomain || emailDomain.includes(mockResult.profile.company.toLowerCase())) {
          mockResult.emailMatch = true;
        } else {
          mockResult.emailMatch = false;
          mockResult.warning = `Email domain "${emailDomain}" doesn't match ${mockResult.profile.company}`;
          mockResult.confidence = 40;
        }
      }

      return mockResult;
    }

    // Default: not found
    return {
      verified: false,
      confidence: 30,
      reason: `No LinkedIn profile found for "${firstName} ${lastName}"`,
      warning: 'Could not verify this person exists on LinkedIn',
      profiles: []
    };
  }

  /**
   * Get mock URLScan result
   */
  getMockURLScanResult(url) {
    if (!this.enabled) return null;

    // Extract domain from URL
    const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    // Check for exact match
    if (MOCK_URLSCAN_RESULTS[domain]) {
      console.log(`[DemoMode] 🎬 Returning instant mock URLScan result for: ${domain}`);
      return MOCK_URLSCAN_RESULTS[domain];
    }

    // Check for partial matches (e.g., "paypal" in domain)
    for (const [mockDomain, result] of Object.entries(MOCK_URLSCAN_RESULTS)) {
      if (domain.includes(mockDomain.split('.')[0])) {
        console.log(`[DemoMode] 🎬 Returning mock result for similar domain: ${domain} → ${mockDomain}`);
        return result;
      }
    }

    // Default: medium risk unknown site
    console.log(`[DemoMode] 🎬 Returning default mock result for unknown domain: ${domain}`);
    return {
      verdict: { malicious: false, suspicious: true },
      security: { https: true, certificate: 'valid' },
      domainAge: 365, // 1 year
      redirects: 0,
      phishing: false
    };
  }

  /**
   * Get mock email verification result
   */
  getMockEmailResult(email) {
    if (!this.enabled) return null;

    if (MOCK_EMAIL_RESULTS[email]) {
      console.log(`[DemoMode] 🎬 Returning instant mock email result for: ${email}`);
      return MOCK_EMAIL_RESULTS[email];
    }

    // Default: low risk
    return {
      legitimate: true,
      riskScore: 15,
      riskLevel: 'low',
      warnings: []
    };
  }

  /**
   * Simulate processing delay for realism
   */
  async simulateDelay(minMs = 500, maxMs = 1500) {
    if (!this.enabled) return;

    const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Export singleton
const demoMode = new DemoMode();

module.exports = {
  demoMode,
  DEMO_MODE
};
