// Overlay Window JavaScript - Displays scam notifications

console.log('🖼️ Overlay window loaded');

// ============================================================================
// WARNING BADGE SYSTEM - REMOVED (solid colored badges)
// Now using only the notification system below
// ============================================================================

// ============================================================================
// TOP-RIGHT DROPDOWN NOTIFICATIONS
// ============================================================================

const notificationContainer = document.getElementById('notification-container');
let notificationIdCounter = 0;

// Listen for scan results from main process
window.electronAPI.onScanResult((result) => {
  console.log('📬 Received scan result notification:', result);

  // Only show notifications for medium and high risk (40+)
  if (result.risk >= 40) {
    console.log('⚠️ Showing notification for medium/high risk URL');
    showNotification(result);
  } else {
    console.log('✅ Low risk URL, skipping notification');
  }
});

// Play sound effect based on risk level
function playSoundEffect(riskLevel) {
  // Create audio context for generating tones
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  if (riskLevel >= 70) {
    // High risk: Urgent alarm sound
    oscillator.frequency.value = 800;
    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } else if (riskLevel >= 40) {
    // Medium risk: Warning beep
    oscillator.frequency.value = 600;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } else {
    // Safe: Soft success sound
    oscillator.frequency.value = 400;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  }
}

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

  // Play sound effect
  playSoundEffect(result.risk);

  // Trigger confetti celebration for very safe URLs
  if (result.risk < 20) {
    triggerConfetti();
  }

  const notification = document.createElement('div');
  notification.id = notificationId;
  notification.className = `notification ${notificationType}`;

  // Add celebration animation for safe URLs
  if (result.risk < 40) {
    notification.classList.add('celebrate');
  }

  // Generate educational explanation based on risk level and reason
  const educational = getEducationalContent(result);

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
    ${educational ? `<div class="notification-educational">💡 ${educational}</div>` : ''}
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

// Trigger confetti celebration
function triggerConfetti() {
  const colors = ['#0a84ff', '#32d74b', '#ff9f0a', '#5ac8fa', '#bf5af2', '#ff453a'];
  const confettiCount = 40;

  for (let i = 0; i < confettiCount; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.style.position = 'fixed';
      confetti.style.width = '10px';
      confetti.style.height = '10px';
      confetti.style.borderRadius = '50%';
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.top = '0';
      confetti.style.zIndex = '100000';
      confetti.style.pointerEvents = 'none';

      const duration = Math.random() * 2 + 2;
      const delay = Math.random() * 0.5;
      confetti.style.animation = `confetti-fall ${duration}s ease-out ${delay}s forwards`;

      document.body.appendChild(confetti);

      // Remove after animation
      setTimeout(() => confetti.remove(), (duration + delay) * 1000 + 500);
    }, i * 50);
  }
}

// Truncate long URLs for display
function truncateUrl(url) {
  if (url.length > 50) {
    return url.substring(0, 47) + '...';
  }
  return url;
}

// Get educational content based on scan result
function getEducationalContent(result) {
  const reason = (result.reason || '').toLowerCase();

  // High risk educational messages
  if (result.risk >= 70) {
    if (reason.includes('phishing')) {
      return 'Phishing attempts mimic legitimate sites to steal your credentials. Always verify the URL domain before entering sensitive information.';
    }
    if (reason.includes('malicious') || reason.includes('malware')) {
      return 'This site may contain malicious code that can harm your device or steal data. Never download files from untrusted sources.';
    }
    if (reason.includes('domain') && reason.includes('days old')) {
      return 'Brand new domains are often used for scams. Legitimate companies typically use established domains.';
    }
    if (reason.includes('urlscan')) {
      return 'Multiple security engines flagged this site as dangerous. Trust the experts - avoid this URL.';
    }
    return 'This URL shows multiple warning signs of being a scam. When in doubt, verify independently before proceeding.';
  }

  // Medium risk educational messages
  if (result.risk >= 40) {
    if (reason.includes('domain age')) {
      return 'Young domains can be legitimate, but scammers often register new domains for their schemes.';
    }
    if (reason.includes('redirect')) {
      return 'Multiple redirects can hide the final destination. Legitimate sites rarely chain multiple redirects.';
    }
    if (reason.includes('suspicious')) {
      return 'Some indicators suggest caution. Verify the site\'s legitimacy through official channels before proceeding.';
    }
    return 'Exercise caution. Look for HTTPS, check the domain spelling, and verify through official sources.';
  }

  // Safe/low risk educational messages
  if (reason.includes('no issues')) {
    return 'No red flags detected, but always stay vigilant when sharing personal information online.';
  }

  return null; // No educational message for very low scores
}

// Make closeNotification available globally
window.closeNotification = closeNotification;
