const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fs = require('node:fs');

const isDev = !app.isPackaged;
const API_PORT = Number(process.env.RESEND_API_PORT || 8787);
const DEV_URL = process.env.ELECTRON_DEV_URL || 'http://localhost:5173';

let mainWindow = null;
let apiProcess = null;

function resolveServerEntry() {
  if (isDev) {
    return path.join(__dirname, '..', 'server', 'resend-api.mjs');
  }
  // In packaged builds, server lives inside resources/app.asar.unpacked or resources
  const candidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'resend-api.mjs'),
    path.join(process.resourcesPath, 'server', 'resend-api.mjs'),
    path.join(__dirname, '..', 'server', 'resend-api.mjs'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function resolveEnvPath() {
  const candidates = isDev
    ? [path.join(__dirname, '..', '.env')]
    : [
        path.join(app.getPath('userData'), '.env'),
        path.join(process.resourcesPath, '.env'),
        path.join(process.resourcesPath, 'app.asar.unpacked', '.env'),
      ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function startApiServer() {
  if (apiProcess) return;
  const entry = resolveServerEntry();
  if (!fs.existsSync(entry)) {
    console.warn('[whisky] API entry not found at', entry);
    return;
  }

  const envPath = resolveEnvPath();
  // Run from the directory that contains .env so dotenv's default load path picks it up.
  const cwd = envPath ? path.dirname(envPath) : path.join(__dirname, '..');
  const childEnv = { ...process.env, RESEND_API_PORT: String(API_PORT) };
  if (envPath) childEnv.DOTENV_CONFIG_PATH = envPath;

  apiProcess = spawn(process.execPath, [entry], {
    cwd,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  apiProcess.stdout.on('data', (chunk) => {
    process.stdout.write(`[api] ${chunk}`);
  });
  apiProcess.stderr.on('data', (chunk) => {
    process.stderr.write(`[api err] ${chunk}`);
  });
  apiProcess.on('exit', (code, signal) => {
    console.log('[whisky] API process exited', { code, signal });
    apiProcess = null;
  });
}

function stopApiServer() {
  if (!apiProcess) return;
  try {
    apiProcess.kill();
  } catch (err) {
    console.warn('[whisky] failed to stop API:', err);
  }
  apiProcess = null;
}

async function waitForApi(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${API_PORT}/api/health`);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#0E0B07',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      // Allow YouTube IFrame embed
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    await waitForApi();
    await mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await waitForApi();
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  startApiServer();
  await createWindow();

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(null);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopApiServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopApiServer();
});
