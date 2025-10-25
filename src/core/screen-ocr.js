/**
 * Screen OCR - Extract text and URLs from screen captures
 * Uses Tesseract.js for optical character recognition
 */

const { createWorker } = require('tesseract.js');

let ocrWorker = null;

/**
 * Initialize the OCR worker (reusable across scans)
 */
async function initOCR() {
  if (ocrWorker) {
    return ocrWorker;
  }

  console.log('[ScreenOCR] Initializing Tesseract OCR worker...');

  try {
    // Create worker with error handling for Electron environment
    ocrWorker = await createWorker('eng', 1, {
      errorHandler: (err) => {
        console.error('[ScreenOCR] Worker error:', err.message);
      }
    });

    console.log('[ScreenOCR] ✅ OCR worker ready');
    return ocrWorker;
  } catch (error) {
    console.error('[ScreenOCR] Failed to initialize OCR worker:', error.message);
    console.error('[ScreenOCR] OCR features will be disabled. Screen scanning will still work but without text extraction.');
    ocrWorker = null;
    return null;
  }
}

/**
 * Extract text from an image using OCR
 * @param {string} imagePath - Path to the screenshot image
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromImage(imagePath) {
  try {
    const worker = await initOCR();

    // If worker initialization failed, return empty string
    if (!worker) {
      console.log('[ScreenOCR] OCR worker not available, skipping text extraction');
      return '';
    }

    console.log('[ScreenOCR] Running OCR on screenshot...');
    const { data: { text } } = await worker.recognize(imagePath);

    console.log(`[ScreenOCR] ✅ Extracted ${text.length} characters`);
    return text;
  } catch (error) {
    console.error('[ScreenOCR] OCR failed:', error.message);
    console.log('[ScreenOCR] Continuing without OCR text extraction');
    return '';
  }
}

/**
 * Extract URLs from text with improved handling for broken/partial URLs
 * @param {string} text - Text to search for URLs
 * @returns {string[]} - Array of unique URLs found
 */
function extractURLsFromText(text) {
  if (!text) {
    return [];
  }

  // Remove line breaks and extra spaces to fix broken URLs
  const cleanedText = text
    .replace(/\r?\n/g, '')  // Remove newlines completely to join broken URLs
    .replace(/\s+/g, ' ')   // Collapse multiple spaces
    .trim();

  // Ultra-comprehensive URL regex - captures FULL URLs including long paths and query strings
  // Matches: protocol + domain + full path with any valid URL characters
  const comprehensiveUrlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;

  const matches = cleanedText.match(comprehensiveUrlRegex);

  if (!matches || matches.length === 0) {
    return [];
  }

  // Remove duplicates and clean up URLs
  const uniqueUrls = [...new Set(matches)].map(url => {
    // Remove trailing punctuation that might have been captured
    let cleanUrl = url.replace(/[.,;!?)]+$/, '');

    // Remove trailing closing brackets if no opening bracket in URL
    if (cleanUrl.endsWith(')') && !cleanUrl.includes('(')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    if (cleanUrl.endsWith(']') && !cleanUrl.includes('[')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    return cleanUrl;
  });

  console.log(`[ScreenOCR] Found ${uniqueUrls.length} unique URLs in text`);
  return uniqueUrls;
}

/**
 * Scan a screenshot for URLs using OCR
 * @param {string} screenshotPath - Path to the screenshot
 * @returns {Promise<string[]>} - Array of URLs found in the screenshot
 */
async function scanScreenshotForURLs(screenshotPath) {
  try {
    const text = await extractTextFromImage(screenshotPath);
    const urls = extractURLsFromText(text);

    if (urls.length > 0) {
      console.log('[ScreenOCR] 🔍 URLs detected on screen:', urls);
    } else {
      console.log('[ScreenOCR] No URLs found on screen');
    }

    return urls;
  } catch (error) {
    console.error('[ScreenOCR] Screenshot scan failed:', error.message);
    return [];
  }
}

/**
 * Cleanup the OCR worker when shutting down
 */
async function cleanupOCR() {
  if (ocrWorker) {
    console.log('[ScreenOCR] Terminating OCR worker...');
    await ocrWorker.terminate();
    ocrWorker = null;
  }
}

module.exports = {
  scanScreenshotForURLs,
  extractTextFromImage,
  extractURLsFromText,
  cleanupOCR
};
