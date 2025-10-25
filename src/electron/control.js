// Control Panel JavaScript

console.log('🎛️ Control panel loaded');

const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const scanBtn = document.getElementById('scan-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const scanInfo = document.getElementById('scan-info');

console.log('Buttons found:', {
  start: !!startBtn,
  stop: !!stopBtn,
  scan: !!scanBtn
});

let isMonitoring = false;

// Start monitoring button
startBtn.addEventListener('click', async () => {
  console.log('▶️ Start button clicked');
  try {
    const result = await window.electronAPI.startMonitoring();
    console.log('Start result:', result);
    if (result.success) {
      isMonitoring = true;
      updateUIState();
    }
  } catch (error) {
    console.error('Start error:', error);
  }
});

// Stop monitoring button
stopBtn.addEventListener('click', async () => {
  console.log('⏹️ Stop button clicked!');
  console.log('Stop button disabled?', stopBtn.disabled);
  console.log('isMonitoring:', isMonitoring);

  try {
    const result = await window.electronAPI.stopMonitoring();
    console.log('Stop result:', result);
    if (result.success) {
      isMonitoring = false;
      updateUIState();
      console.log('✅ UI updated, monitoring stopped');
    }
  } catch (error) {
    console.error('Stop error:', error);
  }
});

// Manual scan button
scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  scanBtn.innerHTML = '<span class="loading-dots">Scanning</span>';

  // Show loading state with progress bar
  showScanLoading(true);

  await window.electronAPI.manualScan();

  setTimeout(() => {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan';
  }, 1000);
});

// Update UI based on monitoring state
function updateUIState() {
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

// Listen for scan results from main process
window.electronAPI.onScanResult((result) => {
  displayScanResult(result);
  // Notifications now shown on overlay window (top-right of screen)
});

// Display scan result
function displayScanResult(result) {
  const riskColor = result.risk > 70 ? 'var(--danger)' :
                    result.risk > 40 ? 'var(--warning)' :
                    'var(--success)';

  const riskLevelText = result.risk > 70 ? 'HIGH RISK' :
                        result.risk > 40 ? 'MEDIUM' :
                        'SAFE';

  const badgeClass = result.risk > 70 ? 'badge-danger' :
                     result.risk > 40 ? 'badge-warning' :
                     'badge-success';

  const icon = result.risk > 70 ? '⚠️' :
               result.risk > 40 ? '⚡' :
               '✓';

  // Add success celebration for safe URLs
  const celebrateClass = result.risk < 40 ? 'celebrate' : '';

  scanInfo.innerHTML = `
    <div class="scan-result-card fade-in ${celebrateClass}" onclick="this.classList.toggle('expanded')">
      <div class="scan-result-header">
        <div class="scan-result-icon">${icon}</div>
        <div class="scan-result-info">
          <div class="scan-result-title">${riskLevelText}</div>
          <div class="scan-result-subtitle">Risk: ${result.risk}%</div>
        </div>
        <div class="badge ${badgeClass}" style="margin-left: auto;">${riskLevelText}</div>
      </div>
      <div class="scan-result-details">
        <div class="scan-detail-divider"></div>
        <p class="scan-detail-text">${result.reason || 'No issues detected'}</p>
        <div class="scan-detail-tip">Tap to ${result.risk > 40 ? 'see more details' : 'collapse'}</div>
      </div>
    </div>
  `;

  // Trigger confetti for very safe URLs
  if (result.risk < 20) {
    triggerConfetti();
  }

  // Reload stats with animation
  loadStats(true);
}

// Show loading state during scan
function showScanLoading(withProgress = false) {
  scanInfo.innerHTML = `
    <div class="scan-loading fade-in">
      <div class="loading-spinner"></div>
      <div class="loading-text">Analyzing URL...</div>
      <div class="loading-subtext">Checking for threats</div>
      ${withProgress ? `
        <div class="progress-bar" style="margin-top: 16px;">
          <div class="progress-fill" style="width: 30%;"></div>
        </div>
      ` : ''}
    </div>
  `;

  // Animate progress bar if enabled
  if (withProgress) {
    setTimeout(() => {
      const progressFill = scanInfo.querySelector('.progress-fill');
      if (progressFill) progressFill.style.width = '60%';
    }, 500);
    setTimeout(() => {
      const progressFill = scanInfo.querySelector('.progress-fill');
      if (progressFill) progressFill.style.width = '90%';
    }, 1000);
  }
}

// Trigger confetti celebration
function triggerConfetti() {
  const colors = ['#0a84ff', '#32d74b', '#ff9f0a', '#5ac8fa', '#bf5af2'];
  const confettiCount = 30;

  for (let i = 0; i < confettiCount; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
      confetti.style.animationDelay = (Math.random() * 0.5) + 's';
      document.body.appendChild(confetti);

      // Remove after animation
      setTimeout(() => confetti.remove(), 3500);
    }, i * 50);
  }
}

// Initialize UI
updateUIState();

// ============================================================================
// GMAIL INTEGRATION
// ============================================================================

const gmailBtn = document.getElementById('gmail-btn');
const gmailStatus = document.getElementById('gmail-status');
const gmailMessages = document.getElementById('gmail-messages');

let gmailConnected = false;

// Gmail connect button
gmailBtn.addEventListener('click', async () => {
  if (gmailConnected) {
    // Refresh Gmail if already connected
    console.log('🔄 Refreshing Gmail...');
    gmailBtn.disabled = true;
    gmailBtn.textContent = 'Refreshing...';

    try {
      const result = await window.electronAPI.refreshGmail();
      console.log('Gmail refresh result:', result);

      if (result.success) {
        displayGmailStatus(result);
      }
    } catch (error) {
      console.error('Gmail refresh error:', error);
    } finally {
      gmailBtn.disabled = false;
      gmailBtn.textContent = 'Refresh Gmail';
    }
  } else {
    // Connect Gmail
    console.log('📧 Connecting Gmail...');
    gmailBtn.disabled = true;
    gmailBtn.textContent = 'Connecting...';

    try {
      const result = await window.electronAPI.connectGmail();
      console.log('Gmail connect result:', result);

      if (result.success) {
        gmailConnected = true;
        gmailBtn.classList.add('connected');
        gmailBtn.textContent = 'Refresh Gmail';
        displayGmailStatus(result);
      } else {
        gmailStatus.textContent = `Error: ${result.error}`;
        gmailStatus.style.color = '#ef4444';
      }
    } catch (error) {
      console.error('Gmail connect error:', error);
      gmailStatus.textContent = `Error: ${error.message}`;
      gmailStatus.style.color = '#ef4444';
    } finally {
      gmailBtn.disabled = false;
      if (!gmailConnected) {
        gmailBtn.textContent = 'Connect Gmail';
      }
    }
  }
});

// Display Gmail status and messages
function displayGmailStatus(status) {
  const gmailBadge = document.getElementById('gmail-badge');

  if (status.connected && status.email) {
    gmailBadge.textContent = 'Connected';
    gmailBadge.className = 'badge badge-success';
    gmailBadge.style.display = 'block';

    // Display suspicious messages
    if (status.messages && status.messages.length > 0) {
      gmailMessages.innerHTML = status.messages.map(msg => `
        <div class="gmail-message fade-in">
          <h4>${msg.subject}</h4>
          <div class="gmail-from">From: ${msg.from}</div>
          <div class="reason-tags">
            ${msg.reasons.map(r => `<span class="reason-tag">${r}</span>`).join('')}
          </div>
        </div>
      `).join('');
      gmailBtn.textContent = 'Refresh Gmail';
    } else {
      gmailMessages.innerHTML = '<div class="result-empty">No suspicious emails found</div>';
      gmailBtn.textContent = 'Refresh Gmail';
    }
  } else {
    gmailBadge.textContent = 'Not Connected';
    gmailBadge.className = 'badge badge-warning';
    gmailBadge.style.display = 'block';
    gmailMessages.innerHTML = '';
  }
}

// Listen for Gmail status updates from main process
window.electronAPI.onGmailStatus((status) => {
  console.log('📧 Gmail status update:', status);
  gmailConnected = status.connected;

  if (gmailConnected) {
    gmailBtn.classList.add('connected');
    gmailBtn.textContent = 'Refresh Gmail';
  }

  displayGmailStatus(status);
});

// ============================================================================
// CONTACT VERIFICATION
// ============================================================================

const contactText = document.getElementById('contact-text');
const verifyBtn = document.getElementById('verify-btn');
const verifyResult = document.getElementById('verify-result');

// Verify contact button
verifyBtn.addEventListener('click', async () => {
  const text = contactText.value.trim();

  if (!text) {
    verifyResult.innerHTML = '<p style="color: #f59e0b;">⚠️ Please paste some text to verify</p>';
    return;
  }

  console.log('🔍 Verifying contact...');
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';

  // Show initial message with estimated time
  verifyResult.innerHTML = `
    <div class="fade-in" style="color: var(--text-secondary); font-size: 13px;">
      <div style="margin-bottom: 8px;">🔍 <strong>Searching LinkedIn...</strong></div>
      <div style="font-size: 12px; color: var(--text-muted);">
        This may take up to 2-3 minutes as we search public LinkedIn profiles
      </div>
      <div class="contact-box" style="margin-top: 12px;">
        <div style="font-size: 11px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          ⏱️ BrightData is discovering profiles...
        </div>
        <div class="loading"></div>
      </div>
    </div>
  `;

  try {
    const result = await window.electronAPI.analyzeText(text);
    console.log('Verification result:', result);

    if (result.success) {
      const badgeClass = result.isLegitimate ? 'badge-success' : 'badge-danger';
      const icon = result.isLegitimate ? '✅' : '⚠️';
      const status = result.isLegitimate ? 'Legitimate' : 'Suspicious';

      let html = `
        <div class="fade-in" style="font-size: 13px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 24px;">${icon}</span>
            <div>
              <span class="badge ${badgeClass}">${status}</span>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                ${result.confidence}% confidence
              </div>
            </div>
          </div>
      `;

      // Show contact info if extracted
      if (result.contact) {
        html += '<div class="contact-box">';
        html += '<strong>Extracted Contact</strong>';
        html += '<div class="contact-item">';
        if (result.contact.name) html += `<div>👤 ${result.contact.name}</div>`;
        if (result.contact.email) html += `<div>📧 ${result.contact.email}</div>`;
        if (result.contact.company) html += `<div>🏢 ${result.contact.company}</div>`;
        html += '</div></div>';
      }

      // Show LinkedIn profile if found
      if (result.linkedInProfile) {
        const profile = result.linkedInProfile;
        html += '<div class="linkedin-profile">';
        html += '<strong>LinkedIn Profile Found</strong>';
        if (profile.name) html += `<div style="font-size: 14px; font-weight: 600; margin-top: 8px;">${profile.name}</div>`;
        if (profile.position) html += `<div class="contact-item">${profile.position}</div>`;
        if (profile.company) html += `<div class="contact-item">@ ${profile.company}</div>`;
        if (profile.location) html += `<div class="contact-item">📍 ${profile.location}</div>`;
        if (profile.url) html += `<div class="contact-item"><a href="${profile.url}" target="_blank">View Profile</a></div>`;
        html += '</div>';
      }

      if (result.findings && result.findings.length > 0) {
        html += '<ul class="findings-list">';
        result.findings.forEach(f => {
          html += `<li>${f}</li>`;
        });
        html += '</ul>';
      }

      if (result.warnings && result.warnings.length > 0) {
        html += '<ul class="warnings-list">';
        result.warnings.forEach(w => {
          html += `<li>${w}</li>`;
        });
        html += '</ul>';
      }

      html += '</div>';
      verifyResult.innerHTML = html;
    } else {
      verifyResult.innerHTML = `<p style="color: #ef4444;">❌ Error: ${result.error}</p>`;
    }
  } catch (error) {
    console.error('Verification error:', error);
    verifyResult.innerHTML = `<p style="color: #ef4444;">❌ Error: ${error.message}</p>`;
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify';
  }
});

// ============================================================================
// COMPACT MODE TOGGLE
// ============================================================================

const compactToggle = document.getElementById('compact-toggle');
let isCompactMode = localStorage.getItem('compactMode') === 'true';

// Apply compact mode on load
if (isCompactMode) {
  document.body.classList.add('compact');
}

// Toggle compact mode
compactToggle.addEventListener('click', () => {
  isCompactMode = !isCompactMode;
  document.body.classList.toggle('compact');
  localStorage.setItem('compactMode', isCompactMode);

  // Add visual feedback
  compactToggle.style.transform = 'scale(1.2)';
  setTimeout(() => {
    compactToggle.style.transform = 'scale(1)';
  }, 200);
});

// Notifications are now handled by the overlay window (top-right of screen)

// ============================================================================
// STATISTICS DASHBOARD
// ============================================================================

const refreshStatsBtn = document.getElementById('refresh-stats-btn');
const viewHistoryBtn = document.getElementById('view-history-btn');

// Load and display stats
async function loadStats(animate = false) {
  try {
    const stats = await window.electronAPI.getScanStats();

    const statElements = {
      total: document.getElementById('stat-total'),
      threats: document.getElementById('stat-threats'),
      safe: document.getElementById('stat-safe'),
      today: document.getElementById('stat-today')
    };

    // Update with animation
    if (animate) {
      Object.values(statElements).forEach(el => {
        el.classList.add('stat-pulse');
        setTimeout(() => el.classList.remove('stat-pulse'), 500);
      });
    }

    statElements.total.textContent = stats.total || 0;
    statElements.threats.textContent = stats.threats || 0;
    statElements.safe.textContent = stats.safe || 0;
    statElements.today.textContent = stats.today?.threats || 0;

    console.log('📊 Stats loaded:', stats);
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// Refresh stats button
refreshStatsBtn.addEventListener('click', async () => {
  refreshStatsBtn.innerHTML = '<span class="loading-dots">Loading</span>';
  await loadStats(true);
  refreshStatsBtn.textContent = '↻ Refresh';

  // Success feedback
  refreshStatsBtn.textContent = '✓ Updated';
  setTimeout(() => {
    refreshStatsBtn.textContent = '↻ Refresh';
  }, 1500);
});

// View history button
viewHistoryBtn.addEventListener('click', async () => {
  try {
    const history = await window.electronAPI.getScanHistory();
    console.log('📜 Full history:', history);
    alert(`Total scans in history: ${history.length}\n\nCheck console for details.`);
  } catch (error) {
    console.error('Failed to load history:', error);
  }
});

// Export report button
const exportReportBtn = document.getElementById('export-report-btn');
exportReportBtn.addEventListener('click', async () => {
  try {
    exportReportBtn.disabled = true;
    exportReportBtn.innerHTML = '<span class="loading-dots">Exporting</span>';

    const jsonData = await window.electronAPI.exportHistory();
    const stats = await window.electronAPI.getScanStats();

    // Generate HTML report
    const report = generateHTMLReport(JSON.parse(jsonData), stats);

    // Download as HTML file
    const blob = new Blob([report], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detectify-report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Success celebration
    exportReportBtn.textContent = '✅ Exported!';
    exportReportBtn.classList.add('celebrate');
    triggerConfetti();

    setTimeout(() => {
      exportReportBtn.disabled = false;
      exportReportBtn.textContent = '📄 Export Report';
      exportReportBtn.classList.remove('celebrate');
    }, 2000);
  } catch (error) {
    console.error('Failed to export report:', error);
    exportReportBtn.disabled = false;
    exportReportBtn.textContent = '❌ Failed';
    setTimeout(() => {
      exportReportBtn.textContent = '📄 Export Report';
    }, 2000);
  }
});

// Generate HTML security report
function generateHTMLReport(data, stats) {
  const exportDate = new Date().toLocaleDateString();
  const recentScans = data.history.slice(0, 20);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Detectify Security Report - ${exportDate}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; background: #f5f5f7; }
    .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    h1 { color: #1d1d1f; margin-bottom: 8px; font-size: 36px; }
    .subtitle { color: #86868b; margin-bottom: 32px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 32px 0; }
    .stat { background: #f5f5f7; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
    .stat-label { font-size: 12px; color: #86868b; text-transform: uppercase; }
    .danger { color: #ff3b30; }
    .success { color: #34c759; }
    .warning { color: #ff9500; }
    .section { margin: 32px 0; }
    .section-title { font-size: 24px; margin-bottom: 16px; color: #1d1d1f; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #d2d2d7; }
    th { background: #f5f5f7; font-weight: 600; color: #1d1d1f; font-size: 12px; text-transform: uppercase; }
    td { font-size: 14px; color: #1d1d1f; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-danger { background: #ff3b3020; color: #ff3b30; }
    .badge-warning { background: #ff950020; color: #ff9500; }
    .badge-success { background: #34c75920; color: #34c759; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #d2d2d7; color: #86868b; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛡️ Security Report</h1>
    <div class="subtitle">Generated by Detectify on ${exportDate}</div>

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

    <div class="section">
      <div class="section-title">Recent Activity (Last 20 Scans)</div>
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
              <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${scan.url || 'N/A'}</td>
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

    ${stats.topThreats && stats.topThreats.length > 0 ? `
    <div class="section">
      <div class="section-title">Top Threat Domains</div>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Blocked Count</th>
          </tr>
        </thead>
        <tbody>
          ${stats.topThreats.map(threat => `
            <tr>
              <td>${threat.domain}</td>
              <td class="danger">${threat.count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="footer">
      <p>This report was generated by Detectify - AI-Powered Scam Detection</p>
      <p>For more information, visit your Detectify dashboard</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Load stats on page load
loadStats();

// Refresh stats whenever a new scan completes (with animation)
window.electronAPI.onScanResult(() => {
  setTimeout(() => loadStats(true), 500); // Small delay to ensure history is saved
});

// ============================================================================
// DEMO MODE
// ============================================================================

const enableDemoBtn = document.getElementById('enable-demo-btn');
const disableDemoBtn = document.getElementById('disable-demo-btn');
const autoScanDemoBtn = document.getElementById('auto-scan-demo-btn');
let isDemoAutoScanning = false;

// Enable demo mode
enableDemoBtn.addEventListener('click', async () => {
  try {
    enableDemoBtn.disabled = true;
    enableDemoBtn.innerHTML = '<span class="loading-dots">Enabling</span>';

    const result = await window.electronAPI.enableDemoMode();

    if (result.success) {
      enableDemoBtn.disabled = true;
      disableDemoBtn.disabled = false;
      autoScanDemoBtn.disabled = false;

      // Reload stats with animation
      await loadStats(true);

      // Success feedback
      enableDemoBtn.textContent = '✅ Demo Active';
      enableDemoBtn.classList.add('celebrate');
      triggerConfetti();

      alert('🎬 Demo Mode Enabled!\n\n50 realistic test scans have been added to your history.\n\nClick "Start Auto-Scan" to continuously generate new threats for your presentation.');
    }
  } catch (error) {
    console.error('Failed to enable demo mode:', error);
    enableDemoBtn.disabled = false;
    enableDemoBtn.textContent = '✨ Enable Demo Mode';
  }
});

// Disable demo mode
disableDemoBtn.addEventListener('click', async () => {
  try {
    await window.electronAPI.disableDemoMode();

    if (isDemoAutoScanning) {
      await window.electronAPI.stopDemoAutoScan();
      isDemoAutoScanning = false;
      autoScanDemoBtn.textContent = '🎯 Start Auto-Scan (8s interval)';
    }

    enableDemoBtn.disabled = false;
    enableDemoBtn.textContent = '✨ Enable Demo Mode';
    disableDemoBtn.disabled = true;
    autoScanDemoBtn.disabled = true;

    alert('Demo mode disabled. Real scanning restored.');
  } catch (error) {
    console.error('Failed to disable demo mode:', error);
  }
});

// Auto-scan demo threats
autoScanDemoBtn.addEventListener('click', async () => {
  try {
    if (!isDemoAutoScanning) {
      await window.electronAPI.startDemoAutoScan();
      isDemoAutoScanning = true;
      autoScanDemoBtn.textContent = '⏹️ Stop Auto-Scan';
      autoScanDemoBtn.classList.remove('btn-secondary');
      autoScanDemoBtn.classList.add('btn-danger');
    } else {
      await window.electronAPI.stopDemoAutoScan();
      isDemoAutoScanning = false;
      autoScanDemoBtn.textContent = '🎯 Start Auto-Scan (8s interval)';
      autoScanDemoBtn.classList.remove('btn-danger');
      autoScanDemoBtn.classList.add('btn-secondary');
    }
  } catch (error) {
    console.error('Failed to toggle auto-scan:', error);
  }
});
