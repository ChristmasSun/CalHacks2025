/**
 * Scan Queue
 *
 * Manages URLScan.io scan requests with rate limiting and prioritization.
 * Since URLScan.io takes 10-30 seconds per scan, we need to queue requests
 * and respect rate limits.
 */

const { urlHistory } = require('./url-history');

class ScanQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.minDelay = 2000; // 2 seconds minimum between scan submissions (not completion)
    this.lastScanTime = 0;
    this.stats = {
      totalQueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      totalSkipped: 0,
      averageScanTime: 0
    };
  }

  /**
   * Add a URL to the scan queue
   * @param {string} url - URL to scan
   * @param {number} priority - Priority level (higher = scanned sooner)
   * @returns {Promise} - Resolves with scan results
   */
  async enqueue(url, priority = 0) {
    // Check if URL has already been scanned
    if (urlHistory.hasBeenScanned(url)) {
      const history = urlHistory.getHistory(url);
      console.log('[ScanQueue] URL already scanned, returning cached result:', url);
      this.stats.totalSkipped++;
      
      return Promise.resolve({
        cached: true,
        url,
        previousScan: history,
        message: 'This URL was previously scanned and is still cached'
      });
    }

    return new Promise((resolve, reject) => {
      const item = {
        url,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
        enqueuedAt: new Date().toISOString()
      };

      this.queue.push(item);
      this.stats.totalQueued++;

      // Sort queue by priority (higher first), then by timestamp (older first)
      this.queue.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      console.log(`[ScanQueue] Queued ${url} (priority: ${priority}, queue length: ${this.queue.length})`);

      // Start processing if not already processing
      this.processQueue();
    });
  }

  /**
   * Process the scan queue
   */
  async processQueue() {
    // Don't start new processing if already processing
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    console.log(`[ScanQueue] Starting queue processing (${this.queue.length} items)`);

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      const { url, resolve, reject, timestamp } = item;

      // Calculate wait time in queue
      const waitTime = Date.now() - timestamp;
      console.log(`[ScanQueue] Processing ${url} (waited ${waitTime}ms in queue)`);

      // Respect rate limiting
      const timeSinceLastScan = Date.now() - this.lastScanTime;
      if (timeSinceLastScan < this.minDelay) {
        const delayNeeded = this.minDelay - timeSinceLastScan;
        console.log(`[ScanQueue] Rate limiting: waiting ${delayNeeded}ms before next scan`);
        await new Promise(r => setTimeout(r, delayNeeded));
      }

      try {
        this.lastScanTime = Date.now();
        const scanStart = Date.now();

        console.log(`[ScanQueue] Scanning ${url} (${this.queue.length} remaining in queue)`);

        // Import here to avoid circular dependency
        const { inspectUrlInSandbox } = require('../infra/sandbox');
        const result = await inspectUrlInSandbox(url);

        const scanDuration = Date.now() - scanStart;

        // Record the scan in history
        urlHistory.recordScan(url, result?.assessment);

        // Update average scan time
        if (this.stats.averageScanTime === 0) {
          this.stats.averageScanTime = scanDuration;
        } else {
          this.stats.averageScanTime =
            (this.stats.averageScanTime * this.stats.totalProcessed + scanDuration) /
            (this.stats.totalProcessed + 1);
        }

        this.stats.totalProcessed++;

        console.log(`[ScanQueue] Completed ${url} in ${scanDuration}ms`);
        resolve(result);
      } catch (error) {
        this.stats.totalFailed++;
        console.error(`[ScanQueue] Failed to scan ${url}:`, error.message);
        reject(error);
      }
    }

    this.processing = false;
    console.log('[ScanQueue] Queue processing complete');
  }

  /**
   * Get current queue length
   * @returns {number} - Number of URLs waiting to be scanned
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * Get queue statistics
   * @returns {Object} - Queue stats
   */
  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      processing: this.processing,
      estimatedWaitTime: this.queue.length * this.stats.averageScanTime
    };
  }

  /**
   * Clear the queue (emergency stop)
   */
  clearQueue() {
    const clearedCount = this.queue.length;
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared by user'));
    });
    this.queue = [];
    console.log(`[ScanQueue] Cleared ${clearedCount} items from queue`);
  }

  /**
   * Check if a URL is currently in the queue
   * @param {string} url - URL to check
   * @returns {boolean} - true if URL is queued
   */
  isQueued(url) {
    return this.queue.some(item => item.url === url);
  }
}

// Singleton instance
const scanQueue = new ScanQueue();

module.exports = { scanQueue, ScanQueue };
