const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('scamShield', {
  analyze: (payload) => ipcRenderer.invoke('analyze-input', payload),
  analyzeURL: (url) => ipcRenderer.invoke('analyze-input', { url }),
  analyzeAudioFile: (filePath) => ipcRenderer.invoke('analyze-input', { audioFile: filePath }),
  onAnalysisComplete: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('analysis-complete', listener);
    return () => ipcRenderer.removeListener('analysis-complete', listener);
  },
  showWindow: () => ipcRenderer.send('show-window')
});
