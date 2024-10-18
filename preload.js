const { contextBridge, ipcRenderer } = require('electron');

// Expose the ipcRenderer to the Renderer process (React app) via contextBridge
contextBridge.exposeInMainWorld('electron', {
  sendLoginData: (username, password) => {
    ipcRenderer.send('login-instagram', { username, password });
  },
  onLoginStatus: (callback) => {
    ipcRenderer.on('login-status', callback);
  },
  requestMetrics: (command) => {
    ipcRenderer.send('request-metrics', command); // Send a request for metrics
  },
  onMetricsReceived: (callback) => {
    ipcRenderer.on('metrics-data', callback); // Listen for metrics data
  },
});

