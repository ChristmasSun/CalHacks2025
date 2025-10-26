/**
 * Reka AI Screen Monitor
 *
 * Continuously monitors the screen using Reka AI's vision capabilities to detect:
 * - Suspicious messages in any app (Instagram DMs, WhatsApp, iMessage, etc.)
 * - Phishing attempts visible on screen
 * - Scam patterns in conversations
 *
 * Unlike OCR-based monitoring (which only detects URLs), this provides full context
 * analysis of everything visible on screen.
 */

const { getRekaVisionService } = require('./reka-vision');

class RekaScreenMonitor {
  constructor(options = {}) {
    this.interval = null;
    this.scanInterval = options.scanInterval || 30000; // Check every 30 seconds (AI analysis is expensive)
    this.onThreat = options.onThreat || (() => {});
    this.onAnalysis = options.onAnalysis || (() => {});
    this.onSafe = options.onSafe || (() => {});
    this.isProcessing = false;
    this.enabled = false;
    this.rekaVision = getRekaVisionService();

    // Track recent analyses to avoid spam
    this.recentAnalyses = [];
    this.maxRecentAnalyses = 5;

    // Minimum risk score to trigger alert (configurable)
    this.alertThreshold = options.alertThreshold || 40;
  }

  /**
   * Check if Reka AI is available
   */
  async checkAvailability() {
    if (!this.rekaVision.isAvailable()) {
      console.warn('[RekaScreen] Reka AI not configured - screen monitoring disabled');
      console.warn('[RekaScreen] Set REKA_API_KEY in .env to enable AI-powered scam detection');
      return false;
    }

    console.log('[RekaScreen] Testing Reka AI connection...');
    const testResult = await this.rekaVision.testConnection();

    console.log('[RekaScreen] Test result:', JSON.stringify(testResult, null, 2));

    if (!testResult.success) {
      console.error('[RekaScreen] Reka AI connection test FAILED');
      console.error('[RekaScreen] Error details:', testResult.error);
      return false;
    }

    console.log('[RekaScreen] Reka AI connected successfully');
    return true;
  }

  /**
   * Start monitoring the screen with Reka AI
   */
  async start() {
    console.log('[RekaScreen] start() called, current enabled:', this.enabled);

    if (this.enabled) {
      console.log('[RekaScreen] Already running - returning early');
      return { success: false, reason: 'Already running' };
    }

    console.log('[RekaScreen] Starting AI-powered screen monitoring (checking every', this.scanInterval, 'ms)');
    this.enabled = true;

    // Set up periodic scanning (no initial scan - only on interval or manual trigger)
    this.interval = setInterval(async () => {
      if (!this.isProcessing && this.enabled) {
        await this.scanScreen();
      }
    }, this.scanInterval);

    return { success: true, interval: this.scanInterval };
  }

  /**
   * Capture and analyze current screen with Reka AI
   */
  async scanScreen() {
    if (this.isProcessing) {
      console.log('[RekaScreen] ⏳ Scan already in progress, skipping...');
      return; // Skip if already processing
    }

    console.log('[RekaScreen] 🔍 Starting scan...');
    this.isProcessing = true;

    // Show notification that scan has started
    if (this.captureCallback) {
      this.captureCallback(null, {
        message: '🔍 Analyzing screen with AI...',
        scanning: true
      });
    }

    try {
      // Capture screenshot
      const screenshot = await this.captureScreen();
      if (!screenshot || screenshot.length === 0) {
        console.log('[RekaScreen] No screenshot captured, skipping analysis');
        this.isProcessing = false;
        return;
      }

      console.log(`[RekaScreen] Screenshot captured (${screenshot.length} bytes), analyzing with Reka AI...`);

      // Analyze with Reka AI
      const analysis = await this.rekaVision.analyzeScreenshot(screenshot);

      // Store analysis in recent history
      this.recentAnalyses.push({
        timestamp: Date.now(),
        riskScore: analysis.riskScore,
        category: analysis.category,
        threats: analysis.threats
      });

      // Keep only recent analyses
      if (this.recentAnalyses.length > this.maxRecentAnalyses) {
        this.recentAnalyses.shift();
      }

      // Notify listeners of analysis
      this.onAnalysis(analysis);

      console.log(`[RekaScreen] Analysis: ${analysis.category} (risk: ${analysis.riskScore})`);

      // If threat detected above threshold, trigger alert
      if (analysis.riskScore >= this.alertThreshold) {
        console.log('[RekaScreen] THREAT DETECTED:', analysis.summary);

        this.onThreat({
          riskScore: analysis.riskScore,
          category: analysis.category,
          threats: analysis.threats,
          summary: analysis.summary,
          recommendation: analysis.recommendation,
          timestamp: Date.now()
        });
      } else {
        // Safe scan - notify user everything is okay
        console.log('[RekaScreen] SAFE SCAN:', analysis.summary);

        if (this.onSafe) {
          this.onSafe({
            riskScore: analysis.riskScore,
            category: analysis.category,
            summary: analysis.summary,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('[RekaScreen] Screen analysis failed:', error.message);
      // Don't throw - just log and continue monitoring
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Capture the current screen
   * This will be set by main.js via setCaptureCallback
   */
  async captureScreen() {
    try {
      if (this.captureCallback) {
        return await this.captureCallback();
      }
      return null;
    } catch (error) {
      console.error('[RekaScreen] Screen capture failed:', error);
      return null;
    }
  }

  /**
   * Set the screen capture callback (called from main process)
   */
  setCaptureCallback(callback) {
    this.captureCallback = callback;
  }

  /**
   * Stop monitoring the screen
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
      console.log('[RekaScreen] Stopped AI-powered screen monitoring');
      return { success: true };
    }
    return { success: false, reason: 'Not running' };
  }

  /**
   * Pause monitoring temporarily
   */
  pause() {
    this.enabled = false;
    console.log('[RekaScreen] Paused AI-powered screen monitoring');
  }

  /**
   * Resume monitoring after pause
   */
  resume() {
    this.enabled = true;
    console.log('[RekaScreen] Resumed AI-powered screen monitoring');
  }

  /**
   * Get recent analysis history
   */
  getRecentAnalyses() {
    return this.recentAnalyses;
  }

  /**
   * Clear analysis history
   */
  clearHistory() {
    this.recentAnalyses = [];
    console.log('[RekaScreen] Cleared analysis history');
  }

  /**
   * Update alert threshold
   */
  setAlertThreshold(threshold) {
    this.alertThreshold = Math.min(100, Math.max(0, threshold));
    console.log('[RekaScreen] Alert threshold set to:', this.alertThreshold);
  }

  /**
   * Update scan interval
   */
  setScanInterval(interval) {
    this.scanInterval = Math.max(10000, interval); // Minimum 10 seconds

    // Restart interval if already running
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = setInterval(async () => {
        if (!this.isProcessing && this.enabled) {
          await this.scanScreen();
        }
      }, this.scanInterval);
    }

    console.log('[RekaScreen] Scan interval set to:', this.scanInterval, 'ms');
  }

  /**
   * Get monitor status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      isProcessing: this.isProcessing,
      scanInterval: this.scanInterval,
      alertThreshold: this.alertThreshold,
      recentAnalyses: this.recentAnalyses.length,
      available: this.rekaVision.isAvailable()
    };
  }
}

module.exports = { RekaScreenMonitor };
