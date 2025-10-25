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
  scanBtn.textContent = 'Scanning...';

  // Show loading state
  showScanLoading();

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

  scanInfo.innerHTML = `
    <div class="scan-result-card fade-in" onclick="this.classList.toggle('expanded')">
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
}

// Show loading state during scan
function showScanLoading() {
  scanInfo.innerHTML = `
    <div class="scan-loading fade-in">
      <div class="loading-spinner"></div>
      <div class="loading-text">Analyzing URL...</div>
      <div class="loading-subtext">Checking for threats</div>
    </div>
  `;
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
