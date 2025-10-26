/**
 * Reka AI Vision Service
 *
 * Analyzes screenshots using Reka AI's multimodal vision capabilities to detect:
 * - Suspicious messages in any app (Instagram, WhatsApp, iMessage, etc.)
 * - Phishing attempts in visual content
 * - Scam patterns in text conversations
 * - Urgency tactics, emotional manipulation, impersonation
 */

const axios = require('axios');
// Note: dotenv is already loaded by main.js, don't call config() again

class RekaVisionService {
  constructor() {
    this.apiKey = process.env.REKA_API_KEY;
    this.apiUrl = 'https://api.reka.ai/v1/chat/completions';
    this.model = 'reka-flash'; // Vision-capable model
    this.enabled = !!this.apiKey;

    // Debug logging
    console.log('[RekaVision] Initializing...');
    console.log('[RekaVision] API key present:', !!this.apiKey);
    if (this.apiKey) {
      console.log('[RekaVision] API key (first 10 chars):', this.apiKey.substring(0, 10) + '...');
    }

    if (!this.enabled) {
      console.warn('[RekaVision] API key not configured - Reka AI vision monitoring disabled');
      console.warn('[RekaVision] Set REKA_API_KEY in .env to enable full-screen scam detection');
      console.warn('[RekaVision] Current env vars:', Object.keys(process.env).filter(k => k.includes('REKA')));
    } else {
      console.log('[RekaVision] Service initialized with API key');
    }
  }

  /**
   * Check if Reka AI is available
   */
  isAvailable() {
    return this.enabled;
  }

  /**
   * Analyze a screenshot for suspicious content
   * @param {Buffer} imageBuffer - PNG image buffer from screen capture
   * @returns {Promise<Object>} Analysis result with risk score and explanation
   */
  async analyzeScreenshot(imageBuffer) {
    if (!this.enabled) {
      throw new Error('Reka AI vision service is not configured');
    }

    try {
      console.log('[RekaVision] Analyzing screenshot...');

      // Convert buffer to base64 data URL
      const base64Image = imageBuffer.toString('base64');
      const imageUrl = `data:image/png;base64,${base64Image}`;

      // Prepare the analysis prompt
      const prompt = this.buildAnalysisPrompt();

      // Call Reka AI API (using their native format, not OpenAI-compatible)
      const response = await axios.post(
        'https://api.reka.ai/chat',
        {
          model_name: this.model,
          conversation_history: [
            {
              type: 'human',
              text: prompt,
              media_url: imageUrl
            }
          ],
          request_output_len: 500,
          temperature: 0.3 // Lower temperature for more consistent analysis
        },
        {
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      const analysis = this.parseAnalysis(response.data);
      console.log('[RekaVision] Analysis complete:', { risk: analysis.riskScore, threats: analysis.threats.length });

      return analysis;
    } catch (error) {
      console.error('[RekaVision] Analysis failed:', error.message);

      if (error.response) {
        console.error('[RekaVision] API error:', error.response.status, error.response.data);
      }

      throw error;
    }
  }

  /**
   * Build the analysis prompt for Reka AI
   */
  buildAnalysisPrompt() {
    return `You are an expert scam detection AI analyzing a screenshot for potential threats.

Analyze this screen for signs of scams, phishing, fraud, or suspicious content. Look for:

1. MESSAGE ANALYSIS:
   - Urgency tactics ("act now", "limited time", "verify immediately")
   - Emotional manipulation (fear, greed, panic)
   - Impersonation attempts (claiming to be authority, company, friend)
   - Unusual requests (money, personal info, credentials, gift cards)
   - Suspicious language patterns (poor grammar, generic greetings)

2. VISUAL RED FLAGS:
   - Login pages on suspicious domains
   - Fake notifications or alerts
   - Prize/lottery claims
   - Investment opportunities with unrealistic returns
   - Romance/catfishing patterns
   - Job scam indicators

3. TECHNICAL INDICATORS:
   - Suspicious URLs visible on screen
   - Mismatched sender information
   - Unusual payment methods requested
   - Shortened or obfuscated links

Respond ONLY in this JSON format:
{
  "riskScore": <0-100>,
  "category": "<safe|suspicious|threat>",
  "threats": [
    {
      "type": "<phishing|impersonation|urgency|financial|romance|other>",
      "description": "<brief description>",
      "severity": "<low|medium|high>"
    }
  ],
  "summary": "<1-2 sentence explanation>",
  "recommendation": "<what user should do>"
}

If the screen shows normal, safe content (social media feed, news, regular conversation), set riskScore to 0-20 and category to "safe".
Be precise and only flag genuinely suspicious content.`;
  }

  /**
   * Parse Reka AI response into structured analysis
   */
  parseAnalysis(responseData) {
    try {
      // Extract the text from Reka's native response format
      const message = responseData.text || responseData.response || '';

      if (!message) {
        throw new Error('No response text found');
      }

      console.log('[RekaVision] Raw response:', message.substring(0, 500));

      // Try to parse JSON from the response - use greedy match to get the last complete JSON
      const jsonMatch = message.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      let jsonString = jsonMatch[0];

      // Try to fix common JSON issues
      // 1. Remove any trailing text after the last }
      const lastBrace = jsonString.lastIndexOf('}');
      if (lastBrace !== -1) {
        jsonString = jsonString.substring(0, lastBrace + 1);
      }

      console.log('[RekaVision] Attempting to parse JSON:', jsonString.substring(0, 300));

      const parsed = JSON.parse(jsonString);

      // Validate required fields
      if (typeof parsed.riskScore !== 'number' || !parsed.category || !Array.isArray(parsed.threats)) {
        throw new Error('Invalid response structure');
      }

      return {
        riskScore: Math.min(100, Math.max(0, parsed.riskScore)),
        category: parsed.category,
        threats: parsed.threats || [],
        summary: parsed.summary || 'Analysis complete',
        recommendation: parsed.recommendation || 'Stay vigilant',
        raw: responseData
      };
    } catch (error) {
      console.error('[RekaVision] Failed to parse analysis:', error.message);

      // Return a conservative fallback
      return {
        riskScore: 0,
        category: 'safe',
        threats: [],
        summary: 'Unable to analyze screen content',
        recommendation: 'Analysis failed - manual review recommended',
        error: error.message
      };
    }
  }

  /**
   * Quick test to verify API connectivity
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, error: 'API key not configured' };
    }

    try {
      // Create a simple test image (1x1 white pixel)
      const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

      const response = await axios.post(
        'https://api.reka.ai/chat',
        {
          model_name: this.model,
          conversation_history: [
            {
              type: 'human',
              text: 'Respond with "OK" if you can see this.',
              media_url: testImage
            }
          ],
          request_output_len: 10
        },
        {
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return { success: true, model: this.model };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.response?.data?.error || error.message
      };
    }
  }
}

// Singleton instance
let instance = null;

function getRekaVisionService() {
  if (!instance) {
    instance = new RekaVisionService();
  }
  return instance;
}

module.exports = {
  RekaVisionService,
  getRekaVisionService
};
