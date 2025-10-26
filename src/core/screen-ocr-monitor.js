/**
 * Screen OCR Monitor
 *
 * Automatically detects URLs visible on screen using OCR and scans them.
 * No user action required - just viewing a URL triggers the scan!
 */

const { createWorker } = require('tesseract.js');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ScreenOCRMonitor {
  constructor(options = {}) {
    this.interval = null;
    this.scanInterval = options.scanInterval || 15000; // Check every 15 seconds
    this.onURL = options.onURL || (() => {});
    this.seenURLs = new Set(); // Track URLs we've already seen
    this.worker = null;
    this.isProcessing = false;
    this.enabled = false;

    // URL regex that matches URLs with or without protocol
    // Matches: http://example.com, https://example.com, example.com, sub.example.com
    this.urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;
  }

  /**
   * Initialize the OCR worker
   */
  async initialize() {
    if (this.worker) {
      return; // Already initialized
    }

    console.log('[ScreenOCR] Initializing Tesseract OCR worker...');

    try {
      this.worker = await createWorker('eng', 1, {
        logger: () => {} // Suppress verbose logs
      });

      console.log('[ScreenOCR] OCR worker initialized successfully');
    } catch (error) {
      console.error('[ScreenOCR] Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  /**
   * Start monitoring the screen for URLs
   */
  async start() {
    if (this.enabled) {
      console.log('[ScreenOCR] Already running');
      return;
    }

    // Initialize OCR worker first
    await this.initialize();

    console.log('[ScreenOCR] Starting screen OCR monitoring (checking every', this.scanInterval, 'ms)');
    this.enabled = true;

    this.interval = setInterval(async () => {
      if (!this.isProcessing && this.enabled) {
        await this.scanScreen();
      }
    }, this.scanInterval);
  }

  /**
   * Capture screenshot and extract URLs using OCR
   */
  async scanScreen() {
    if (this.isProcessing) {
      return; // Skip if already processing
    }

    this.isProcessing = true;

    try {
      const screenshot = await this.captureScreen();
      if (!screenshot || screenshot.length === 0) {
        console.log('[ScreenOCR] No screenshot captured, skipping scan');
        this.isProcessing = false;
        return;
      }

      console.log(`[ScreenOCR] Screenshot captured (${screenshot.length} bytes), running OCR...`);

      // Run OCR to extract text
      const text = await this.extractText(screenshot);
      if (!text || text.trim().length === 0) {
        console.log('[ScreenOCR] No text extracted from screenshot');
        this.isProcessing = false;
        return;
      }

      console.log(`[ScreenOCR] Extracted ${text.length} characters from screen`);

      // Log first 200 chars for debugging
      console.log(`[ScreenOCR] Text preview: "${text.substring(0, 200).replace(/\n/g, ' ')}..."`);

      // Find URLs in extracted text
      this.findAndProcessURLs(text);
    } catch (error) {
      console.error('[ScreenOCR] Error during screen scan:', error.message);
      // Don't throw - just log and continue
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Capture the current screen as a base64 image
   */
  async captureScreen() {
    try {
      // This will be implemented by the main process
      // We'll pass a callback from main.js that captures the screen
      if (this.captureCallback) {
        return await this.captureCallback();
      }
      return null;
    } catch (error) {
      console.error('[ScreenOCR] Screen capture failed:', error);
      return null;
    }
  }

  /**
   * Extract text from screenshot using OCR
   */
  async extractText(imageData) {
    if (!this.worker) {
      console.warn('[ScreenOCR] OCR worker not initialized');
      return null;
    }

    if (!imageData) {
      console.warn('[ScreenOCR] No image data provided');
      return null;
    }

    let tempFilePath = null;

    try {
      // Save to temporary file (Tesseract is more reliable with files)
      tempFilePath = path.join(os.tmpdir(), `detectify-ocr-${Date.now()}.png`);
      await fs.writeFile(tempFilePath, imageData);

      // Run OCR on the file
      const { data: { text } } = await this.worker.recognize(tempFilePath);

      // Clean up temp file
      await fs.unlink(tempFilePath).catch(() => {}); // Ignore errors

      return text;
    } catch (error) {
      console.error('[ScreenOCR] OCR extraction failed:', error.message);

      // Clean up temp file if it exists
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => {}); // Ignore errors
      }

      return null;
    }
  }

  /**
   * Find URLs in extracted text and process them
   */
  findAndProcessURLs(text) {
    const urls = text.match(this.urlRegex);

    if (!urls || urls.length === 0) {
      console.log('[ScreenOCR] ℹ️ No URLs found in extracted text');
      return;
    }

    if (urls && urls.length > 0) {
      console.log(`[ScreenOCR] 🔍 Found ${urls.length} URL(s) on screen:`, urls);

      urls.forEach(url => {
        try {
          // Clean up URL (OCR sometimes adds extra characters)
          let cleanUrl = this.cleanURL(url);

          // Add https:// if no protocol specified
          if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
          }

          // Validate URL structure
          const parsed = new URL(cleanUrl);

          // Only process http/https URLs with valid TLDs
          if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
              parsed.hostname.includes('.')) {

            // Skip if we've already seen this URL recently (within last 30 seconds)
            if (this.seenURLs.has(cleanUrl)) {
              return;
            }

            console.log('[ScreenOCR] ✅ New URL detected on screen:', cleanUrl);
            this.seenURLs.add(cleanUrl);

            // Remove from seen list after 30 seconds
            setTimeout(() => {
              this.seenURLs.delete(cleanUrl);
            }, 30000);

            // Trigger scan
            this.onURL(cleanUrl);
          }
        } catch (error) {
          // Invalid URL, skip silently
          console.log('[ScreenOCR] ⚠️ Skipped invalid URL:', url, '(error:', error.message + ')');
        }
      });
    }
  }

  /**
   * Clean up OCR-extracted URL (remove common OCR errors)
   */
  cleanURL(url) {
    return url
      .replace(/\s+/g, '') // Remove spaces
      .replace(/[,;]$/, '') // Remove trailing punctuation
      .replace(/\.$/, '') // Remove trailing period
      .trim();
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
  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.enabled = false;
      console.log('[ScreenOCR] Stopped screen OCR monitoring');
    }

    // Terminate OCR worker to free memory
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      console.log('[ScreenOCR] OCR worker terminated');
    }
  }

  /**
   * Pause monitoring temporarily
   */
  pause() {
    this.enabled = false;
    console.log('[ScreenOCR] Paused screen OCR monitoring');
  }

  /**
   * Resume monitoring after pause
   */
  resume() {
    this.enabled = true;
    console.log('[ScreenOCR] Resumed screen OCR monitoring');
  }

  /**
   * Clear the seen URLs cache
   */
  clearCache() {
    this.seenURLs.clear();
    console.log('[ScreenOCR] Cleared seen URLs cache');
  }
}

module.exports = { ScreenOCRMonitor };
