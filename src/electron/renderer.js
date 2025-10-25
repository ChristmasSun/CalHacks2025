const dashboardRoot = document.getElementById('dashboard-root');
const dashboardStatus = document.getElementById('dashboard-status');
const connectGmailButton = document.getElementById('connect-gmail');
const hideDashboardButton = document.getElementById('hide-dashboard');
const gmailStatusText = document.getElementById('gmail-status-text');
const dashboardAccent = document.getElementById('dashboard-accent');
const gmailResultsNode = document.getElementById('gmail-results');
const refreshGmailButton = document.getElementById('refresh-gmail');
const gmailRefreshedNode = document.getElementById('gmail-refreshed');

const alertRoot = document.getElementById('alert-root');
const scoreNode = document.getElementById('alert-score');
const levelNode = document.getElementById('alert-level');
const summaryNode = document.getElementById('alert-summary');
const highlightsList = document.getElementById('alert-highlights');
const urlNode = document.getElementById('alert-url');
const timestampNode = document.getElementById('alert-timestamp');
const dismissButton = document.getElementById('dismiss-alert');
const alertAccent = document.getElementById('accent-pill');

const levelCopy = {
  high: 'Critical Scam Risk',
  medium: 'Elevated Scam Risk',
  low: 'Low Scam Risk'
};

const accentTone = {
  high: '#1d4ed8',
  medium: '#2563eb',
  low: '#0ea5e9'
};

const STATUS_DEFAULT = 'No scans yet. Hit the tray menu to try a sample URL.';
const STATUS_CONNECTED = 'Monitoring Gmail for suspicious links.';

let gmailConnected = false;
let gmailConnecting = false;
let gmailAccountEmail = null;
let gmailRefreshing = false;
let gmailSuspiciousList = [];
let gmailLastRefreshed = null;

function setDashboardStatus(message) {
  if (dashboardStatus) {
    dashboardStatus.textContent = message;
  }
}

function setDashboardVisible(isVisible) {
  if (!dashboardRoot) {
    return;
  }
  if (isVisible) {
    dashboardRoot.classList.remove('dashboard-hidden');
  } else {
    dashboardRoot.classList.add('dashboard-hidden');
  }
}

function setGmailRefreshing(isRefreshing) {
  gmailRefreshing = Boolean(isRefreshing);
  if (!refreshGmailButton) {
    return;
  }
  if (gmailRefreshing) {
    refreshGmailButton.textContent = 'Refreshing…';
    refreshGmailButton.setAttribute('disabled', 'true');
  } else {
    refreshGmailButton.textContent = 'Refresh';
    if (gmailConnected) {
      refreshGmailButton.removeAttribute('disabled');
    } else {
      refreshGmailButton.setAttribute('disabled', 'true');
    }
  }
}

function renderGmailMessages(messages = [], refreshedAt = null, error = null) {
  if (!gmailResultsNode) {
    return;
  }

  gmailSuspiciousList = Array.isArray(messages) ? messages : [];
  gmailLastRefreshed = refreshedAt;

  gmailResultsNode.innerHTML = '';

  if (error) {
    const errorNode = document.createElement('p');
    errorNode.className = 'empty-state';
    errorNode.textContent = error;
    gmailResultsNode.appendChild(errorNode);
  } else if (!gmailConnected) {
    const promptNode = document.createElement('p');
    promptNode.className = 'empty-state';
    promptNode.textContent = 'Connect Gmail to start scanning inbox.';
    gmailResultsNode.appendChild(promptNode);
  } else if (!gmailSuspiciousList.length) {
    const emptyNode = document.createElement('p');
    emptyNode.className = 'empty-state';
    emptyNode.textContent = 'No suspicious emails flagged in the latest scan.';
    gmailResultsNode.appendChild(emptyNode);
  } else {
    gmailSuspiciousList.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'gmail-item';

      const subject = document.createElement('h4');
      subject.textContent = item.subject || '(no subject)';
      card.appendChild(subject);

      const meta = document.createElement('div');
      meta.className = 'gmail-meta';
      const fromSpan = document.createElement('span');
      fromSpan.textContent = item.from || 'Unknown sender';
      const dateSpan = document.createElement('span');
      dateSpan.textContent = item.displayDate || '';
      meta.appendChild(fromSpan);
      meta.appendChild(dateSpan);
      card.appendChild(meta);

      if (item.snippet) {
        const snippet = document.createElement('p');
        snippet.className = 'gmail-snippet';
        const cleanSnippet = item.snippet.trim();
        snippet.textContent = cleanSnippet.length > 160 ? `${cleanSnippet.slice(0, 157)}…` : cleanSnippet;
        card.appendChild(snippet);
      }

      if (Array.isArray(item.reasons) && item.reasons.length) {
        const reasonsWrap = document.createElement('div');
        reasonsWrap.className = 'gmail-reasons';
        item.reasons.forEach((reason) => {
          const chip = document.createElement('span');
          chip.className = 'gmail-reason';
          chip.textContent = reason;
          reasonsWrap.appendChild(chip);
        });
        card.appendChild(reasonsWrap);
      }

      gmailResultsNode.appendChild(card);
    });
  }

  if (gmailRefreshedNode) {
    if (gmailConnected && refreshedAt) {
      const stamp = new Date(refreshedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      gmailRefreshedNode.textContent = `Updated ${stamp}`;
    } else {
      gmailRefreshedNode.textContent = '';
    }
  }
}

function formatTimestamp(isoDate) {
  try {
    return new Date(isoDate).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_error) {
    return '';
  }
}

function setHighlights(explanations) {
  highlightsList.innerHTML = '';
  const items = (explanations ?? []).slice(0, 3);
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = 'No additional signals reported.';
    highlightsList.appendChild(li);
    return;
  }

  items.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    highlightsList.appendChild(li);
  });
}

function applyAlertStyling(level) {
  const tone = accentTone[level] ?? accentTone.high;
  alertAccent.style.background = tone;
  alertAccent.style.boxShadow = `0 12px 35px ${tone}33`;
  alertRoot.style.borderColor = `${tone}33`;
}

function updateGmailUI(connected, email) {
  if (!connectGmailButton || !gmailStatusText) {
    return;
  }

  const previousState = gmailConnected;
  gmailConnected = Boolean(connected);
  gmailAccountEmail = gmailConnected ? email || gmailAccountEmail : null;

  if (gmailConnected) {
    gmailStatusText.textContent = gmailAccountEmail
      ? `Connected — ${gmailAccountEmail}`
      : 'Connected';
    connectGmailButton.textContent = 'Connected';
    connectGmailButton.setAttribute('disabled', 'true');
    connectGmailButton.classList.add('connected');
    if (!gmailRefreshing) {
      refreshGmailButton?.removeAttribute('disabled');
    }
    if (previousState !== gmailConnected) {
      setDashboardStatus(STATUS_CONNECTED);
      renderGmailMessages(gmailSuspiciousList, gmailLastRefreshed, null);
    }
  } else {
    gmailStatusText.textContent = 'Not connected';
    connectGmailButton.textContent = 'Connect Gmail';
    connectGmailButton.removeAttribute('disabled');
    connectGmailButton.classList.remove('connected');
    refreshGmailButton?.setAttribute('disabled', 'true');
    renderGmailMessages([], null, 'Connect Gmail to start scanning inbox.');
    if (previousState !== gmailConnected) {
      setDashboardStatus(STATUS_DEFAULT);
    }
  }

  if (dashboardAccent) {
    dashboardAccent.style.background = gmailConnected
      ? 'rgba(14, 165, 233, 0.55)'
      : 'rgba(37, 99, 235, 0.5)';
  }
}

async function handleGmailConnect() {
  if (
    gmailConnected ||
    gmailConnecting ||
    !window.scamShield?.connectGmail ||
    !connectGmailButton
  ) {
    return;
  }

  gmailConnecting = true;
  connectGmailButton.setAttribute('disabled', 'true');
  connectGmailButton.textContent = 'Connecting…';
  setDashboardStatus('Authorizing secure access to Gmail…');

  try {
    const result = await window.scamShield.connectGmail();
    if (result?.connected) {
      updateGmailUI(true, result.email);
      if (result?.error) {
        setDashboardStatus(`Gmail error: ${result.error}`);
        renderGmailMessages(result?.messages ?? gmailSuspiciousList, result?.refreshedAt ?? gmailLastRefreshed, result.error);
      } else {
        setDashboardStatus(STATUS_CONNECTED);
        renderGmailMessages(result?.messages ?? gmailSuspiciousList, result?.refreshedAt ?? gmailLastRefreshed, null);
      }
    } else {
      const msg = result?.error
        ? `Connection failed: ${result.error}`
        : 'Could not connect to Gmail. Try again shortly.';
      setDashboardStatus(msg);
      connectGmailButton.removeAttribute('disabled');
      connectGmailButton.textContent = 'Connect Gmail';
      connectGmailButton.classList.remove('connected');
    }
  } catch (error) {
    setDashboardStatus(`Connection failed: ${error.message}`);
    connectGmailButton.removeAttribute('disabled');
    connectGmailButton.textContent = 'Connect Gmail';
    connectGmailButton.classList.remove('connected');
    renderGmailMessages(gmailSuspiciousList, gmailLastRefreshed, error.message);
  } finally {
    gmailConnecting = false;
  }
}

async function handleGmailRefresh() {
  if (!gmailConnected || gmailRefreshing || !window.scamShield?.refreshGmail) {
    return;
  }

  setGmailRefreshing(true);
  setDashboardStatus('Refreshing Gmail inbox…');

  try {
    const result = await window.scamShield.refreshGmail();
    if (result?.error) {
      renderGmailMessages(result.messages || gmailSuspiciousList, result.refreshedAt || gmailLastRefreshed, result.error);
      setDashboardStatus(`Refresh failed: ${result.error}`);
    } else {
      renderGmailMessages(result?.messages || gmailSuspiciousList, result?.refreshedAt || gmailLastRefreshed, null);
      setDashboardStatus(STATUS_CONNECTED);
    }
  } catch (error) {
    renderGmailMessages(gmailSuspiciousList, gmailLastRefreshed, error.message);
    setDashboardStatus(`Refresh failed: ${error.message}`);
  } finally {
    setGmailRefreshing(false);
  }
}

function showAlert(payload) {
  const assessment = payload?.assessment;
  if (!assessment) {
    return;
  }

  setDashboardVisible(false);

  const level = assessment.risk_level ?? 'high';
  applyAlertStyling(level);

  scoreNode.textContent = `${assessment.risk_score ?? 0}%`;
  levelNode.textContent = levelCopy[level] ?? levelCopy.high;
  summaryNode.textContent =
    assessment.summary ??
    'Suspicious activity spotted. Review the signals below before proceeding.';
  urlNode.textContent = assessment.url ?? 'Unknown source';
  urlNode.setAttribute('title', assessment.url ?? 'Unknown source');
  const detectedAt = formatTimestamp(assessment.generatedAt);
  timestampNode.textContent = detectedAt ? `Detected ${detectedAt}` : '';

  setHighlights(assessment.explanations);

  alertRoot.classList.remove('alert-visible');
  alertRoot.classList.remove('alert-hidden');
  void alertRoot.offsetWidth;
  alertRoot.classList.remove('alert-hidden');
  alertRoot.classList.add('alert-visible');
}

function hideAlert() {
  alertRoot.classList.remove('alert-visible');
  alertRoot.classList.add('alert-hidden');
}

function showDashboard(payload) {
  const connected = payload?.connected ?? gmailConnected;
  const email = payload?.email ?? gmailAccountEmail;
  updateGmailUI(connected, email);
  setDashboardVisible(true);
  if (payload?.error) {
    setDashboardStatus(`Gmail error: ${payload.error}`);
  } else {
    setDashboardStatus(connected ? STATUS_CONNECTED : STATUS_DEFAULT);
  }
  renderGmailMessages(payload?.messages ?? gmailSuspiciousList, payload?.refreshedAt ?? gmailLastRefreshed, payload?.error || null);
  hideAlert();
}

dismissButton?.addEventListener('click', () => {
  hideAlert();
  window.scamShield?.dismissAlert();
});

alertRoot?.addEventListener('mouseenter', () => {
  alertRoot.classList.add('alert-hover');
});

alertRoot?.addEventListener('mouseleave', () => {
  alertRoot.classList.remove('alert-hover');
});

connectGmailButton?.addEventListener('click', handleGmailConnect);

refreshGmailButton?.addEventListener('click', handleGmailRefresh);

hideDashboardButton?.addEventListener('click', async () => {
  setDashboardVisible(false);
  hideAlert();
  try {
    await window.scamShield?.hideDashboard();
  } catch (_error) {
    // no-op
  }
});

if (window.scamShield?.onAlert) {
  window.scamShield.onAlert((payload) => {
    showAlert(payload);
  });
}

if (window.scamShield?.onBootstrap) {
  window.scamShield.onBootstrap((payload) => {
    const connected = payload?.gmailConnected ?? payload?.connected;
    updateGmailUI(connected, payload?.email);
    setDashboardVisible(true);
    const statusMessage = payload?.error
      ? `Gmail error: ${payload.error}`
      : connected
      ? STATUS_CONNECTED
      : STATUS_DEFAULT;
    setDashboardStatus(statusMessage);
    renderGmailMessages(payload?.messages ?? gmailSuspiciousList, payload?.refreshedAt ?? gmailLastRefreshed, payload?.error || null);
  });
}

if (window.scamShield?.onGmailStatus) {
  window.scamShield.onGmailStatus((payload) => {
    updateGmailUI(payload?.connected, payload?.email);
    setGmailRefreshing(false);
    if (payload?.error) {
      setDashboardStatus(`Gmail error: ${payload.error}`);
    } else if (payload?.connected) {
      setDashboardStatus(STATUS_CONNECTED);
    }
    renderGmailMessages(payload?.messages ?? gmailSuspiciousList, payload?.refreshedAt ?? gmailLastRefreshed, payload?.error || null);
    if (payload?.error && !gmailConnected) {
      refreshGmailButton?.setAttribute('disabled', 'true');
    }
  });
}

if (window.scamShield?.onShowDashboard) {
  window.scamShield.onShowDashboard((payload) => {
    showDashboard(payload);
  });
}

if (window.scamShield?.onAnalysisComplete) {
  window.scamShield.onAnalysisComplete(({ assessment }) => {
    if (!assessment) {
      return;
    }
    const level = (assessment.risk_level ?? 'unknown').toUpperCase();
    const score = typeof assessment.risk_score === 'number' ? assessment.risk_score : '—';
    setDashboardStatus(`Last scan: ${score}% (${level}).`);
  });
}

// Set initial dashboard messaging
setDashboardStatus(STATUS_DEFAULT);
renderGmailMessages([], null, 'Connect Gmail to start scanning inbox.');
setGmailRefreshing(false);

// ========================================
// Text Analysis / Contact Verification
// ========================================

const textAnalysisInput = document.getElementById('text-analysis-input');
const textAnalysisButton = document.getElementById('analyze-text-button');
const textAnalysisResults = document.getElementById('text-analysis-results');

let textAnalyzing = false;

function renderTextAnalysisResults(result) {
  if (!textAnalysisResults) {
    return;
  }

  if (!result || !result.success) {
    textAnalysisResults.innerHTML = '<p class="empty-state" style="color: #dc2626;">Analysis failed. Please try again.</p>';
    return;
  }

  const { contact, verification } = result;

  // Build results HTML
  let html = '';

  // Contact Info Section
  html += '<div style="background: rgba(255, 255, 255, 0.9); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 12px; padding: 12px; margin-bottom: 12px;">';
  html += '<h4 style="margin: 0 0 8px; font-size: 0.85rem; color: #0f172a;">Extracted Contact Info</h4>';

  if (contact.name) {
    html += `<p style="margin: 4px 0; font-size: 0.78rem; color: rgba(15, 23, 42, 0.68);"><strong>Name:</strong> ${contact.name}</p>`;
  }
  if (contact.email) {
    html += `<p style="margin: 4px 0; font-size: 0.78rem; color: rgba(15, 23, 42, 0.68);"><strong>Email:</strong> ${contact.email}</p>`;
  }
  if (contact.company) {
    html += `<p style="margin: 4px 0; font-size: 0.78rem; color: rgba(15, 23, 42, 0.68);"><strong>Company:</strong> ${contact.company}</p>`;
  }
  if (contact.title) {
    html += `<p style="margin: 4px 0; font-size: 0.78rem; color: rgba(15, 23, 42, 0.68);"><strong>Title:</strong> ${contact.title}</p>`;
  }
  if (contact.phone) {
    html += `<p style="margin: 4px 0; font-size: 0.78rem; color: rgba(15, 23, 42, 0.68);"><strong>Phone:</strong> ${contact.phone}</p>`;
  }

  html += '</div>';

  // Verification Results Section
  const riskLevel = verification.riskLevel || 'low';
  const riskColor = riskLevel === 'high' ? '#dc2626' : riskLevel === 'medium' ? '#ea580c' : '#16a34a';
  const riskLabel = riskLevel === 'high' ? 'HIGH RISK' : riskLevel === 'medium' ? 'MEDIUM RISK' : 'LOW RISK';
  const verifiedIcon = verification.verified ? '✓' : '⚠️';

  html += '<div style="background: rgba(255, 255, 255, 0.9); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 12px; padding: 12px;">';
  html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">';
  html += '<h4 style="margin: 0; font-size: 0.85rem; color: #0f172a;">Verification Results</h4>';
  html += `<span style="font-size: 0.72rem; font-weight: 600; color: ${riskColor}; letter-spacing: 0.08em;">${riskLabel}</span>`;
  html += '</div>';

  // Status
  html += `<p style="margin: 0 0 8px; font-size: 0.82rem; color: ${verification.verified ? '#16a34a' : '#ea580c'};">`;
  html += `<strong>${verifiedIcon} ${verification.verified ? 'Verified' : 'Not Verified'}</strong>`;
  html += `</p>`;

  if (verification.confidence > 0) {
    html += `<p style="margin: 4px 0; font-size: 0.78rem; color: rgba(15, 23, 42, 0.68);">Confidence: ${verification.confidence}%</p>`;
  }

  if (verification.riskScore > 0) {
    html += `<p style="margin: 4px 0; font-size: 0.78rem; color: rgba(15, 23, 42, 0.68);">Risk Score: ${verification.riskScore}/100</p>`;
  }

  // Matches
  if (verification.matches && verification.matches.length > 0) {
    html += '<div style="margin-top: 10px;">';
    html += '<p style="margin: 0 0 6px; font-size: 0.76rem; font-weight: 600; color: #16a34a;">✓ Positive Indicators:</p>';
    verification.matches.forEach(match => {
      html += `<p style="margin: 2px 0; font-size: 0.74rem; color: rgba(15, 23, 42, 0.68);">• ${match}</p>`;
    });
    html += '</div>';
  }

  // Warnings
  if (verification.warnings && verification.warnings.length > 0) {
    html += '<div style="margin-top: 10px;">';
    html += '<p style="margin: 0 0 6px; font-size: 0.76rem; font-weight: 600; color: #dc2626;">⚠️ Warnings:</p>';
    verification.warnings.forEach(warning => {
      html += `<p style="margin: 2px 0; font-size: 0.74rem; color: rgba(15, 23, 42, 0.68);">• ${warning}</p>`;
    });
    html += '</div>';
  }

  html += '</div>';

  textAnalysisResults.innerHTML = html;
}

async function handleTextAnalysis() {
  if (!textAnalysisInput || !window.scamShield?.analyzeText) {
    return;
  }

  const text = textAnalysisInput.value.trim();

  if (!text) {
    textAnalysisResults.innerHTML = '<p class="empty-state" style="color: #ea580c;">Please paste some text to analyze.</p>';
    return;
  }

  textAnalyzing = true;
  textAnalysisButton.textContent = 'Analyzing...';
  textAnalysisButton.setAttribute('disabled', 'true');
  textAnalysisResults.innerHTML = '<p class="empty-state">Analyzing contact information...</p>';

  try {
    const result = await window.scamShield.analyzeText(text);
    renderTextAnalysisResults(result);
  } catch (error) {
    console.error('[Renderer] Text analysis failed:', error);
    textAnalysisResults.innerHTML = `<p class="empty-state" style="color: #dc2626;">Error: ${error.message}</p>`;
  } finally {
    textAnalyzing = false;
    textAnalysisButton.textContent = 'Verify Contact';
    textAnalysisButton.removeAttribute('disabled');
  }
}

textAnalysisButton?.addEventListener('click', handleTextAnalysis);
