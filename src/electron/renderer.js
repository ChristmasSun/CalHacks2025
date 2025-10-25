// Detectify Scam Detector - Renderer Process
// This file handles the UI logic and screen capture

// DOM elements
const scanButton = document.getElementById('scan-button');
const resultContainer = document.getElementById('result-container');
const riskScoreElement = document.getElementById('risk-score');
const reasonTextElement = document.getElementById('reason-text');
const statusElement = document.getElementById('status');
const alertOverlay = document.getElementById('alert-overlay');
const alertReasonElement = document.getElementById('alert-reason');
const closeAlertButton = document.getElementById('close-alert');
const sourcePickerModal = document.getElementById('source-picker-modal');
const sourceGrid = document.getElementById('source-grid');
const closePickerButton = document.getElementById('close-picker');

// Backend API endpoint
const BACKEND_URL = 'http://localhost:8000/detect';

// Store available sources
let availableSources = [];

// Handle scan button click - show source picker
scanButton.addEventListener('click', async () => {
  try {
    statusElement.textContent = 'Loading available screens...';
    scanButton.disabled = true;

    // Get available sources
    availableSources = await window.electronAPI.getSources();

    // Show source picker
    displaySourcePicker(availableSources);
  } catch (error) {
    console.error('Error loading sources:', error);
    statusElement.textContent = `Error: ${error.message}`;
    scanButton.disabled = false;
  }
});

// Display source picker modal
function displaySourcePicker(sources) {
  // Clear previous sources
  sourceGrid.innerHTML = '';

  if (sources.length === 0) {
    sourceGrid.innerHTML = '<p>No screens or windows found</p>';
    return;
  }

  // Create a card for each source
  sources.forEach(source => {
    const card = document.createElement('div');
    card.className = 'source-card';
    card.innerHTML = `
      <img src="${source.thumbnail}" alt="${source.name}" />
      <p>${source.name}</p>
    `;

    // Handle click to select this source
    card.addEventListener('click', () => {
      sourcePickerModal.classList.add('hidden');
      captureAndAnalyze(source.id);
    });

    sourceGrid.appendChild(card);
  });

  // Show the modal
  sourcePickerModal.classList.remove('hidden');
  statusElement.textContent = 'Select a screen or window to scan';
  scanButton.disabled = false;
}

// Close picker button
closePickerButton.addEventListener('click', () => {
  sourcePickerModal.classList.add('hidden');
  statusElement.textContent = 'Ready to scan';
});

// Capture and analyze selected source
async function captureAndAnalyze(sourceId) {
  try {
    statusElement.textContent = 'Capturing screenshot...';
    resultContainer.classList.add('hidden');
    alertOverlay.classList.add('hidden');

    // Capture the selected source
    const screenshot = await window.electronAPI.captureSource(sourceId);

    statusElement.textContent = 'Analyzing screenshot...';

    // Send screenshot to backend
    const result = await sendToBackend(screenshot);

    // Display results
    displayResult(result);

    // Show alert if high risk
    if (result.risk > 70) {
      showAlert(result.reason);
    }

    statusElement.textContent = 'Scan complete!';
  } catch (error) {
    console.error('Scan error:', error);
    statusElement.textContent = `Error: ${error.message}`;
  }
}

// Close alert button handler
closeAlertButton.addEventListener('click', () => {
  alertOverlay.classList.add('hidden');
});

/**
 * Sends the base64 screenshot to the backend API
 * Returns the JSON response with { risk: number, reason: string }
 */
async function sendToBackend(base64Image) {
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: base64Image
      })
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response format
    if (typeof data.risk !== 'number' || typeof data.reason !== 'string') {
      throw new Error('Invalid response format from backend');
    }

    return data;
  } catch (error) {
    throw new Error(`Backend request failed: ${error.message}`);
  }
}

/**
 * Displays the detection result in the UI
 */
function displayResult(result) {
  riskScoreElement.textContent = result.risk;
  reasonTextElement.textContent = result.reason;
  resultContainer.classList.remove('hidden');

  // Color-code the risk score
  if (result.risk > 70) {
    riskScoreElement.style.color = '#ef4444'; // Red
  } else if (result.risk > 40) {
    riskScoreElement.style.color = '#f59e0b'; // Orange
  } else {
    riskScoreElement.style.color = '#10b981'; // Green
  }
}

/**
 * Shows the full-screen alert overlay for high-risk scams
 */
function showAlert(reason) {
  alertReasonElement.textContent = reason;
  alertOverlay.classList.remove('hidden');
}
