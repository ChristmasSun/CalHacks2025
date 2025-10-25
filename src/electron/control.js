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

  await window.electronAPI.manualScan();

  setTimeout(() => {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Manual Scan';
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
});

// Display scan result
function displayScanResult(result) {
  const riskColor = result.risk > 70 ? '#ef4444' :
                    result.risk > 40 ? '#f59e0b' :
                    '#10b981';

  const riskLevelText = result.risk > 70 ? 'HIGH RISK' :
                        result.risk > 40 ? 'MEDIUM' :
                        'LOW RISK';

  const riskLevelBg = result.risk > 70 ? '#fee2e2' :
                      result.risk > 40 ? '#fef3c7' :
                      '#d1fae5';

  scanInfo.innerHTML = `
    <div class="scan-risk">
      <span class="risk-value" style="color: ${riskColor}">${result.risk}%</span>
      <span class="risk-label" style="background: ${riskLevelBg}; color: ${riskColor}">${riskLevelText}</span>
    </div>
    <p class="scan-reason">${result.reason || 'No issues detected'}</p>
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
  if (status.connected && status.email) {
    gmailStatus.textContent = `Connected as ${status.email}`;
    gmailStatus.style.color = '#10b981';

    // Display suspicious messages
    if (status.messages && status.messages.length > 0) {
      gmailMessages.innerHTML = status.messages.map(msg => `
        <div class="gmail-message">
          <h4>${msg.subject}</h4>
          <div class="from">${msg.from}</div>
          <div class="reasons">
            ${msg.reasons.map(r => `<span class="reason-tag">${r}</span>`).join('')}
          </div>
        </div>
      `).join('');
    } else {
      gmailMessages.innerHTML = '<p style="color: #10b981; font-size: 0.85rem;">✅ No suspicious emails found</p>';
    }
  } else {
    gmailStatus.textContent = 'Not connected';
    gmailStatus.style.color = '#666';
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
  verifyResult.innerHTML = '<p style="color: #666;">Analyzing...</p>';

  try {
    const result = await window.electronAPI.analyzeText(text);
    console.log('Verification result:', result);

    if (result.success) {
      const color = result.isLegitimate ? '#10b981' : '#ef4444';
      const icon = result.isLegitimate ? '✅' : '⚠️';
      const status = result.isLegitimate ? 'Legitimate' : 'Suspicious';

      let html = `
        <p style="color: ${color}; font-weight: 600; margin-bottom: 5px;">
          ${icon} ${status} (${result.confidence}% confidence)
        </p>
      `;

      if (result.findings && result.findings.length > 0) {
        html += '<div style="margin-top: 8px;">';
        html += '<strong style="font-size: 0.8rem;">Findings:</strong>';
        html += '<ul style="margin: 5px 0 0 20px; font-size: 0.8rem;">';
        result.findings.forEach(f => {
          html += `<li>${f}</li>`;
        });
        html += '</ul></div>';
      }

      if (result.warnings && result.warnings.length > 0) {
        html += '<div style="margin-top: 8px;">';
        html += '<strong style="font-size: 0.8rem; color: #ef4444;">Warnings:</strong>';
        html += '<ul style="margin: 5px 0 0 20px; font-size: 0.8rem; color: #ef4444;">';
        result.warnings.forEach(w => {
          html += `<li>${w}</li>`;
        });
        html += '</ul></div>';
      }

      verifyResult.innerHTML = html;
    } else {
      verifyResult.innerHTML = `<p style="color: #ef4444;">❌ Error: ${result.error}</p>`;
    }
  } catch (error) {
    console.error('Verification error:', error);
    verifyResult.innerHTML = `<p style="color: #ef4444;">❌ Error: ${error.message}</p>`;
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify Contact';
  }
});
