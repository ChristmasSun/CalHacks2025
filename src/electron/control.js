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
