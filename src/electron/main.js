// Detectify Scam Detector - Main Process (MERGED: Avani's UI + Ved's Backend)
// Real-time scam detection with URLScan.io, Gmail monitoring, and clipboard/window tracking

// CRITICAL: Load Electron FIRST before any other modules (including dotenv)
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, desktopCapturer, globalShortcut, Notification } = require('electron');

// Now load other modules
require('dotenv').config();

const path = require('path');
const fs = require('fs/promises');
const http = require('http');
const { google } = require('googleapis');
const { LRUCache } = require('lru-cache');

// Ved's backend components
const { enrichWithScrapedMetadata } = require('../core/scraper');
const { scoreRisk } = require('../core/scorer');
const { ClipboardMonitor } = require('../core/clipboard-monitor');
const { ScreenOCRMonitor } = require('../core/screen-ocr-monitor');
const { RekaScreenMonitor } = require('../core/reka-screen-monitor');
const { URLFilter } = require('../core/url-filter');
const { scanQueue } = require('../core/scan-queue');
const { scanScreenshotForURLs } = require('../core/screen-ocr');
const { ScanHistory } = require('../core/scan-history');
const { demoMode } = require('../core/demo-mode');
const { queryFetchAgent } = require('../infra/fetchAgent');
const { transcribeAudio } = require('../infra/deepgram');
const { emailVerifier } = require('../infra/email-verifier');
const { personVerifier } = require('../infra/person-verifier');
const activeWin = require('active-win');

process.on('unhandledRejection', (reason) => {
  console.error('[ScamShield] Unhandled promise rejection:', reason);
});

// ============================================================================
// GLOBAL STATE
// ============================================================================

// Avani's UI windows
let controlWindow; // Control panel window
let overlayWindow; // Transparent overlay for warnings
let isMonitoring = false;
let monitoringInterval = null;

// Ved's backend state
let tray;
let gmailConnected = false;
let gmailTokenPath;
let gmailTokens = null;
let gmailProfile = null;
let gmailSuspiciousMessages = [];
let gmailLastRefreshedAt = null;
let gmailOAuthClient = null;

// Auto-scanning components
let clipboardMonitor;
let screenOCRMonitor;
let rekaScreenMonitor = null; // Initialize immediately
let activeWindowMonitorInterval;
let scanHistory;
const urlFilter = new URLFilter();
const scanCache = new LRUCache({
  max: 500, // Cache up to 500 scanned URLs
  ttl: 1000 * 60 * 60 // 1 hour TTL
});

// Load user whitelist/blacklist rules
urlFilter.loadUserRules();

// Track last seen URL to avoid duplicate scans
let lastActiveWindowUrl = null;

// Settings from renderer process
let appSettings = {
  gmailScan: true, // Default to enabled
  urlScan: true,
  sound: true,
  notifications: true,
  educational: true
};

// Gmail constants
const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const GMAIL_SUSPICIOUS_KEYWORDS = [
  'verify your account',
  'urgent action required',
  'reset your password',
  'confirm your identity',
  'wire transfer',
  'payment required',
  'bitcoin',
  'gift card',
  'suspend(ed) account',
  'login from new device',
  'tax refund',
  'banking alert',
  'invoice attached'
];

const GMAIL_URGENT_PHRASES = [
  'act now',
  'immediate attention',
  'final notice',
  'avoid penalties',
  'legal action',
  'security alert'
];

const GMAIL_SUSPICIOUS_TLDS = ['.ru', '.cn', '.zip', '.xyz', '.top', '.loan', '.click', '.lol'];

// ============================================================================
// WINDOW CREATION (Avani's UI)
// ============================================================================

// Create the control panel window
function createControlWindow() {
  // Get screen dimensions to center the window
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const windowWidth = 600;
  const windowHeight = 550;

  controlWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 500,
    minHeight: 450,
    x: Math.floor((screenWidth - windowWidth) / 2),
    y: Math.floor((screenHeight - windowHeight) / 2),
    alwaysOnTop: false, // Don't stay on top for better UX
    resizable: true,
    transparent: true, // Enable transparency for elegant glass effect
    backgroundColor: '#00000000', // Transparent background
    hasShadow: true,
    frame: false, // Frameless for custom design
    titleBarStyle: 'customButtonsOnHover', // Hide traffic lights until hover
    titleBarOverlay: false,
    roundedCorners: true, // macOS: rounded corners
    vibrancy: 'under-window', // macOS glass effect
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  controlWindow.loadFile(path.join(__dirname, 'control.html'));

  // Open DevTools for debugging
  controlWindow.webContents.openDevTools({ mode: 'detach' });

  controlWindow.on('closed', () => {
    controlWindow = null;
    if (overlayWindow) {
      overlayWindow.close();
    }
  });
}

// Create transparent overlay window for warnings
function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Start as click-through
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // Listen for requests to enable/disable mouse events
  ipcMain.on('set-overlay-clickable', (event, clickable) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setIgnoreMouseEvents(!clickable, { forward: true });
    }
  });

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

  // Open DevTools for debugging
  // overlayWindow.webContents.openDevTools({ mode: 'detach' });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// ============================================================================
// GMAIL OAUTH & API INTEGRATION (Ved's Backend)
// ============================================================================

function attachTokenListener(oauthClient, redirectUri) {
  if (!oauthClient) {
    return;
  }
  oauthClient.removeAllListeners('tokens');
  oauthClient.on('tokens', (tokens) => {
    gmailTokens = {
      ...(gmailTokens || {}),
      ...tokens,
      redirectUri
    };
    persistGmailTokens(gmailTokens, redirectUri).catch((error) => {
      console.warn('[ScamShield] Failed to persist refreshed Gmail tokens:', error.message);
    });
  });
}

function buildGmailStatusPayload(extra = {}) {
  return {
    connected: gmailConnected,
    email: gmailProfile?.email || null,
    messages: gmailSuspiciousMessages,
    refreshedAt: gmailLastRefreshedAt,
    ...extra
  };
}

function emitGmailStatus(extra = {}) {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('gmail-status', buildGmailStatusPayload(extra));
  }
}

async function getActiveOAuthClient() {
  if (gmailOAuthClient) {
    return gmailOAuthClient;
  }
  if (!gmailTokens?.refresh_token) {
    return null;
  }
  const redirectUri = gmailTokens.redirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1';
  const client = createOAuthClient(redirectUri);
  client.setCredentials(gmailTokens);
  attachTokenListener(client, redirectUri);
  gmailOAuthClient = client;
  return client;
}

function extractHeader(headers = [], name) {
  const header = headers.find((entry) => entry.name?.toLowerCase() === name.toLowerCase());
  return header?.value || null;
}

function parseEmailAddress(raw = '') {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

async function evaluateMessageRisk({ subject, snippet, fromAddress }) {
  const reasons = [];
  const subjectLower = (subject || '').toLowerCase();
  const snippetLower = (snippet || '').toLowerCase();
  const email = parseEmailAddress(fromAddress || '');

  // Email Authenticity Verification
  try {
    const verification = await emailVerifier.verifyEmail({
      from: fromAddress,
      subject: subject || '',
      body: snippet || ''
    });

    // Add email verification warnings (these are HIGH priority)
    if (!verification.legitimate) {
      verification.warnings.forEach(warning => reasons.push(warning));
    }

    // Log verification results
    console.log(`[Gmail] Email verification for ${fromAddress}: ${verification.riskLevel} risk (${verification.riskScore}/100)`);
  } catch (error) {
    console.warn('[Gmail] Email verification failed:', error.message);
  }

  // Legacy keyword and pattern matching
  GMAIL_SUSPICIOUS_KEYWORDS.forEach((keyword) => {
    if (subjectLower.includes(keyword) || snippetLower.includes(keyword)) {
      reasons.push(`Keyword: ${keyword}`);
    }
  });

  GMAIL_URGENT_PHRASES.forEach((phrase) => {
    if (subjectLower.includes(phrase) || snippetLower.includes(phrase)) {
      reasons.push(`Urgency: ${phrase}`);
    }
  });

  if (email) {
    const domain = email.split('@')[1] || '';
    GMAIL_SUSPICIOUS_TLDS.forEach((tld) => {
      if (domain.endsWith(tld)) {
        reasons.push(`Suspicious domain (${tld})`);
      }
    });
  }

  if (!reasons.length && snippetLower.includes('http')) {
    reasons.push('Contains external link');
  }

  return Array.from(new Set(reasons));
}

async function refreshGmailData(oauthClient) {
  if (!gmailConnected) {
    gmailSuspiciousMessages = [];
    const payload = buildGmailStatusPayload({ error: 'Gmail not connected.' });
    emitGmailStatus({ error: 'Gmail not connected.' });
    return payload;
  }

  // Check if Gmail scanning is enabled in settings
  if (!appSettings.gmailScan) {
    console.log('[Gmail] Gmail scanning disabled in settings - skipping');
    gmailSuspiciousMessages = [];
    const payload = buildGmailStatusPayload();
    emitGmailStatus();
    return payload;
  }

  try {
    const client = oauthClient || (await getActiveOAuthClient());
    if (!client) {
      throw new Error('Missing Gmail session credentials. Please reconnect.');
    }

    gmailOAuthClient = client;

    const gmail = google.gmail({ version: 'v1', auth: client });

    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      q: 'newer_than:14d'
    });

    const messageRefs = listResponse.data.messages || [];
    const suspicious = [];

    for (const ref of messageRefs) {
      if (suspicious.length >= 5) {
        break;
      }
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: ref.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date']
        });

        const headers = detail.data.payload?.headers || [];
        const subject = extractHeader(headers, 'Subject') || '(no subject)';
        const fromValue = extractHeader(headers, 'From') || 'Unknown sender';
        const dateValue = extractHeader(headers, 'Date') || null;
        const snippet = detail.data.snippet || '';

        const reasons = await evaluateMessageRisk({
          subject,
          snippet,
          fromAddress: fromValue
        });

        // Add to scan history
        if (scanHistory && typeof scanHistory.add === 'function') {
          try {
            const riskScore = reasons.length > 0 ? Math.min(reasons.length * 20, 100) : 0;
            await scanHistory.add({
              timestamp: Date.now(),
              source: 'gmail',
              url: `email:${ref.id}`,
              riskScore: riskScore,
              riskLevel: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
              reason: reasons.length > 0 ? reasons.join(', ') : 'No threats detected',
              from: fromValue,
              subject: subject
            });
          } catch (error) {
            console.error('[Gmail] Failed to add email to scan history:', error.message);
          }
        }

        if (reasons.length) {
          const parsedDate = dateValue ? new Date(dateValue) : null;
          suspicious.push({
            id: ref.id,
            subject,
            from: fromValue,
            snippet,
            date: dateValue,
            displayDate: parsedDate ? parsedDate.toLocaleString() : 'Unknown',
            reasons
          });
        }
      } catch (error) {
        console.warn('[ScamShield] Failed to inspect Gmail message:', error.message);
      }
    }

    gmailSuspiciousMessages = suspicious;
    gmailLastRefreshedAt = new Date().toISOString();

    const payload = buildGmailStatusPayload();
    emitGmailStatus();
    return payload;
  } catch (error) {
    console.error('[ScamShield] Gmail refresh failed:', error.message);
    const payload = buildGmailStatusPayload({ error: error.message });
    emitGmailStatus({ error: error.message });
    return payload;
  }
}

function assertGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Please add them to your environment or .env file.'
    );
  }

  return { clientId, clientSecret };
}

function createOAuthClient(redirectUri) {
  const { clientId, clientSecret } = assertGoogleCredentials();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function fetchGmailProfile(oauthClient) {
  const gmail = google.gmail({ version: 'v1', auth: oauthClient });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return {
    email: profile.data?.emailAddress || null,
    messageTotal: profile.data?.messagesTotal || 0
  };
}

async function persistGmailTokens(tokens, redirectUri) {
  if (!gmailTokenPath) {
    throw new Error('Gmail token path is not initialized.');
  }

  const payload = {
    ...tokens,
    redirectUri,
    storedAt: new Date().toISOString()
  };

  await fs.writeFile(gmailTokenPath, JSON.stringify(payload, null, 2), 'utf8');
}

async function restoreGmailSession() {
  if (!gmailTokenPath) {
    return false;
  }

  try {
    const raw = await fs.readFile(gmailTokenPath, 'utf8');
    const stored = JSON.parse(raw);
    if (!stored?.refresh_token) {
      return false;
    }

    const redirectUri = stored.redirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1';
    const oauthClient = createOAuthClient(redirectUri);
    oauthClient.setCredentials(stored);
    attachTokenListener(oauthClient, redirectUri);

    gmailTokens = { ...stored, redirectUri };
    gmailOAuthClient = oauthClient;

    const profile = await fetchGmailProfile(oauthClient);
    gmailProfile = profile;
    gmailConnected = true;

    await refreshGmailData(oauthClient);
    return true;
  } catch (error) {
    console.warn('[ScamShield] Failed to restore Gmail session:', error.message);
    return false;
  }
}

async function startGmailOAuthFlow() {
  let authWindow;
  let server;

  const redirectUri = await new Promise((resolve, reject) => {
    server = http.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine OAuth callback address.'));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}/oauth2callback`);
    });
  });

  const oauthClient = createOAuthClient(redirectUri);
  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES
  });

  let authResult;
  try {
    authResult = await new Promise((resolve, reject) => {
      let handled = false;

      server.on('request', async (req, res) => {
        if (!req.url) {
          res.writeHead(400).end();
          return;
        }

        if (!req.url.startsWith('/oauth2callback')) {
          res.writeHead(404).end();
          return;
        }

        const urlObj = new URL(req.url, redirectUri);
        const errorParam = urlObj.searchParams.get('error');
        const code = urlObj.searchParams.get('code');

        if (errorParam) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Gmail authorization was denied. You can close this window.');
          if (!handled) {
            handled = true;
            reject(new Error('Gmail OAuth was denied by the user.'));
          }
          return;
        }

        if (!code) {
          res.writeHead(400).end();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!doctype html>
          <html>
            <head><title>Gmail Connected</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 40px;">
              <h1>Gmail Connected!</h1>
              <p>You can close this window and return to Scam Shield.</p>
            </body>
          </html>
        `);

        if (!handled) {
          handled = true;
          resolve(code);
        }
      });

      authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      authWindow.loadURL(authUrl);

      authWindow.on('closed', () => {
        authWindow = null;
        if (!handled) {
          handled = true;
          reject(new Error('Gmail OAuth window closed by user.'));
        }
      });
    });
  } finally {
    if (server) {
      server.close();
    }
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.close();
    }
  }

  const { tokens } = await oauthClient.getToken(authResult);
  oauthClient.setCredentials(tokens);
  attachTokenListener(oauthClient, redirectUri);

  const profile = await fetchGmailProfile(oauthClient);

  gmailTokens = { ...tokens, redirectUri };
  gmailProfile = profile;
  gmailConnected = true;
  gmailOAuthClient = oauthClient;

  await persistGmailTokens(gmailTokens, redirectUri);
  await refreshGmailData(oauthClient);

  return buildGmailStatusPayload();
}

// ============================================================================
// CORE ANALYSIS ENGINE (Ved's Backend)
// ============================================================================

async function orchestrateAnalysis({ url, audioFile, autoDetected = false } = {}) {
  if (!url && !audioFile) {
    throw new Error('Supply a URL, an audio file, or both for analysis.');
  }

  console.log(`[ScamShield] Starting analysis for ${url || audioFile} (auto: ${autoDetected})`);

  // Use queue for URLScan.io to handle rate limiting
  let sandboxMetadata = null;
  if (url) {
    console.log(`[ScamShield] Queueing URL scan (${scanQueue.getQueueLength()} in queue)`);
    try {
      sandboxMetadata = await scanQueue.enqueue(url);
    } catch (error) {
      console.error('[ScamShield] URLScan.io failed:', error.message);
      // Continue with other analyses even if URLScan fails
    }
  }

  // Get other analysis results
  const infraResult = {
    url,
    sandboxMetadata,
    agentFindings: url ? await queryFetchAgent({ url }) : null,
    transcript: audioFile ? await transcribeAudio({ filePath: audioFile }) : null
  };

  const enriched = await enrichWithScrapedMetadata(infraResult);
  const assessment = scoreRisk(enriched);

  const payload = {
    assessment,
    rawSignals: assessment.rawSignals,
    autoDetected
  };

  // Send results to control window AND overlay window (for top-right notifications)
  const scanResult = {
    risk: assessment.risk_score || 0,
    reason: assessment.summary || 'Analysis complete',
    url: url || audioFile,
    source: autoDetected?.source || 'manual',
    blocked: assessment.risk_score >= 70
  };

  // Add to scan history
  if (scanHistory) {
    await scanHistory.addScan(scanResult);
  }

  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('scan-result', scanResult);
  }

  // Also send to overlay for top-right dropdown notifications
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('scan-result', scanResult);
  }

  // Show alert on overlay if high risk
  if (assessment.risk_score >= 70 && overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('show-warning', {
      risk: assessment.risk_score,
      reason: assessment.summary,
      analysis: {
        signals: assessment.rawSignals || [],
        recommendations: assessment.recommendations || []
      },
      timestamp: Date.now()
    });
  }

  return assessment;
}

// ============================================================================
// MONITORING CONTROL (Avani's UI + Ved's Backend)
// ============================================================================

// IPC Handler: Start monitoring
ipcMain.handle('start-monitoring', async () => {
  console.log('🚀 Start monitoring requested');

  if (isMonitoring) {
    console.log('⚠️ Already monitoring');
    return { success: false, message: 'Already monitoring' };
  }

  isMonitoring = true;

  // Create overlay window if it doesn't exist
  if (!overlayWindow) {
    createOverlayWindow();
  }

  // Start clipboard monitoring
  if (clipboardMonitor) {
    clipboardMonitor.start();
    console.log('[ScamShield] Clipboard monitoring started');
  }

  // Start active window monitoring
  if (!activeWindowMonitorInterval) {
    activeWindowMonitorInterval = setInterval(checkActiveWindow, 3000);
    console.log('[ScamShield] Active window monitoring started');
  }

  console.log('✅ Monitoring started');
  return { success: true, message: 'Monitoring started' };
});

// IPC Handler: Hide dashboard after onboarding
ipcMain.handle('hide-dashboard', async () => {
  console.log('🙈 Hide dashboard requested (onboarding complete)');
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.hide();
    return { success: true };
  }
  return { success: false };
});

// IPC Handler: Start Reka AI monitoring
ipcMain.handle('start-reka-monitor', async () => {
  console.log('🤖 Start Reka AI monitor requested');

  // Wait for monitor to be initialized (max 5 seconds)
  for (let i = 0; i < 50; i++) {
    if (rekaScreenMonitor) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (rekaScreenMonitor) {
    try {
      const result = await rekaScreenMonitor.start();
      if (result.success) {
        console.log('✅ Reka AI monitoring started');
        return { success: true };
      } else {
        console.warn('⚠️ Reka AI start failed:', result.reason);
        return { success: false, reason: result.reason };
      }
    } catch (error) {
      console.error('❌ Failed to start Reka AI:', error);
      return { success: false, reason: error.message };
    }
  }
  console.error('❌ Reka monitor not initialized after 5 seconds');
  return { success: false, reason: 'Monitor not initialized' };
});

// IPC Handler: Stop Reka AI monitoring
ipcMain.handle('stop-reka-monitor', async () => {
  console.log('🛑 Stop Reka AI monitor requested');
  if (rekaScreenMonitor) {
    try {
      rekaScreenMonitor.stop();
      console.log('✅ Reka AI monitoring stopped');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to stop Reka AI:', error);
      return { success: false, reason: error.message };
    }
  }
  return { success: false, reason: 'Monitor not initialized' };
});

// IPC Handler: Set Reka AI scan interval
ipcMain.handle('set-reka-scan-interval', async (event, interval) => {
  console.log('⏱️ Set Reka AI scan interval:', interval);
  if (rekaScreenMonitor) {
    try {
      rekaScreenMonitor.setScanInterval(interval);
      console.log('✅ Reka AI scan interval updated');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to set scan interval:', error);
      return { success: false, reason: error.message };
    }
  }
  return { success: false, reason: 'Monitor not initialized' };
});

// IPC Handler: Enable Screen OCR monitoring
ipcMain.handle('enable-screen-ocr', async () => {
  console.log('🔍 Enable Screen OCR monitor requested');
  if (screenOCRMonitor) {
    try {
      await screenOCRMonitor.start();
      console.log('✅ Screen OCR monitoring enabled');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to enable Screen OCR:', error);
      return { success: false, reason: error.message };
    }
  }
  return { success: false, reason: 'Monitor not initialized' };
});

// IPC Handler: Disable Screen OCR monitoring
ipcMain.handle('disable-screen-ocr', async () => {
  console.log('🛑 Disable Screen OCR monitor requested');
  if (screenOCRMonitor) {
    try {
      await screenOCRMonitor.stop();
      console.log('✅ Screen OCR monitoring disabled');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to disable Screen OCR:', error);
      return { success: false, reason: error.message };
    }
  }
  return { success: false, reason: 'Monitor not initialized' };
});

// IPC Handler: Get settings
ipcMain.handle('get-settings', async () => {
  return appSettings;
});

// IPC Handler: Update settings
ipcMain.handle('update-settings', async (event, newSettings) => {
  appSettings = { ...appSettings, ...newSettings };
  console.log('[ScamShield] Settings updated:', appSettings);
  return { success: true };
});

// IPC Handler: Stop monitoring
ipcMain.handle('stop-monitoring', async () => {
  console.log('🛑 Stop monitoring requested');

  if (!isMonitoring) {
    return { success: true, message: 'Already stopped' };
  }

  isMonitoring = false;

  // Stop clipboard monitoring
  if (clipboardMonitor) {
    clipboardMonitor.stop();
    console.log('[ScamShield] Clipboard monitoring stopped');
  }

  // Stop screen OCR monitoring
  if (screenOCRMonitor) {
    await screenOCRMonitor.stop();
    console.log('[ScamShield] Screen OCR monitoring stopped');
  }

  // Stop Reka AI monitoring
  if (rekaScreenMonitor) {
    rekaScreenMonitor.stop();
    console.log('[ScamShield] Reka AI monitoring stopped');
  }

  // Stop active window monitoring
  if (activeWindowMonitorInterval) {
    clearInterval(activeWindowMonitorInterval);
    activeWindowMonitorInterval = null;
    console.log('[ScamShield] Active window monitoring stopped');
  }

  // Clear overlay warnings
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('clear-warnings');
  }

  console.log('✅ Monitoring stopped');
  return { success: true, message: 'Monitoring stopped' };
});

// IPC Handler: Manual scan trigger
ipcMain.handle('manual-scan', async () => {
  try {
    // Trigger a sample analysis for demo
    const demoUrl = 'https://example.com';
    await orchestrateAnalysis({ url: demoUrl });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// ACTIVE WINDOW MONITORING (Ved's Backend)
// ============================================================================

async function checkActiveWindow() {
  if (!isMonitoring) {
    return;
  }

  try {
    const window = await activeWin({
      accessibilityPermission: true, // Required to get URL on macOS
      screenRecordingPermission: false // We don't need screen recording
    });

    // Check if window has a URL (only browser windows have this)
    if (!window?.url) {
      return;
    }

    const url = window.url;

    // Skip if same as last checked URL
    if (url === lastActiveWindowUrl) {
      return;
    }

    lastActiveWindowUrl = url;
    console.log('[ScamShield] Active window URL changed:', url);

    // Check if URL should be scanned
    if (!urlFilter.shouldScan(url)) {
      console.log('[ScamShield] URL filtered (known-safe domain), skipping');
      return;
    }

    // Check if already scanned recently
    if (scanCache.has(url)) {
      console.log('[ScamShield] URL already scanned recently, skipping');
      return;
    }

    // Check if already in queue
    if (scanQueue.isQueued(url)) {
      console.log('[ScamShield] URL already in scan queue, skipping');
      return;
    }

    // Mark as scanned and trigger analysis
    scanCache.set(url, true);
    console.log('[ScamShield] Auto-scanning URL from active window...');

    orchestrateAnalysis({ url, autoDetected: true }).catch(error => {
      console.error('[ScamShield] Auto-scan failed:', error);
    });
  } catch (error) {
    // Silently fail - this is expected if accessibility permissions aren't granted
  }
}

// ============================================================================
// GMAIL IPC HANDLERS (Ved's Backend)
// ============================================================================

ipcMain.handle('connect-gmail', async () => {
  try {
    const result = await startGmailOAuthFlow();
    return { success: true, ...result };
  } catch (error) {
    console.error('[Gmail] Connection failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('refresh-gmail', async () => {
  try {
    const result = await refreshGmailData();
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Scan history & stats handlers
ipcMain.handle('get-scan-history', async () => {
  return scanHistory ? scanHistory.getAll() : [];
});

ipcMain.handle('get-scan-stats', async () => {
  return scanHistory ? scanHistory.getStats() : {};
});

ipcMain.handle('get-timeline-data', async (_event, days) => {
  return scanHistory ? scanHistory.getTimelineData(days || 7) : [];
});

ipcMain.handle('clear-history', async () => {
  if (scanHistory) {
    await scanHistory.clear();
  }
  return { success: true };
});

ipcMain.handle('export-history', async () => {
  return scanHistory ? scanHistory.exportJSON() : '{}';
});

// Demo mode handlers
ipcMain.handle('enable-demo-mode', async () => {
  demoMode.enable();

  // Generate demo history
  const demoHistory = demoMode.generateDemoHistory(50);
  for (const entry of demoHistory) {
    await scanHistory.addScan(entry);
  }

  return { success: true, message: 'Demo mode enabled with 50 sample scans' };
});

ipcMain.handle('disable-demo-mode', async () => {
  demoMode.disable();
  demoMode.stopAutoScan();
  return { success: true };
});

ipcMain.handle('start-demo-auto-scan', async () => {
  demoMode.startAutoScan(async (scan) => {
    // Add to history
    if (scanHistory) {
      await scanHistory.addScan(scan);
    }

    // Send to UI
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('scan-result', scan);
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('scan-result', scan);

      // Show warning for high risk
      if (scan.risk >= 70) {
        overlayWindow.webContents.send('show-warning', {
          risk: scan.risk,
          reason: scan.reason,
          timestamp: Date.now()
        });
      }
    }
  }, 8000); // Every 8 seconds

  return { success: true };
});

ipcMain.handle('stop-demo-auto-scan', async () => {
  demoMode.stopAutoScan();
  return { success: true };
});

ipcMain.handle('analyze-text', async (_event, { text }) => {
  try {
    console.log('[ScamShield] Analyzing contact text:', text.substring(0, 100));

    // Parse contact information and verify using LinkedIn
    const analysis = await personVerifier.analyzeText(text);
    const verification = analysis.verification;

    return {
      success: true,
      isLegitimate: verification.verified,
      confidence: verification.confidence,
      findings: verification.matches || [],
      warnings: verification.warnings || [],
      linkedInProfile: verification.linkedInProfile,
      riskLevel: verification.riskLevel,
      contact: analysis.contact
    };
  } catch (error) {
    console.error('[ScamShield] Text analysis failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// ============================================================================
// TRAY MENU (Ved's Backend)
// ============================================================================

function createTray() {
  const iconPath = path.resolve(__dirname, '../../assets/icon.png');
  let trayIcon = nativeImage.createFromPath(iconPath);

  if (trayIcon.isEmpty()) {
    console.warn(`[ScamShield] Tray icon missing at ${iconPath}, using fallback glyph.`);
    trayIcon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAAOUlEQVR4nGNgGAU0AyMDw38GIgYGBkYn/n8GhoYGBgYGhiNbwWg4GBoammkaQDYRkYGABoNBALIQbbMMAAAAASUVORK5CYII='
    );
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Detectify Scam Detector');
  console.log('[ScamShield] Tray icon ready');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Control Panel',
      click: () => {
        if (controlWindow) {
          controlWindow.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: '✓ Auto-Scan Clipboard',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => {
        if (menuItem.checked) {
          if (clipboardMonitor) {
            clipboardMonitor.start();
            console.log('[ScamShield] Clipboard monitoring enabled');
          }
        } else {
          if (clipboardMonitor) {
            clipboardMonitor.stop();
            console.log('[ScamShield] Clipboard monitoring disabled');
          }
        }
      }
    },
    {
      label: '✓ Auto-Scan Active Window',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => {
        if (menuItem.checked) {
          if (!activeWindowMonitorInterval) {
            activeWindowMonitorInterval = setInterval(checkActiveWindow, 3000);
            console.log('[ScamShield] Active window monitoring enabled');
          }
        } else {
          if (activeWindowMonitorInterval) {
            clearInterval(activeWindowMonitorInterval);
            activeWindowMonitorInterval = null;
            console.log('[ScamShield] Active window monitoring disabled');
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Scan Queue Stats',
      click: () => {
        const stats = scanQueue.getStats();
        console.log('[ScamShield] Scan queue stats:', stats);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (controlWindow) {
      controlWindow.show();
    }
  });
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(async () => {
  console.log('[ScamShield] App ready');

  // Create UI windows
  createControlWindow();
  createTray();

  // Register global keyboard shortcut (Cmd/Ctrl + Shift + C to toggle)
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+C', () => {
    console.log('[ScamShield] Global shortcut triggered (toggle)');
    if (controlWindow) {
      if (controlWindow.isVisible()) {
        controlWindow.hide();
        console.log('[ScamShield] UI hidden');
      } else {
        controlWindow.show();
        controlWindow.focus();
        console.log('[ScamShield] UI shown');
      }
    }
  });

  if (shortcutRegistered) {
    console.log('[ScamShield] Keyboard shortcut registered: Cmd/Ctrl+Shift+C (toggle UI)');
  } else {
    console.warn('[ScamShield] Failed to register keyboard shortcut');
  }

  // Register Reka AI scan shortcut (Cmd/Ctrl + Shift + S to scan screen)
  const rekaScanShortcut = globalShortcut.register('CommandOrControl+Shift+S', async () => {
    console.log('[ScamShield] Reka AI scan shortcut triggered');
    if (rekaScreenMonitor && rekaScreenMonitor.enabled) {
      console.log('[RekaScreen] Manual scan requested via keyboard shortcut');

      // Show notification that scan is starting
      new Notification({
        title: 'Scanning Screen',
        body: 'Analyzing your screen with AI...',
        silent: true
      }).show();

      await rekaScreenMonitor.scanScreen();
    } else {
      console.warn('[RekaScreen] Cannot scan - Reka AI monitoring not enabled');

      // Show notification that Reka is not enabled
      new Notification({
        title: 'Reka AI Not Enabled',
        body: 'Enable Reka AI in Settings to scan',
        silent: true
      }).show();
    }
  });

  if (rekaScanShortcut) {
    console.log('[ScamShield] Keyboard shortcut registered: Cmd/Ctrl+Shift+S (Reka AI screen scan)');
  }

  // Initialize scan history
  const historyPath = path.join(app.getPath('userData'), 'scan-history.json');
  scanHistory = new ScanHistory(historyPath);
  await scanHistory.load();
  console.log('[ScamShield] Scan history loaded');

  // Initialize Gmail
  gmailTokenPath = path.join(app.getPath('userData'), 'gmail-tokens.json');
  const restored = await restoreGmailSession();
  if (restored) {
    console.log('[ScamShield] Gmail session restored for', gmailProfile?.email || 'unknown account');
  }

  // Initialize clipboard monitoring
  clipboardMonitor = new ClipboardMonitor({
    onURL: (url) => {
      console.log('[ScamShield] Clipboard URL detected:', url);

      // Check if URL should be scanned
      if (!urlFilter.shouldScan(url)) {
        console.log('[ScamShield] URL filtered (known-safe domain), skipping');
        return;
      }

      // Check if already scanned recently
      if (scanCache.has(url)) {
        console.log('[ScamShield] URL already scanned recently, skipping');
        return;
      }

      // Check if already in queue
      if (scanQueue.isQueued(url)) {
        console.log('[ScamShield] URL already in scan queue, skipping');
        return;
      }

      // Mark as scanned and trigger analysis
      scanCache.set(url, true);
      console.log('[ScamShield] Auto-scanning URL from clipboard...');

      orchestrateAnalysis({ url, autoDetected: true }).catch(error => {
        console.error('[ScamShield] Auto-scan failed:', error);
      });
    }
  });

  // Initialize screen OCR monitoring (scans visible URLs on screen)
  screenOCRMonitor = new ScreenOCRMonitor({
    scanInterval: 15000, // Check screen every 15 seconds (OCR is CPU-intensive)
    onURL: (url) => {
      console.log('[ScamShield] Screen OCR detected URL:', url);

      // Check if URL should be scanned
      if (!urlFilter.shouldScan(url)) {
        console.log('[ScamShield] URL filtered (known-safe domain), skipping');
        return;
      }

      // Check if already scanned recently
      if (scanCache.has(url)) {
        console.log('[ScamShield] URL already scanned recently, skipping');
        return;
      }

      // Add to cache
      scanCache.set(url, { scanned: true, timestamp: Date.now() });

      // Queue the scan
      scanQueue.add(url, async () => {
        console.log('[ScamShield] Auto-scanning URL from screen:', url);
        await orchestrateAnalysis(url, null, { autoDetected: true, source: 'screen-ocr' });
      });
    }
  });

  // Set up screen capture callback for OCR
  screenOCRMonitor.setCaptureCallback(async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 } // Lower res for faster OCR
      });

      if (sources.length > 0) {
        // Get the first screen (primary display)
        const primarySource = sources.find(s => s.name.includes('Screen')) || sources[0];

        // Convert to PNG buffer for Tesseract
        const thumbnail = primarySource.thumbnail;
        const pngBuffer = thumbnail.toPNG();

        return pngBuffer;
      }
      return null;
    } catch (error) {
      console.error('[ScamShield] Screen capture failed:', error);
      return null;
    }
  });

  // Initialize Reka AI screen monitoring (AI-powered full-screen analysis)
  // NOTE: Automatic scanning disabled - use Cmd+Shift+S keyboard shortcut for manual scans
  rekaScreenMonitor = new RekaScreenMonitor({
    scanInterval: 999999999, // Disabled - manual scan only via keyboard shortcut
    alertThreshold: 40, // Alert on risk scores >= 40
    onThreat: (threat) => {
      console.log('[ScamShield] Reka AI detected threat:', threat);

      // Create overlay window if it doesn't exist
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        createOverlayWindow();

        // Wait for window to be ready before sending message
        overlayWindow.webContents.once('did-finish-load', () => {
          overlayWindow.webContents.send('show-warning', {
            risk: threat.riskScore,
            reason: threat.summary,
            timestamp: threat.timestamp,
            analysis: {
              signals: threat.threats.map(t => `${t.type}: ${t.description}`),
              recommendations: [threat.recommendation]
            }
          });
        });
      } else {
        // Window already exists, send immediately
        overlayWindow.webContents.send('show-warning', {
          risk: threat.riskScore,
          reason: threat.summary,
          timestamp: threat.timestamp,
          analysis: {
            signals: threat.threats.map(t => `${t.type}: ${t.description}`),
            recommendations: [threat.recommendation]
          }
        });
      }

      // Log to scan history
      if (scanHistory && typeof scanHistory.add === 'function') {
        try {
          scanHistory.add({
            timestamp: threat.timestamp,
            source: 'reka-ai',
            riskScore: threat.riskScore,
            riskLevel: threat.riskScore >= 70 ? 'high' : threat.riskScore >= 40 ? 'medium' : 'low',
            reason: threat.summary,
            analysis: threat
          });
        } catch (error) {
          console.error('[ScamShield] Failed to add to scan history:', error.message);
        }
      }
    },
    onAnalysis: (analysis) => {
      // Log all analyses (even safe ones) for debugging
      console.log(`[ScamShield] Reka AI analysis: ${analysis.category} (risk: ${analysis.riskScore})`);
    },
    onSafe: (result) => {
      console.log('[ScamShield] Reka AI scan completed - everything safe!');

      // Show notification that scan is complete and safe
      new Notification({
        title: 'Screen Scan Complete',
        body: `Everything looks safe! (Risk: ${result.riskScore}/100)`,
        silent: true
      }).show();

      // Log to scan history
      if (scanHistory && typeof scanHistory.add === 'function') {
        try {
          scanHistory.add({
            timestamp: result.timestamp,
            source: 'reka-ai',
            riskScore: result.riskScore,
            riskLevel: 'low',
            reason: result.summary || 'No threats detected',
            analysis: result
          });
        } catch (error) {
          console.error('[ScamShield] Failed to add to scan history:', error.message);
        }
      }
    }
  });

  // Set up shared screen capture callback for both monitors
  const captureScreenCallback = async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 } // Good balance for both OCR and AI
      });

      if (sources.length > 0) {
        const primarySource = sources.find(s => s.name.includes('Screen')) || sources[0];
        const thumbnail = primarySource.thumbnail;
        const pngBuffer = thumbnail.toPNG();
        return pngBuffer;
      }
      return null;
    } catch (error) {
      console.error('[ScamShield] Screen capture failed:', error);
      return null;
    }
  };

  // Share capture callback with Reka monitor
  rekaScreenMonitor.setCaptureCallback(captureScreenCallback);

  // Start clipboard monitoring
  clipboardMonitor.start();
  console.log('[ScamShield] Clipboard monitoring started automatically');

  // Screen OCR is disabled by default (experimental feature, can be enabled in Settings)
  console.log('[ScamShield] Screen OCR monitoring available (disabled by default - enable in Settings)');

  // Reka AI monitoring is disabled by default (requires API key, can be enabled in Settings)
  console.log('[ScamShield] Reka AI monitoring available (disabled by default - enable in Settings)');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  if (clipboardMonitor) {
    clipboardMonitor.stop();
  }
  if (screenOCRMonitor) {
    await screenOCRMonitor.stop();
  }
  if (rekaScreenMonitor) {
    rekaScreenMonitor.stop();
  }
  if (activeWindowMonitorInterval) {
    clearInterval(activeWindowMonitorInterval);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
