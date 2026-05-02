const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// === Crash silencing must happen FIRST so any error in subsequent setup is logged not dialog'd ===
function safeAppendCrash(label, payload) {
  try {
    const dir = path.join(os.homedir(), 'AppData', 'Roaming', 'Whisky Music');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'main-crash.log'), `${new Date().toISOString()} ${label} ${payload}\n`);
  } catch {
    // last resort: silent
  }
}
process.on('uncaughtException', (err) => {
  safeAppendCrash('uncaughtException', err && (err.stack || err.message) || String(err));
});
process.on('unhandledRejection', (reason) => {
  safeAppendCrash('unhandledRejection', reason && (reason.stack || reason.message) || String(reason));
});

const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const { spawn } = require('node:child_process');

// Suppress Electron's built-in error dialogs entirely.
if (dialog && typeof dialog.showErrorBox === 'function') {
  const originalShowErrorBox = dialog.showErrorBox.bind(dialog);
  dialog.showErrorBox = (title, content) => {
    safeAppendCrash('showErrorBox', `${title}: ${content}`);
    // intentionally swallow — do not show the dialog
    void originalShowErrorBox; // silence linter
  };
}

const isDev = !app.isPackaged;
const API_PORT = Number(process.env.RESEND_API_PORT || 8787);
const DEV_URL = process.env.ELECTRON_DEV_URL || 'http://localhost:5173';

let mainWindow = null;
let apiProcess = null;

// Enforce single instance — second launches focus the running window instead of opening a new one.
// Must be before app.whenReady() so the second invocation exits before doing any work.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

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
  const cwd = envPath ? path.dirname(envPath) : path.join(__dirname, '..');
  const childEnv = { ...process.env, RESEND_API_PORT: String(API_PORT) };
  if (envPath) childEnv.DOTENV_CONFIG_PATH = envPath;

  // In packaged builds, process.stdout/stderr are not real pipes — writing to them throws EPIPE.
  // Open a log file we can safely append to instead.
  let logStream = null;
  try {
    const logDir = isDev ? path.join(__dirname, '..') : app.getPath('userData');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'api.log');
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.on('error', () => {
      logStream = null;
    });
  } catch {
    logStream = null;
  }

  apiProcess = spawn(process.execPath, [entry], {
    cwd,
    env: childEnv,
    stdio: ['ignore', logStream ? 'pipe' : 'ignore', logStream ? 'pipe' : 'ignore'],
  });

  if (logStream && apiProcess.stdout) {
    apiProcess.stdout.on('data', (chunk) => {
      try { logStream && logStream.write(`[api] ${chunk}`); } catch { /* ignore */ }
    });
    apiProcess.stdout.on('error', () => {});
  }
  if (logStream && apiProcess.stderr) {
    apiProcess.stderr.on('data', (chunk) => {
      try { logStream && logStream.write(`[api err] ${chunk}`); } catch { /* ignore */ }
    });
    apiProcess.stderr.on('error', () => {});
  }
  apiProcess.on('error', (err) => {
    try { logStream && logStream.write(`[api spawn error] ${err.message}\n`); } catch { /* ignore */ }
  });
  apiProcess.on('exit', (code, signal) => {
    try { logStream && logStream.write(`[whisky] API process exited code=${code} signal=${signal}\n`); } catch { /* ignore */ }
    if (logStream) logStream.end();
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

function resolveAppIcon() {
  const candidates = isDev
    ? [path.join(__dirname, '..', 'build', 'icon.ico'), path.join(__dirname, '..', 'build', 'icon.png')]
    : [
        path.join(process.resourcesPath, 'icon.ico'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'icon.ico'),
        path.join(__dirname, '..', 'build', 'icon.ico'),
      ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

async function createWindow() {
  const iconPath = resolveAppIcon();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#0E0B07',
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32'
      ? { color: '#0E0B07', symbolColor: '#F4ECDC', height: 32 }
      : undefined,
    autoHideMenuBar: true,
    icon: iconPath,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      // Allow YouTube IFrame embed
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    // In dev, Vite needs to be ready before we can load the URL.
    await waitForApi(15000);
    await mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In packaged builds, load the bundled UI immediately — the login screen is fully static
    // and doesn't depend on the embedded API. The API will be ready by the time the user signs in.
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

