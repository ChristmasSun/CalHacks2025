const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, screen } = require('electron');

const { analyzeInput } = require('../infra');
const { enrichWithScrapedMetadata } = require('../core/scraper');
const { scoreRisk } = require('../core/scorer');

const ALERT_DISPLAY_MS = 10000;
const ALERT_MARGIN = 18;
let mainWindow;
let tray;
let alertTimer;

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
  mainWindow.webContents.send('show-alert', payload);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.showInactive();

  alertTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  }, ALERT_DISPLAY_MS);
}

async function orchestrateAnalysis({ url, audioFile } = {}) {
  if (!url && !audioFile) {
    throw new Error('Supply a URL, an audio file, or both for analysis.');
  }

  const infraResult = await analyzeInput({ url, audioFile });
  const enriched = await enrichWithScrapedMetadata(infraResult);
  const assessment = scoreRisk(enriched);

  const payload = {
    assessment,
    rawSignals: assessment.rawSignals
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('analysis-complete', payload);
  }

  if (shouldDisplayAlert(assessment)) {
    showAlertWindow(payload);
  }

  return assessment;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 220,
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
  positionWindow();
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../../assets/icon.png'));
  tray.setToolTip('Scam Shield');

  const contextMenu = Menu.buildFromTemplate([
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
  createWindow();
  createTray();

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

ipcMain.handle('analyze-input', async (_event, payload) => orchestrateAnalysis(payload));

ipcMain.on('hide-alert', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    clearTimeout(alertTimer);
    mainWindow.hide();
  }
});
