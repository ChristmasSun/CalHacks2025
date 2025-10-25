// Load environment variables from .env file
require('dotenv').config();

const path = require('path');
const fs = require('fs/promises');
const http = require('http');
const { google } = require('googleapis');
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const { LRUCache } = require('lru-cache');

const { enrichWithScrapedMetadata } = require('../core/scraper');
const { scoreRisk } = require('../core/scorer');
const { ClipboardMonitor } = require('../core/clipboard-monitor');
const { URLFilter } = require('../core/url-filter');
const { scanQueue } = require('../core/scan-queue');
const { queryFetchAgent } = require('../infra/fetchAgent');
const { transcribeAudio } = require('../infra/deepgram');
const activeWin = require('active-win');

process.on('unhandledRejection', (reason) => {
  console.error('[ScamShield] Unhandled promise rejection:', reason);
});

const ALERT_DISPLAY_MS = 10000;
const ALERT_MARGIN = 18;
const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
let mainWindow;
let tray;
let alertTimer;
let gmailConnected = false;
let gmailTokenPath;
let gmailTokens = null;
let gmailProfile = null;
let gmailSuspiciousMessages = [];
let gmailLastRefreshedAt = null;
let gmailOAuthClient = null;

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

// Auto-scanning components
let clipboardMonitor;
let activeWindowMonitorInterval;
const urlFilter = new URLFilter();
const scanCache = new LRUCache({
  max: 500, // Cache up to 500 scanned URLs
  ttl: 1000 * 60 * 60 // 1 hour TTL
});

// Load user whitelist/blacklist rules
urlFilter.loadUserRules();

// Track last seen URL to avoid duplicate scans
let lastActiveWindowUrl = null;

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
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gmail-status', buildGmailStatusPayload(extra));
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

function evaluateMessageRisk({ subject, snippet, fromAddress }) {
  const reasons = [];
  const subjectLower = (subject || '').toLowerCase();
  const snippetLower = (snippet || '').toLowerCase();
  const email = parseEmailAddress(fromAddress || '');

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

  try {
    const client = oauthClient || (await getActiveOAuthClient());
    if (!client) {
      throw new Error('Missing Gmail session credentials. Please reconnect.');
    }

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

        const reasons = evaluateMessageRisk({
          subject,
          snippet,
          fromAddress: fromValue
        });

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
          reject(new Error(`Google OAuth error: ${errorParam}`));
        }
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing authorization code.');
        if (!handled) {
          handled = true;
          reject(new Error('Google OAuth response did not include a code.'));
        }
        return;
      }

      try {
        const { tokens } = await oauthClient.getToken(code);
        oauthClient.setCredentials(tokens);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body><h2>Gmail connected ✅</h2><p>You can close this window and return to Scam Shield.</p></body></html>'
        );

        if (!handled) {
          handled = true;
          resolve({ tokens, oauthClient });
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Authentication failed. Please try again.');
        if (!handled) {
          handled = true;
          reject(error);
        }
      }
    });

    authWindow = new BrowserWindow({
      width: 520,
      height: 640,
      resizable: false,
      title: 'Connect Gmail',
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    authWindow.on('closed', () => {
      if (!handled) {
        handled = true;
        reject(new Error('Gmail sign-in window was closed before completion.'));
      }
    });

    authWindow.loadURL(authUrl);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.close();
    }
  }

  const profile = await fetchGmailProfile(authResult.oauthClient);

  gmailTokens = { ...authResult.tokens, redirectUri };
  gmailProfile = profile;
  gmailConnected = true;
  gmailOAuthClient = authResult.oauthClient;
  attachTokenListener(gmailOAuthClient, redirectUri);

  await persistGmailTokens(gmailTokens, redirectUri);

  const refreshPayload = await refreshGmailData(gmailOAuthClient);
  return refreshPayload;
}

function shouldDisplayAlert(assessment) {
  return assessment?.risk_level && assessment.risk_level !== 'low';
}

function positionWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  const { workArea } = screen.getPrimaryDisplay();
  const [width, height] = [mainWindow.getBounds().width, mainWindow.getBounds().height];
  const x = Math.floor(workArea.x + workArea.width - width - ALERT_MARGIN);
  const y = Math.floor(workArea.y + ALERT_MARGIN);
  mainWindow.setPosition(x, y);
}

function showAlertWindow(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  clearTimeout(alertTimer);
  positionWindow();
  const sendPayload = () => mainWindow.webContents.send('show-alert', payload);
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', sendPayload);
  } else {
    sendPayload();
  }
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.showInactive();

  alertTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  }, ALERT_DISPLAY_MS);
}

function displayDashboard() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  clearTimeout(alertTimer);
  positionWindow();
  const payload = { connected: gmailConnected, email: gmailProfile?.email || null };
  const sendDashboard = () => mainWindow.webContents.send('show-dashboard', payload);
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', sendDashboard);
  } else {
    sendDashboard();
  }
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.show();
}

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

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('analysis-complete', payload);
  }

  if (shouldDisplayAlert(assessment)) {
    console.log(`[ScamShield] Showing alert for ${url || audioFile} (risk: ${assessment.risk_level})`);
    showAlertWindow(payload);
  } else {
    console.log(`[ScamShield] No alert needed (risk: ${assessment.risk_level})`);
  }

  return assessment;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 260,
    show: false,
    resizable: false,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    roundedCorners: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

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
  tray.setToolTip('Scam Shield');
  console.log('[ScamShield] Tray icon ready');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        displayDashboard();
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
      label: '✓ Auto-Scan Browser Tabs',
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
            lastActiveWindowUrl = null;
            console.log('[ScamShield] Active window monitoring disabled');
          }
        }
      }
    },
    {
      label: 'View Scan Queue',
      click: () => {
        const stats = scanQueue.getStats();
        console.log('[ScamShield] Scan queue stats:', stats);
        // Could show a dialog here
      }
    },
    {
      label: 'View Filter Stats',
      click: () => {
        const stats = urlFilter.getStats();
        console.log('[ScamShield] URL filter stats:', stats);
        // Could show a dialog here
      }
    },
    { type: 'separator' },
    {
      label: 'Scan Example URL',
      click: async () => {
        try {
          await orchestrateAnalysis({
            url: 'https://calhacks.example.com/free-money'
          });
        } catch (error) {
          console.error('Tray example scan failed', error);
        }
      }
    },
    {
      label: 'Analyze Sample Audio',
      click: async () => {
        try {
          await orchestrateAnalysis({
            audioFile: '/path/to/sample-voicemail.wav'
          });
        } catch (error) {
          console.error('Tray audio analysis failed', error);
        }
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
  tray.on('click', () => tray.popUpContextMenu());
}

app.whenReady().then(async () => {
  console.log('[ScamShield] App ready');
  createWindow();
  createTray();

  gmailTokenPath = path.join(app.getPath('userData'), 'gmail-tokens.json');
  const restored = await restoreGmailSession();
  if (restored) {
    console.log('[ScamShield] Gmail session restored for', gmailProfile?.email || 'unknown account');
  }

  // Start automatic clipboard monitoring
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

  clipboardMonitor.start();
  console.log('[ScamShield] Auto-scanning enabled (clipboard monitoring active)');

  // Start active window URL monitoring (scans URLs in browser tabs)
  async function checkActiveWindow() {
    try {
      const window = await activeWin({
        accessibilityPermission: true, // Required to get URL on macOS
        screenRecordingPermission: false // We don't need screen recording
      });

      // Check if window has a URL (only browser windows have this)
      if (window && window.url) {
        const url = window.url;

        // Only process if URL changed
        if (url !== lastActiveWindowUrl) {
          lastActiveWindowUrl = url;
          console.log('[ActiveWindow] Browser URL detected:', url);

          // Apply same filtering logic as clipboard
          if (!urlFilter.shouldScan(url)) {
            console.log('[ActiveWindow] URL filtered (known-safe domain), skipping');
            return;
          }

          if (scanCache.has(url)) {
            console.log('[ActiveWindow] URL already scanned recently, skipping');
            return;
          }

          if (scanQueue.isQueued(url)) {
            console.log('[ActiveWindow] URL already in scan queue, skipping');
            return;
          }

          // Mark as scanned and trigger analysis
          scanCache.set(url, true);
          console.log('[ActiveWindow] Auto-scanning URL from active browser tab...');

          orchestrateAnalysis({ url, autoDetected: true }).catch(error => {
            console.error('[ActiveWindow] Auto-scan failed:', error);
          });
        }
      }
    } catch (error) {
      // Accessibility permission not granted - fail silently
      if (error.message?.includes('require assistive access')) {
        console.log('[ActiveWindow] Accessibility permission required but not granted (disabled)');
      } else {
        console.error('[ActiveWindow] Error:', error.message);
      }
    }
  }

  // Poll active window every 3 seconds
  activeWindowMonitorInterval = setInterval(checkActiveWindow, 3000);
  console.log('[ScamShield] Active window monitoring enabled (checks every 3 seconds)');

  if (mainWindow) {
    mainWindow.once('ready-to-show', () => {
      const payload = {
        gmailConnected,
        email: gmailProfile?.email || null
      };
      const sendBootstrap = () => mainWindow.webContents.send('bootstrap', payload);
      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', sendBootstrap);
      } else {
        sendBootstrap();
      }
      displayDashboard();
    });
  }

  if (process.env.SCAMSHIELD_DEBUG === '1') {
    console.log('[ScamShield] Debug overlay enabled');
    setTimeout(() => {
      showAlertWindow({
        assessment: {
          url: 'https://debug.scamshield.dev/alert',
          risk_score: 88,
          risk_level: 'high',
          summary: 'Debug overlay: simulated high-risk phishing domain detected.',
          explanations: [
            'URL scan flagged credential harvesting behavior.',
            'Fetch agent spotted brand impersonation markers.',
            'Sandbox detected suspicious login form prompts.'
          ],
          generatedAt: new Date().toISOString()
        },
        rawSignals: {}
      });
    }, 1500);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  clearTimeout(alertTimer);
  if (clipboardMonitor) {
    clipboardMonitor.stop();
  }
  if (activeWindowMonitorInterval) {
    clearInterval(activeWindowMonitorInterval);
  }
});

ipcMain.handle('analyze-input', async (_event, payload) => orchestrateAnalysis(payload));

ipcMain.on('hide-alert', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    clearTimeout(alertTimer);
    mainWindow.hide();
  }
});

ipcMain.handle('connect-gmail', async () => {
  if (gmailConnected && gmailProfile?.email) {
    return buildGmailStatusPayload();
  }

  try {
    const result = await startGmailOAuthFlow();
    return result;
  } catch (error) {
    console.error('[ScamShield] Gmail connection failed:', error);
    emitGmailStatus({ error: error.message });
    return { connected: false, error: error.message };
  }
});

ipcMain.handle('hide-dashboard', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    clearTimeout(alertTimer);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.hide();
    return { hidden: true };
  }
  return { hidden: false };
});

ipcMain.handle('refresh-gmail', async () => {
  const payload = await refreshGmailData();
  return payload;
});
