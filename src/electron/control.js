// Protego Dashboard JavaScript

console.log('Protego dashboard loaded');

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let isMonitoring = false;
let gmailConnected = false;
let isDemoAutoScanning = false;

// Settings
let settings = {
  urlScan: true,
  gmailScan: false,
  screenOCR: false,
  rekaEnabled: false,
  rekaMode: 'manual', // 'manual' or 'auto'
  sound: true,
  notifications: true,
  educational: true
};

// Load settings from localStorage
function loadSettings() {
  const saved = localStorage.getItem('cluely-settings');
  if (saved) {
    const parsedSettings = JSON.parse(saved);

    // Remove old rekaAI field if it exists
    delete parsedSettings.rekaAI;

    settings = { ...settings, ...parsedSettings };
  }
}

// Save settings to localStorage and sync with main process
async function saveSettings() {
  // Remove old rekaAI field before saving
  const cleanSettings = { ...settings };
  delete cleanSettings.rekaAI;

  localStorage.setItem('cluely-settings', JSON.stringify(cleanSettings));

  // Sync settings with main process
  if (window.electronAPI.updateSettings) {
    await window.electronAPI.updateSettings(cleanSettings);
  }
}

// Onboarding removed - no longer needed

// ============================================================================
// TAB NAVIGATION
// ============================================================================

console.log('Setting up tab navigation...');
const tabButtons = document.querySelectorAll('.tab-item');
const tabContents = document.querySelectorAll('.tab-content');

console.log('Found tab buttons:', tabButtons.length);
console.log('Found tab contents:', tabContents.length);

tabButtons.forEach((button, index) => {
  console.log(`Setting up tab ${index}:`, button.getAttribute('data-tab'));
  button.addEventListener('click', async () => {
    console.log('Tab clicked!', button.getAttribute('data-tab'));
    const tabName = button.getAttribute('data-tab');

    // Update active states
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    button.classList.add('active');
    const targetContent = document.getElementById(`tab-${tabName}`);
    console.log('Target content element:', targetContent);
    if (targetContent) {
      targetContent.classList.add('active');
      console.log(`Switched to ${tabName} tab`);

      // Load history when History tab is opened
      if (tabName === 'history') {
        await loadHistoryTab();
      }
    } else {
      console.error(`Could not find tab content: tab-${tabName}`);
    }
  });
});

// ============================================================================
// MONITORING CONTROLS
// ============================================================================

const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const scanBtn = document.getElementById('scan-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

async function startMonitoring() {
  console.log('▶ Starting monitoring...');
  try {
    const result = await window.electronAPI.startMonitoring();
    if (result.success) {
      isMonitoring = true;
      updateMonitoringUI();
    }
  } catch (error) {
    console.error('Start error:', error);
  }
}

async function stopMonitoring() {
  console.log('⏹ Stopping monitoring...');
  try {
    const result = await window.electronAPI.stopMonitoring();
    if (result.success) {
      isMonitoring = false;
      updateMonitoringUI();
    }
  } catch (error) {
    console.error('Stop error:', error);
  }
}

function updateMonitoringUI() {
  if (isMonitoring) {
    statusDot.classList.add('active');
    statusText.textContent = 'Monitoring Active';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    statusDot.classList.remove('active');
    statusText.textContent = 'Inactive';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

startBtn.addEventListener('click', startMonitoring);
stopBtn.addEventListener('click', stopMonitoring);

// Manual scan
scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  scanBtn.innerHTML = '<span class="loading-dots">Scanning</span>';

  await window.electronAPI.manualScan();

  setTimeout(() => {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Manual Scan';
  }, 1000);
});

// ============================================================================
// STATISTICS
// ============================================================================

const refreshStatsBtn = document.getElementById('refresh-stats-btn');
const clearAllStatsBtn = document.getElementById('clear-history-btn');

async function loadStats(animate = false) {
  try {
    const stats = await window.electronAPI.getScanStats();

    const statElements = {
      threats: document.getElementById('stat-threats'),
      safe: document.getElementById('stat-safe'),
      urls: document.getElementById('stat-urls'),
      emails: document.getElementById('stat-emails'),
      clipboard: document.getElementById('stat-clipboard'),
      manual: document.getElementById('stat-manual'),
      emailThreats: document.getElementById('stat-email-threats'),
      week: document.getElementById('stat-week'),
      today: document.getElementById('stat-today')
    };

    if (animate) {
      Object.values(statElements).forEach(el => {
        if (el) {
          el.classList.add('stat-pulse');
          setTimeout(() => el.classList.remove('stat-pulse'), 500);
        }
      });
    }

    // Main stats (with null checks)
    if (statElements.threats) statElements.threats.textContent = stats.threats || 0;
    if (statElements.safe) statElements.safe.textContent = stats.safe || 0;

    // Calculate URLs vs Emails
    const urlScans = (stats.bySource?.clipboard || 0) + (stats.bySource?.manual || 0) + (stats.bySource?.['screen-ocr'] || 0) + (stats.bySource?.demo || 0);
    const emailScans = stats.bySource?.gmail || 0;

    if (statElements.urls) statElements.urls.textContent = urlScans;
    if (statElements.emails) statElements.emails.textContent = emailScans;

    // Detailed breakdown (with null checks)
    if (statElements.clipboard) statElements.clipboard.textContent = stats.bySource?.clipboard || 0;
    if (statElements.manual) statElements.manual.textContent = stats.bySource?.manual || 0;
    if (statElements.emailThreats) statElements.emailThreats.textContent = stats.week?.threats || 0;
    if (statElements.week) statElements.week.textContent = stats.week?.total || 0;
    if (statElements.today) statElements.today.textContent = stats.today?.total || 0;

    console.log('Stats loaded:', stats);
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

refreshStatsBtn.addEventListener('click', async () => {
  refreshStatsBtn.innerHTML = '<span class="loading-dots">Loading</span>';
  await loadStats(true);
  refreshStatsBtn.textContent = 'Refresh';
});

// Clear all stats
clearAllStatsBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all scan history? This will reset all stats to 0 and cannot be undone.')) {
    try {
      await window.electronAPI.clearHistory();
      localStorage.removeItem('demo-mode-enabled'); // Allow demo mode to run again
      await loadStats(true);
      alert('All scan history cleared! Stats reset to 0.');
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert('Failed to clear history');
    }
  }
});

// Listen for scan results and update stats + history
window.electronAPI.onScanResult(() => {
  setTimeout(() => {
    loadStats(true);
    // Reload history if History tab is currently open
    const historyTab = document.getElementById('tab-history');
    if (historyTab && historyTab.classList.contains('active')) {
      loadHistoryTab();
    }
  }, 500);
});

// ============================================================================
// GMAIL INTEGRATION
// ============================================================================

const gmailBtn = document.getElementById('gmail-btn');
const gmailTitle = document.getElementById('gmail-title'); // May not exist

if (gmailBtn) {
  gmailBtn.addEventListener('click', async () => {
    if (gmailConnected) {
      // Refresh Gmail
      gmailBtn.disabled = true;
      gmailBtn.innerHTML = '<span class="loading-dots">Refreshing</span>';

      try {
        const result = await window.electronAPI.refreshGmail();
        if (result.success) {
          updateGmailUI(result);
        }
      } catch (error) {
        console.error('Gmail refresh error:', error);
      } finally {
        gmailBtn.disabled = false;
        gmailBtn.textContent = 'Refresh Gmail';
      }
    } else {
      // Connect Gmail
      gmailBtn.disabled = true;
      gmailBtn.innerHTML = '<span class="loading-dots">Connecting</span>';

      try {
        const result = await window.electronAPI.connectGmail();

        if (result.success) {
          gmailConnected = true;
          updateGmailUI(result);
        } else {
          if (gmailTitle) gmailTitle.textContent = 'Connection Failed';
        }
      } catch (error) {
        console.error('Gmail connect error:', error);
        if (gmailTitle) gmailTitle.textContent = 'Connection Failed';
      } finally {
        gmailBtn.disabled = false;
        gmailBtn.textContent = gmailConnected ? 'Refresh Gmail' : 'Connect Gmail';
      }
    }
  });
}

function updateGmailUI(status) {
  const gmailEmail = document.getElementById('gmail-email');
  const gmailBadge = document.getElementById('gmail-badge');

  if (status.connected && status.email) {
    if (gmailTitle) gmailTitle.textContent = `Connected: ${status.email}`;
    if (gmailBtn) gmailBtn.textContent = 'Refresh Gmail';

    // Show email address below the header
    if (gmailEmail) {
      gmailEmail.textContent = `Connected: ${status.email}`;
      gmailEmail.style.display = 'block';
    }

    // Update badge
    if (gmailBadge) {
      gmailBadge.textContent = 'Connected';
      gmailBadge.className = 'badge badge-success';
      gmailBadge.style.display = 'inline-block';
    }

    settings.gmailScan = true;
    saveSettings();
    updateSettingToggle('toggle-gmail-scan', true);
  } else {
    if (gmailTitle) gmailTitle.textContent = 'Not Connected';

    // Hide email address
    if (gmailEmail) {
      gmailEmail.style.display = 'none';
    }

    // Update badge
    if (gmailBadge) {
      gmailBadge.textContent = 'Not Connected';
      gmailBadge.className = 'badge badge-warning';
      gmailBadge.style.display = 'inline-block';
    }
  }
}

// Listen for Gmail status updates
window.electronAPI.onGmailStatus((status) => {
  gmailConnected = status.connected;
  updateGmailUI(status);
});

// ============================================================================
// DEMO MODE (Auto-enabled)
// ============================================================================

// Auto-enable demo mode on first launch (DISABLED - causes stats to show old data)
async function autoEnableDemoMode() {
  // Demo mode disabled - users start with clean slate
  console.log('Demo mode auto-enable disabled');
}

// ============================================================================
// EXPORT REPORT
// ============================================================================

const exportBtn = document.getElementById('export-report-btn');

exportBtn.addEventListener('click', async () => {
  try {
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<span class="loading-dots">Exporting</span>';

    const jsonData = await window.electronAPI.exportHistory();
    const stats = await window.electronAPI.getScanStats();

    const report = generateHTMLReport(JSON.parse(jsonData), stats);

    const blob = new Blob([report], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detectify-report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    exportBtn.textContent = 'Exported!';

    setTimeout(() => {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export Report';
      exportBtn.classList.remove('celebrate');
    }, 2000);
  } catch (error) {
    console.error('Failed to export report:', error);
    exportBtn.disabled = false;
    exportBtn.textContent = 'Failed';
    setTimeout(() => {
      exportBtn.textContent = 'Export Report';
    }, 2000);
  }
});

function generateHTMLReport(data, stats) {
  const exportDate = new Date().toLocaleDateString();
  const recentScans = data.history.slice(0, 20);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Protego Security Report - ${exportDate}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; background: #f9fafb; }
    .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    h1 { color: #1d1d1f; margin-bottom: 8px; font-size: 36px; }
    .subtitle { color: #86868b; margin-bottom: 32px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 32px 0; }
    .stat { background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
    .stat-label { font-size: 12px; color: #86868b; text-transform: uppercase; }
    .danger { color: #ff3b30; }
    .success { color: #34c759; }
    .warning { color: #ff9500; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e5ea; }
    th { background: #f9fafb; font-weight: 600; font-size: 12px; text-transform: uppercase; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-danger { background: #ff3b3020; color: #ff3b30; }
    .badge-warning { background: #ff950020; color: #ff9500; }
    .badge-success { background: #34c75920; color: #34c759; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Security Report</h1>
    <div class="subtitle">Generated on ${exportDate}</div>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">Total Scans</div>
      </div>
      <div class="stat">
        <div class="stat-value danger">${stats.threats}</div>
        <div class="stat-label">Threats Blocked</div>
      </div>
      <div class="stat">
        <div class="stat-value success">${stats.safe}</div>
        <div class="stat-label">Safe URLs</div>
      </div>
      <div class="stat">
        <div class="stat-value warning">${stats.today.threats}</div>
        <div class="stat-label">Today's Threats</div>
      </div>
    </div>

    <h2 style="margin-top: 32px; margin-bottom: 16px;">Recent Activity</h2>
    <table>
      <thead>
        <tr>
          <th>Date & Time</th>
          <th>URL</th>
          <th>Risk Level</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        ${recentScans.map(scan => `
          <tr>
            <td>${new Date(scan.timestamp).toLocaleString()}</td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${scan.url || 'N/A'}</td>
            <td>
              <span class="badge badge-${scan.riskLevel === 'high' ? 'danger' : scan.riskLevel === 'medium' ? 'warning' : 'success'}">
                ${scan.riskLevel.toUpperCase()}
              </span>
            </td>
            <td>${scan.riskScore}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
  `;
}

// ============================================================================
// SETTINGS
// ============================================================================

const clearHistoryBtn = document.getElementById('clear-history-btn');

// Toggle switches
const toggles = {
  'toggle-url-scan': 'urlScan',
  'toggle-gmail-scan': 'gmailScan',
  'toggle-sound': 'sound',
  'toggle-notifications': 'notifications',
  'toggle-educational': 'educational'
};

// Screen OCR Toggle (special handler - needs IPC)
const screenOCRToggle = document.getElementById('toggle-screen-ocr');

if (screenOCRToggle) {
  screenOCRToggle.addEventListener('click', async () => {
    const isActive = screenOCRToggle.classList.contains('active');

    if (!isActive) {
      // Enable Screen OCR monitoring
      console.log('Enabling Screen OCR monitoring...');
      try {
        const result = await window.electronAPI.enableScreenOCR();
        if (result && result.success) {
          screenOCRToggle.classList.add('active');
          settings.screenOCR = true;
          await saveSettings();
          console.log('Screen OCR monitoring enabled');
        } else {
          const reason = result?.reason || 'Unknown error';
          alert(`Screen OCR monitoring failed to start.\n\nReason: ${reason}\n\nCheck the console for more details.`);
          console.warn('Screen OCR not available:', reason);
        }
      } catch (error) {
        alert('Failed to start Screen OCR monitoring. Check console for details.');
        console.error('Failed to start Screen OCR:', error);
      }
    } else {
      // Disable Screen OCR monitoring
      console.log('Disabling Screen OCR monitoring...');
      try {
        const result = await window.electronAPI.disableScreenOCR();
        if (result && result.success) {
          screenOCRToggle.classList.remove('active');
          settings.screenOCR = false;
          await saveSettings();
          console.log('Screen OCR monitoring disabled');
        } else {
          console.error('Failed to stop Screen OCR:', result?.reason || 'Unknown error');
        }
      } catch (error) {
        console.error('Failed to stop Screen OCR:', error);
      }
    }
  });

  // Set initial state based on settings
  if (settings.screenOCR) {
    screenOCRToggle.classList.add('active');
  }
}

// Reka AI Simple Buttons
const rekaManualBtn = document.getElementById('reka-manual-btn');
const rekaAutoBtn = document.getElementById('reka-auto-btn');

if (rekaManualBtn && rekaAutoBtn) {
  // Manual button - starts monitor with manual mode
  rekaManualBtn.addEventListener('click', async () => {
    console.log('Reka AI: Manual mode (Cmd+Shift+S only)');
    rekaManualBtn.disabled = true;
    rekaManualBtn.textContent = 'Starting...';

    try {
      const result = await window.electronAPI.startRekaMonitor();
      if (result && result.success) {
        // Set interval super high for manual mode
        if (window.electronAPI.setRekaScanInterval) {
          await window.electronAPI.setRekaScanInterval(999999999);
        }
        rekaManualBtn.textContent = 'Manual Mode (Active)';
        rekaManualBtn.classList.add('btn-primary');
        rekaManualBtn.classList.remove('btn-secondary');
        rekaAutoBtn.classList.remove('btn-primary');
        rekaAutoBtn.classList.add('btn-secondary');
        rekaAutoBtn.textContent = 'Auto-Scan (10s)';
        console.log('✓ Manual mode active');
      } else {
        rekaManualBtn.textContent = 'Manual Mode (Failed)';
        console.error('Failed to start:', result?.reason);
      }
    } catch (error) {
      console.error('Error:', error);
      rekaManualBtn.textContent = 'Manual Mode (Error)';
    } finally {
      rekaManualBtn.disabled = false;
    }
  });

  // Auto button - starts monitor with 10s auto-scan
  rekaAutoBtn.addEventListener('click', async () => {
    console.log('Reka AI: Auto-scan mode (10s interval)');
    rekaAutoBtn.disabled = true;
    rekaAutoBtn.textContent = 'Starting...';

    try {
      const result = await window.electronAPI.startRekaMonitor();
      if (result && result.success) {
        // Set 10 second interval
        if (window.electronAPI.setRekaScanInterval) {
          await window.electronAPI.setRekaScanInterval(10000);
        }
        rekaAutoBtn.textContent = 'Auto-Scan (Active)';
        rekaAutoBtn.classList.add('btn-primary');
        rekaAutoBtn.classList.remove('btn-secondary');
        rekaManualBtn.classList.remove('btn-primary');
        rekaManualBtn.classList.add('btn-secondary');
        rekaManualBtn.textContent = 'Manual Mode (Cmd+Shift+S)';
        console.log('✓ Auto-scan mode active');
      } else {
        rekaAutoBtn.textContent = 'Auto-Scan (Failed)';
        console.error('Failed to start:', result?.reason);
      }
    } catch (error) {
      console.error('Error:', error);
      rekaAutoBtn.textContent = 'Auto-Scan (Error)';
    } finally {
      rekaAutoBtn.disabled = false;
    }
  });
}

function updateSettingToggle(toggleId, active) {
  const toggle = document.getElementById(toggleId);
  if (toggle) {
    if (active) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  }
}

// Setup toggle listeners
Object.keys(toggles).forEach(toggleId => {
  const toggle = document.getElementById(toggleId);
  const settingKey = toggles[toggleId];

  if (toggle) {
    toggle.addEventListener('click', () => {
      settings[settingKey] = !settings[settingKey];
      updateSettingToggle(toggleId, settings[settingKey]);
      saveSettings();
      console.log('Setting updated:', settingKey, settings[settingKey]);
    });

    // Set initial state
    updateSettingToggle(toggleId, settings[settingKey]);
  }
});

// Duplicate Reka toggle removed - already handled above

// Clear history
clearHistoryBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all scan history? This cannot be undone.')) {
    try {
      await window.electronAPI.clearHistory();
      await loadStats(true);
      await loadHistoryTab(); // Reload the history tab to show "No scans yet"
      alert('Scan history cleared successfully!');
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert('Failed to clear history');
    }
  }
});

// ============================================================================
// HISTORY VIEW
// ============================================================================

const historyListContainer = document.getElementById('history-list');
const viewAllHistoryBtn = document.getElementById('view-history-btn');

/**
 * Load and display scan history in the History tab
 */
async function loadHistoryTab() {
  try {
    console.log('[History] Loading scan history...');
    const history = await window.electronAPI.getScanHistory();
    console.log('[History] Loaded', history.length, 'history entries');

    if (!historyListContainer) {
      console.error('[History] history-list container not found');
      return;
    }

    if (history.length === 0) {
      historyListContainer.innerHTML = '<div class="result-empty">No scans yet</div>';
      return;
    }

    // Build history HTML
    let html = '';
    history.forEach(entry => {
      const date = new Date(entry.timestamp);
      const timeAgo = getTimeAgo(date);
      const riskClass = entry.riskLevel || 'low';
      const riskColor = riskClass === 'high' ? 'var(--danger)' :
                        riskClass === 'medium' ? 'var(--warning)' : 'var(--success)';

      const sourceLabel = entry.source === 'gmail' ? '📧 Gmail' :
                          entry.source === 'clipboard' ? '📋 Clipboard' :
                          entry.source === 'active-window' ? '🪟 Browser' :
                          entry.source === 'screen-ocr' ? '🔍 Screen OCR' :
                          entry.source === 'reka-ai' ? '🤖 Reka AI' :
                          entry.source === 'manual' ? '👤 Manual' : entry.source;

      html += `
        <div class="result-card" style="margin-bottom: 12px;">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 11px; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 6px;">${sourceLabel}</span>
                <span style="font-size: 11px; color: var(--text-muted);">${timeAgo}</span>
                ${entry.cached ? '<span style="font-size: 11px; color: #0a84ff; background: rgba(10,132,255,0.15); padding: 2px 8px; border-radius: 6px;">📋 Cached</span>' : ''}
              </div>
              <div style="font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 6px; word-break: break-all;">
                ${entry.url || entry.subject || 'Unknown'}
              </div>
              ${entry.from ? `<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">From: ${entry.from}</div>` : ''}
              <div style="font-size: 12px; color: var(--text-secondary);">
                ${entry.reason || 'No details'}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 24px; font-weight: 700; color: ${riskColor};">
                ${entry.riskScore || 0}
              </div>
              <div class="badge badge-${riskClass}" style="font-size: 9px; padding: 2px 6px;">
                ${riskClass.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    historyListContainer.innerHTML = html;
    console.log('[History] Displayed', history.length, 'entries');
  } catch (error) {
    console.error('[History] Failed to load history:', error);
    if (historyListContainer) {
      historyListContainer.innerHTML = '<div class="result-empty">Failed to load history</div>';
    }
  }
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  for (const [name, secondsInInterval] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInInterval);
    if (interval >= 1) {
      return `${interval} ${name}${interval !== 1 ? 's' : ''} ago`;
    }
  }

  return 'Just now';
}

viewAllHistoryBtn.addEventListener('click', async () => {
  try {
    const history = await window.electronAPI.getScanHistory();
    console.log('Full history:', history);
    alert(`Total scans: ${history.length}\n\nCheck console for full details.`);
  } catch (error) {
    console.error('Failed to load history:', error);
  }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  console.log('Initializing Protego dashboard...');

  loadSettings();
  await autoEnableDemoMode(); // Auto-enable demo mode on first launch
  loadStats();
  updateMonitoringUI();
}

// Hide dashboard button (if it exists)
const hideDashboardBtn = document.getElementById('hide-dashboard-btn');
if (hideDashboardBtn) {
  hideDashboardBtn.addEventListener('click', async () => {
    await window.electronAPI.hideDashboard();
  });
}

// Initialize on load
init();
