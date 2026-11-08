// Minimal preload — keeps contextIsolation enabled and exposes only the
// platform string needed for titlebar layout (window controls are Windows-only).
const { contextBridge } = require('electron');

try {
  contextBridge.exposeInMainWorld('whiskyDesktop', { platform: process.platform });
} catch {
  // contextBridge is unavailable in plain-browser previews.
}
