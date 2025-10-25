/**
 * Scan History Manager
 *
 * Tracks all scans, threats detected, and provides analytics
 */

const fs = require('fs').promises;
const path = require('path');

class ScanHistory {
  constructor(historyFilePath) {
    this.historyFilePath = historyFilePath;
    this.history = [];
    this.maxHistorySize = 1000; // Keep last 1000 scans
  }

  /**
   * Load history from disk
   */
  async load() {
    try {
      const data = await fs.readFile(this.historyFilePath, 'utf-8');
      this.history = JSON.parse(data);
      console.log(`[ScanHistory] Loaded ${this.history.length} history entries`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[ScanHistory] No history file found, starting fresh');
        this.history = [];
      } else {
        console.error('[ScanHistory] Failed to load history:', error);
        this.history = [];
      }
    }
  }

  /**
   * Save history to disk
   */
  async save() {
    try {
      await fs.writeFile(
        this.historyFilePath,
        JSON.stringify(this.history, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('[ScanHistory] Failed to save history:', error);
    }
  }

  /**
   * Add a scan result to history
   */
  async addScan(scanData) {
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      url: scanData.url,
      riskScore: scanData.risk || 0,
      riskLevel: this.getRiskLevel(scanData.risk || 0),
      reason: scanData.reason || 'Unknown',
      source: scanData.source || 'manual', // clipboard, screen-ocr, active-window, manual
      blocked: scanData.blocked || false,
      ...scanData
    };

    this.history.unshift(entry); // Add to beginning

    // Keep only max size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    await this.save();
    return entry;
  }

  /**
   * Get risk level from score
   */
  getRiskLevel(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Get all history entries
   */
  getAll() {
    return this.history;
  }

  /**
   * Get recent scans (last N)
   */
  getRecent(count = 10) {
    return this.history.slice(0, count);
  }

  /**
   * Get scans by date range
   */
  getByDateRange(startDate, endDate) {
    return this.history.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= startDate && entryDate <= endDate;
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    const total = this.history.length;
    const threats = this.history.filter(e => e.riskScore >= 70).length;
    const medium = this.history.filter(e => e.riskScore >= 40 && e.riskScore < 70).length;
    const safe = this.history.filter(e => e.riskScore < 40).length;
    const blocked = this.history.filter(e => e.blocked).length;

    // Calculate today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayScans = this.history.filter(e => new Date(e.timestamp) >= today);
    const todayThreats = todayScans.filter(e => e.riskScore >= 70).length;

    // Calculate this week's stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekScans = this.history.filter(e => new Date(e.timestamp) >= weekAgo);
    const weekThreats = weekScans.filter(e => e.riskScore >= 70).length;

    // Group by source
    const bySource = {};
    this.history.forEach(entry => {
      bySource[entry.source] = (bySource[entry.source] || 0) + 1;
    });

    // Most dangerous domains
    const domainThreats = {};
    this.history
      .filter(e => e.riskScore >= 70)
      .forEach(entry => {
        try {
          const domain = new URL(entry.url).hostname;
          domainThreats[domain] = (domainThreats[domain] || 0) + 1;
        } catch (e) {
          // Invalid URL
        }
      });

    const topThreats = Object.entries(domainThreats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, count]) => ({ domain, count }));

    return {
      total,
      threats,
      medium,
      safe,
      blocked,
      today: {
        total: todayScans.length,
        threats: todayThreats
      },
      week: {
        total: weekScans.length,
        threats: weekThreats
      },
      bySource,
      topThreats,
      averageRiskScore: total > 0
        ? Math.round(this.history.reduce((sum, e) => sum + e.riskScore, 0) / total)
        : 0
    };
  }

  /**
   * Get timeline data for charts (last N days)
   */
  getTimelineData(days = 7) {
    const timeline = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayScans = this.history.filter(e => {
        const entryDate = new Date(e.timestamp);
        return entryDate >= date && entryDate < nextDate;
      });

      timeline.push({
        date: date.toISOString().split('T')[0],
        total: dayScans.length,
        threats: dayScans.filter(e => e.riskScore >= 70).length,
        medium: dayScans.filter(e => e.riskScore >= 40 && e.riskScore < 70).length,
        safe: dayScans.filter(e => e.riskScore < 40).length
      });
    }

    return timeline;
  }

  /**
   * Clear all history
   */
  async clear() {
    this.history = [];
    await this.save();
    console.log('[ScanHistory] History cleared');
  }

  /**
   * Export history as JSON
   */
  exportJSON() {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      stats: this.getStats(),
      history: this.history
    }, null, 2);
  }
}

module.exports = { ScanHistory };
