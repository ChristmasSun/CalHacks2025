// Preload script - Exposes safe IPC methods to renderer
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for monitoring
contextBridge.exposeInMainWorld('electronAPI', {
  // Start real-time monitoring
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),

  // Stop monitoring
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),

  // Manual scan trigger
  manualScan: () => ipcRenderer.invoke('manual-scan'),

  // Listen for scan results
  onScanResult: (callback) => {
    ipcRenderer.on('scan-result', (event, result) => callback(result));
  },

  // Listen for warning display (for overlay window)
  onShowWarning: (callback) => {
    ipcRenderer.on('show-warning', (event, warning) => callback(warning));
  },

  // Listen for clear warnings (for overlay window)
  onClearWarnings: (callback) => {
    ipcRenderer.on('clear-warnings', () => callback());
  },

  // Set overlay window clickability (for overlay window)
  setOverlayClickable: (clickable) => {
    ipcRenderer.send('set-overlay-clickable', clickable);
  },

  // Gmail integration
  connectGmail: () => ipcRenderer.invoke('connect-gmail'),
  refreshGmail: () => ipcRenderer.invoke('refresh-gmail'),

  // Listen for Gmail status updates
  onGmailStatus: (callback) => {
    ipcRenderer.on('gmail-status', (event, status) => callback(status));
  },

  // Text/contact analysis
  analyzeText: (text) => ipcRenderer.invoke('analyze-text', { text })
});
