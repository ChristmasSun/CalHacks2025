const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const { LRUCache } = require('lru-cache');

const { enrichWithScrapedMetadata } = require('../core/scraper');
const { scoreRisk } = require('../core/scorer');
const { ClipboardMonitor } = require('../core/clipboard-monitor');
const { URLFilter } = require('../core/url-filter');
const { scanQueue } = require('../core/scan-queue');

process.on('unhandledRejection', (reason) => {
  console.error('[ScamShield] Unhandled promise rejection:', reason);
});

const ALERT_DISPLAY_MS = 10000;
const ALERT_MARGIN = 18;
let mainWindow;
let tray;
let alertTimer;
let gmailConnected = false;

// Auto-scanning components
let clipboardMonitor;
const urlFilter = new URLFilter();
const scanCache = new LRUCache({
  max: 500, // Cache up to 500 scanned URLs
  ttl: 1000 * 60 * 60 // 1 hour TTL
});

// Load user whitelist/blacklist rules
urlFilter.loadUserRules();

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
  const payload = { connected: gmailConnected };
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
    agentFindings: url ? await require('../infra/fetchAgent').queryFetchAgent({ url }) : null,
    transcript: audioFile ? await require('../infra/deepgram').transcribeAudio({ filePath: audioFile }) : null
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

app.whenReady().then(() => {
  console.log('[ScamShield] App ready');
  createWindow();
  createTray();

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

  if (mainWindow) {
    mainWindow.once('ready-to-show', () => {
      const sendBootstrap = () => mainWindow.webContents.send('bootstrap', { gmailConnected });
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
});

ipcMain.handle('analyze-input', async (_event, payload) => orchestrateAnalysis(payload));

ipcMain.on('hide-alert', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    clearTimeout(alertTimer);
    mainWindow.hide();
  }
});

ipcMain.handle('connect-gmail', async () => {
  if (gmailConnected) {
    return { connected: true };
  }

  await new Promise((resolve) => setTimeout(resolve, 800));
  gmailConnected = true;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gmail-status', { connected: gmailConnected });
  }

  return { connected: gmailConnected };
});

ipcMain.on('hide-dashboard', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    clearTimeout(alertTimer);
    mainWindow.hide();
  }
});
