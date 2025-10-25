const path = require('path');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  Notification
} = require('electron');

const { analyzeInput } = require('../infra');
const { enrichWithScrapedMetadata } = require('../core/scraper');
const { scoreRisk } = require('../core/scorer');

let mainWindow;
let tray;

async function orchestrateAnalysis({ url, audioFile } = {}) {
  if (!url && !audioFile) {
    throw new Error('Supply a URL, an audio file, or both for analysis.');
  }

  const infraResult = await analyzeInput({ url, audioFile });
  const enriched = await enrichWithScrapedMetadata(infraResult);
  const assessment = scoreRisk(enriched);

  if (Notification.isSupported()) {
    const scoreLabel = `${assessment.risk_score}% Scam Risk`;
    const icon =
      assessment.risk_level === 'high'
        ? '⚠️'
        : assessment.risk_level === 'medium'
        ? '🟡'
        : '🟢';
    const body = assessment.explanations[0] ?? 'No explanation provided.';

    const notification = new Notification({
      title: `${icon} ${scoreLabel}`,
      subtitle: assessment.url ?? 'Unknown source',
      body
    });
    notification.show();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('analysis-complete', {
      assessment,
      rawSignals: assessment.rawSignals
    });
  }

  return assessment;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 520,
    show: false,
    resizable: false,
    frame: false,
    transparent: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../../assets/icon.png'));
  tray.setToolTip('Scam Shield');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Scanner',
      click: () => {
        if (!mainWindow) {
          return;
        }
        mainWindow.show();
        mainWindow.focus();
      }
    },
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
  tray.on('click', () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
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

ipcMain.on('show-window', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});
