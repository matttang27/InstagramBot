const { contextBridge, ipcRenderer } = require('electron');

// Expose the ipcRenderer to the Renderer process (React app) via contextBridge
contextBridge.exposeInMainWorld('electron', {
  sendLoginData: (username, password) => {
    ipcRenderer.send('login-instagram', { username, password });
  }
});
