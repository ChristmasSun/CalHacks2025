// Cluely Scam Detector - Main Process
// Real-time screen monitoring for scam detection
// Install dependencies: npm install electron
// Run the app: npm start

const { app, BrowserWindow, ipcMain, desktopCapturer, screen, net } = require('electron');
const path = require('path');

let controlWindow; // Control panel window
let overlayWindow; // Transparent overlay for warnings
let isMonitoring = false;
let monitoringInterval = null;

// Create the control panel window
function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 350,
    height: 500,
    x: 50,
    y: 50,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  controlWindow.loadFile(path.join(__dirname, 'control.html'));

  // Open DevTools for debugging (comment out in production)
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

  // Start as click-through, will be toggled when badges appear
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // Listen for requests to enable/disable mouse events
  ipcMain.on('set-overlay-clickable', (event, clickable) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setIgnoreMouseEvents(!clickable, { forward: true });
    }
  });

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

  // Open DevTools for debugging (comment out in production)
  overlayWindow.webContents.openDevTools({ mode: 'detach' });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// IPC Handler: Start monitoring
ipcMain.handle('start-monitoring', async () => {
  console.log('🚀 Start monitoring requested. Current state:', isMonitoring);

  if (isMonitoring) {
    console.log('⚠️ Already monitoring');
    return { success: false, message: 'Already monitoring' };
  }

  isMonitoring = true;
  console.log('✅ isMonitoring set to TRUE');

  // Create overlay window if it doesn't exist
  if (!overlayWindow) {
    createOverlayWindow();
  }

  // Start periodic screenshot capture and analysis
  monitoringInterval = setInterval(async () => {
    console.log(`⏰ Interval tick - isMonitoring: ${isMonitoring}`);
    try {
      await captureAndAnalyze();
    } catch (error) {
      console.error('Monitoring error:', error);
    }
  }, 3000); // Scan every 3 seconds

  console.log(`✅ Monitoring started with interval ID: ${monitoringInterval}`);
  return { success: true, message: 'Monitoring started' };
});

// IPC Handler: Stop monitoring
ipcMain.handle('stop-monitoring', async () => {
  console.log('🛑 Stop monitoring requested. Current state:', isMonitoring);
  console.log(`🛑 Current interval ID: ${monitoringInterval}`);

  if (!isMonitoring) {
    console.log('⚠️ Already stopped');
    return { success: true, message: 'Already stopped' };
  }

  console.log('🛑 Setting isMonitoring to FALSE');
  isMonitoring = false;

  if (monitoringInterval) {
    console.log(`🛑 Clearing interval with ID: ${monitoringInterval}`);
    clearInterval(monitoringInterval);
    const clearedId = monitoringInterval;
    monitoringInterval = null;
    console.log(`✅ Monitoring interval ${clearedId} cleared, now: ${monitoringInterval}`);
  } else {
    console.log('⚠️ No monitoring interval to clear');
  }

  // Clear overlay warnings
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('clear-warnings');
    console.log('✅ Overlay warnings cleared');
  } else {
    console.log('⚠️ No overlay window to clear');
  }

  console.log(`✅ Monitoring stopped successfully. Final state: isMonitoring=${isMonitoring}, interval=${monitoringInterval}`);
  return { success: true, message: 'Monitoring stopped' };
});

// Capture screen and analyze for scams
async function captureAndAnalyze() {
  // Check if monitoring is still active before doing anything
  if (!isMonitoring) {
    console.log('⏸️ Monitoring stopped, skipping capture');
    return;
  }

  try {
    console.log('📸 Capturing screen...');

    // Capture primary screen
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    if (sources.length === 0) {
      console.log('❌ No sources found');
      return;
    }

    const primaryScreen = sources[0];
    const pngBuffer = primaryScreen.thumbnail.toPNG();
    const base64Image = pngBuffer.toString('base64');

    // Check again before making network request (in case stopped during capture)
    if (!isMonitoring) {
      console.log('⏸️ Monitoring stopped during capture, aborting');
      return;
    }

    console.log('📤 Sending to backend...');

    // Send to backend for analysis using Electron's net module
    const result = await new Promise((resolve, reject) => {
      const request = net.request({
        method: 'POST',
        protocol: 'http:',
        hostname: 'localhost',
        port: 8000,
        path: '/detect'
      });

      request.setHeader('Content-Type', 'application/json');

      let responseData = '';

      request.on('response', (response) => {
        console.log(`📥 Backend response status: ${response.statusCode}`);

        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      request.on('error', (error) => {
        console.error('❌ Request error:', error);
        reject(error);
      });

      // Send the request with the image data
      request.write(JSON.stringify({ image: base64Image }));
      request.end();
    });

    console.log(`🎯 Result: Risk ${result.risk}% - ${result.reason}`);

    // Check one more time before showing warnings (in case stopped during request)
    if (!isMonitoring) {
      console.log('⏸️ Monitoring stopped during analysis, not showing warning');
      return;
    }

    // If scam detected (risk > 30), show warning on overlay
    if (result.risk > 30) {
      console.log('⚠️ Scam detected! Showing warning...');

      if (overlayWindow && !overlayWindow.isDestroyed()) {
        // Wait for overlay to be ready
        if (overlayWindow.webContents.isLoading()) {
          await new Promise(resolve => {
            overlayWindow.webContents.once('did-finish-load', resolve);
          });
        }

        overlayWindow.webContents.send('show-warning', {
          risk: result.risk,
          reason: result.reason,
          analysis: result.analysis, // Pass analysis data from backend
          timestamp: Date.now()
        });
        console.log('✅ Warning sent to overlay');
      } else {
        console.log('❌ Overlay window not available');
      }
    } else {
      console.log('✅ No scam detected (risk too low)');
    }

    // Send status update to control panel
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('scan-result', result);
    }
  } catch (error) {
    console.error('❌ Capture and analyze error:', error);
  }
}

// IPC Handler: Manual scan trigger
ipcMain.handle('manual-scan', async () => {
  try {
    await captureAndAnalyze();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create windows when Electron is ready
app.whenReady().then(() => {
  createControlWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
