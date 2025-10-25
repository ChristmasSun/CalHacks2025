// Overlay Window JavaScript - Displays scam warnings

console.log('🖼️ Overlay window loaded');

const warningsContainer = document.getElementById('warnings-container');

// Track active warnings to avoid duplicates
const activeWarnings = new Set();

// Listen for warnings from main process
window.electronAPI.onShowWarning((warning) => {
  console.log('📨 Received warning:', warning);
  showWarning(warning);
});

// Listen for clear warnings signal
window.electronAPI.onClearWarnings(() => {
  console.log('🧹 Clearing all warnings');
  clearAllWarnings();
});

// Show a warning badge
function showWarning(warning) {
  console.log('🎨 Creating warning badge for:', warning);

  const { risk, reason, timestamp, analysis } = warning;

  // Avoid duplicate warnings within 10 seconds
  const warningKey = `${risk}-${reason.substring(0, 50)}`;
  if (activeWarnings.has(warningKey)) {
    console.log('⏭️ Skipping duplicate warning');
    return;
  }

  activeWarnings.add(warningKey);

  // Enable mouse events on overlay when badge appears
  window.electronAPI.setOverlayClickable(true);
  console.log('🖱️ Overlay mouse events enabled');

  // Determine severity class
  let severityClass = 'high';
  let icon = '⚠️';

  if (risk > 70) {
    severityClass = 'high';
    icon = '🚨';
  } else if (risk > 40) {
    severityClass = 'medium';
    icon = '⚠️';
  } else {
    severityClass = 'low';
    icon = 'ℹ️';
  }

  console.log(`📍 Badge severity: ${severityClass} (${risk}%)`);

  // TEMPORARY: Mock analysis data if not provided (replace with real backend data)
  const signals = analysis?.signals || [
    'Suspicious pattern detected',
    'Further analysis in progress'
  ];

  const recommendations = analysis?.recommendations || [
    'Proceed with caution',
    'Verify the source independently',
    'Do not share sensitive information'
  ];

  // Create warning badge element
  const badge = document.createElement('div');
  badge.className = `warning-badge ${severityClass} auto-dismiss`;
  badge.innerHTML = `
    <button class="close-x-btn" title="Dismiss">×</button>
    <div class="warning-header">
      <span class="warning-icon">${icon}</span>
      <span class="warning-title">Potential Scam Detected</span>
      <span class="risk-percentage">${risk}%</span>
    </div>
    <div class="warning-reason">${reason}</div>
    <button class="learn-more-btn">Learn More</button>
    <div class="details-section">
      <div class="details-content">
        <div class="details-title">🔍 How Cluely Analyzed This</div>
        <ul class="details-list">
          ${signals.map(signal => `<li>${signal}</li>`).join('')}
        </ul>
        <div class="details-title">✅ What You Should Do</div>
        <ul class="details-list">
          ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
        <button class="close-btn">Dismiss</button>
      </div>
    </div>
  `;

  // Add event listeners
  const closeXBtn = badge.querySelector('.close-x-btn');
  const learnMoreBtn = badge.querySelector('.learn-more-btn');
  const detailsSection = badge.querySelector('.details-section');
  const closeBtn = badge.querySelector('.close-btn');

  let isExpanded = false;
  let autoDismissTimeout = null;

  // Helper function to remove badge
  const removeBadge = () => {
    badge.style.animation = 'fadeOut 0.3s ease forwards';
    if (autoDismissTimeout) {
      clearTimeout(autoDismissTimeout);
    }
    setTimeout(() => {
      badge.remove();
      activeWarnings.delete(warningKey);
      checkIfShouldDisableClicks();
    }, 300);
  };

  // X button click (top-right corner)
  closeXBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeBadge();
  });

  // Learn More button click
  learnMoreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isExpanded = !isExpanded;

    if (isExpanded) {
      detailsSection.classList.add('expanded');
      learnMoreBtn.textContent = 'Show Less';
      badge.classList.remove('auto-dismiss'); // Stop auto-dismiss when expanded
      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
      }
    } else {
      detailsSection.classList.remove('expanded');
      learnMoreBtn.textContent = 'Learn More';
    }
  });

  // Dismiss button click (inside expanded section)
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeBadge();
  });

  // Add to container
  warningsContainer.appendChild(badge);
  console.log('✅ Badge added to DOM');

  // Auto-remove after 10 seconds if not expanded
  autoDismissTimeout = setTimeout(() => {
    if (!isExpanded) {
      badge.remove();
      activeWarnings.delete(warningKey);
      console.log('🗑️ Badge removed after timeout');
      checkIfShouldDisableClicks();
    }
  }, 10000); // 10 seconds
}

// Check if we should disable clicks (no more badges visible)
function checkIfShouldDisableClicks() {
  // If no badges remain, disable mouse events on overlay
  if (warningsContainer.children.length === 0) {
    window.electronAPI.setOverlayClickable(false);
    console.log('🖱️ Overlay mouse events disabled (no badges)');
  }
}

// Clear all warnings
function clearAllWarnings() {
  warningsContainer.innerHTML = '';
  activeWarnings.clear();
  window.electronAPI.setOverlayClickable(false);
  console.log('🖱️ All warnings cleared, overlay mouse events disabled');
}
