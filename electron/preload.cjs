// Minimal preload — keeps contextIsolation enabled and exposes the
// platform string plus the window-control bridge used by the custom title bar.
const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('whiskyDesktop', {
    platform: process.platform,
    windowControls: {
      minimize: () => ipcRenderer.send('window:minimize'),
      toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
      close: () => ipcRenderer.send('window:close'),
      isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
      onMaximizedChange: (callback) => {
        const listener = (_event, maximized) => callback(Boolean(maximized));
        ipcRenderer.on('window:maximized-changed', listener);
        return () => ipcRenderer.removeListener('window:maximized-changed', listener);
      },
    },
    startup: {
      retry: () => ipcRenderer.send('startup:retry'),
    },
    clipboard: {
      writeText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
    },
  });
} catch {
  // contextBridge is unavailable in plain-browser previews.
}
