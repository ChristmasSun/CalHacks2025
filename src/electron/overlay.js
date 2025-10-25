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
        <div class="details-title">🔍 How Detectify Analyzed This</div>
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

// ============================================================================
// TOP-RIGHT DROPDOWN NOTIFICATIONS
// ============================================================================

const notificationContainer = document.getElementById('notification-container');
let notificationIdCounter = 0;

// Listen for scan results from main process
window.electronAPI.onScanResult((result) => {
  console.log('📬 Received scan result notification:', result);
  showNotification(result);
});

// Show notification dropdown
function showNotification(result) {
  const riskLevelText = result.risk > 70 ? 'HIGH RISK' :
                        result.risk > 40 ? 'MEDIUM RISK' :
                        'SAFE';

  const icon = result.risk > 70 ? '⚠️' :
               result.risk > 40 ? '⚡' :
               '✓';

  const notificationType = result.risk > 70 ? 'danger' :
                           result.risk > 40 ? 'warning' :
                           'success';

  const notificationId = `notification-${notificationIdCounter++}`;

  const notification = document.createElement('div');
  notification.id = notificationId;
  notification.className = `notification ${notificationType}`;
  notification.innerHTML = `
    <div class="notification-header">
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        <div class="notification-title">${riskLevelText}</div>
        <div class="notification-subtitle">Risk Score: ${result.risk}%</div>
      </div>
      <button class="notification-close" onclick="closeNotification('${notificationId}')">×</button>
    </div>
    <div class="notification-body">
      ${result.reason || 'No issues detected'}
    </div>
    ${result.url ? `<div class="notification-url">${truncateUrl(result.url)}</div>` : ''}
    <div class="notification-progress"></div>
  `;

  notificationContainer.appendChild(notification);

  // Enable clicks on notification container
  notificationContainer.style.pointerEvents = 'auto';

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    closeNotification(notificationId);
  }, 5000);

  // Keep max 3 notifications
  const notifications = notificationContainer.querySelectorAll('.notification');
  if (notifications.length > 3) {
    closeNotification(notifications[0].id);
  }
}

// Close notification with animation
function closeNotification(notificationId) {
  const notification = document.getElementById(notificationId);
  if (notification) {
    notification.classList.add('hiding');
    setTimeout(() => {
      notification.remove();
      // If no more notifications, disable clicks
      if (notificationContainer.children.length === 0) {
        notificationContainer.style.pointerEvents = 'none';
      }
    }, 300);
  }
}

// Truncate long URLs for display
function truncateUrl(url) {
  if (url.length > 50) {
    return url.substring(0, 47) + '...';
  }
  return url;
}

// Make closeNotification available globally
window.closeNotification = closeNotification;
