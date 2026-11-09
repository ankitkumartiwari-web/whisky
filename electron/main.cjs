const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// === Crash silencing must happen FIRST so any error in subsequent setup is logged not dialog'd ===
function safeAppendCrash(label, payload) {
  try {
    // Write to BOTH the legacy "Whisky Music" path and Electron's actual userData
    // (whisky-music-app, taken from npm name). Whichever exists first wins; logging
    // to both means we always have a trail no matter which folder Electron creates.
    const dirs = [];
    if (process.platform === 'win32') {
      dirs.push(path.join(os.homedir(), 'AppData', 'Roaming', 'Whisky Music'));
      dirs.push(path.join(os.homedir(), 'AppData', 'Roaming', 'whisky-music-app'));
    } else if (process.platform === 'darwin') {
      dirs.push(path.join(os.homedir(), 'Library', 'Logs', 'Whisky Music'));
      dirs.push(path.join(os.homedir(), 'Library', 'Logs', 'whisky-music-app'));
    } else {
      dirs.push(path.join(os.homedir(), '.local', 'state', 'whisky-music-app'));
    }
    for (const dir of dirs) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(path.join(dir, 'main-crash.log'), `${new Date().toISOString()} ${label} ${payload}\n`);
      } catch { /* try next */ }
    }
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
const net = require('node:net');

// Suppress Electron's built-in error dialogs entirely.
if (dialog && typeof dialog.showErrorBox === 'function') {
  const originalShowErrorBox = dialog.showErrorBox.bind(dialog);
  dialog.showErrorBox = (title, content) => {
    safeAppendCrash('showErrorBox', `${title}: ${content}`);
    // intentionally swallow â€” do not show the dialog
    void originalShowErrorBox; // silence linter
  };
}

const isDev = !app.isPackaged;
const CONFIGURED_API_PORT = Number(process.env.RESEND_API_PORT || 8787);
// Resolved at startup. If the preferred port is taken (another Whisky instance or an
// unrelated app), we fall back to the next free one instead of silently running without
// a backend â€” without this the UI loads from file:// and every /api call fails.
let apiPort = CONFIGURED_API_PORT;
const API_PORT_CANDIDATES = [
  CONFIGURED_API_PORT,
  8788,
  8789,
  // 8790 is reserved for the Python recommender; 8799 for the YT Music provider.
  8791,
  8792,
  8793,
];
const DEV_URL = process.env.ELECTRON_DEV_URL || 'http://localhost:5173';

let mainWindow = null;
let apiProcess = null;

// yt-dlp bundle name differs per platform (electron-builder copies it into resources).
const YT_DLP_BINARY_NAME =
  process.platform === 'win32'
    ? 'yt-dlp.exe'
    : process.platform === 'darwin'
      ? 'yt-dlp_macos'
      : 'yt-dlp';

// Enforce single instance â€” second launches focus the running window instead of opening a new one.
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

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, '127.0.0.1');
  });
}

async function isWhiskyApiUp(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (!res.ok) return false;
    const payload = await res.json().catch(() => null);
    return payload?.apiVersion === 2;
  } catch {
    return false;
  }
}

function spawnApiOnPort(port) {
  const entry = resolveServerEntry();
  if (!fs.existsSync(entry)) {
    safeAppendCrash('startApiServer', `API entry not found at ${entry}`);
    return false;
  }

  const envPath = resolveEnvPath();
  const cwd = envPath ? path.dirname(envPath) : path.join(__dirname, '..');
  const childEnv = {
    ...process.env,
    RESEND_API_PORT: String(port),
    // Critical for packaged builds: process.execPath is the Electron binary; this flag tells it to
    // run our script as Node (no GUI, no Chromium). Without this, the API "spawns" but is actually
    // an empty Electron renderer that never starts Express.
    ELECTRON_RUN_AS_NODE: '1',
  };
  if (envPath) childEnv.DOTENV_CONFIG_PATH = envPath;
  if (!isDev) {
    // Have the API also serve the bundled UI so the renderer loads from http://localhost
    // (a real http origin) instead of file://. Required for the YouTube IFrame API to
    // accept play/pause/seek postMessage commands.
    childEnv.WHISKY_STATIC_DIR = path.join(__dirname, '..', 'dist');
    // Point the API at the bundled yt-dlp binary so it can extract direct audio URLs
    // for songs whose YouTube embed is blocked (the common label-restricted case).
    const ytdlp = path.join(process.resourcesPath, YT_DLP_BINARY_NAME);
    if (fs.existsSync(ytdlp)) childEnv.YTDLP_PATH = ytdlp;
  } else {
    // In dev, look for yt-dlp in the project's build dir.
    const devYtdlp = path.join(__dirname, '..', 'build', YT_DLP_BINARY_NAME);
    if (fs.existsSync(devYtdlp)) childEnv.YTDLP_PATH = devYtdlp;
  }

  // In packaged builds, process.stdout/stderr are not real pipes â€” writing to them throws EPIPE.
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

  const child = spawn(process.execPath, [entry], {
    cwd,
    env: childEnv,
    stdio: ['ignore', logStream ? 'pipe' : 'ignore', logStream ? 'pipe' : 'ignore'],
  });
  apiProcess = child;

  if (logStream && child.stdout) {
    child.stdout.on('data', (chunk) => {
      try { logStream && logStream.write(`[api] ${chunk}`); } catch { /* ignore */ }
    });
    child.stdout.on('error', () => {});
  }
  if (logStream && child.stderr) {
    child.stderr.on('data', (chunk) => {
      try { logStream && logStream.write(`[api err] ${chunk}`); } catch { /* ignore */ }
    });
    child.stderr.on('error', () => {});
  }
  child.on('error', (err) => {
    try { logStream && logStream.write(`[api spawn error] ${err.message}\n`); } catch { /* ignore */ }
  });
  child.on('exit', (code, signal) => {
    try { logStream && logStream.write(`[whisky] API process exited code=${code} signal=${signal}\n`); } catch { /* ignore */ }
    if (logStream) logStream.end();
    if (apiProcess === child) apiProcess = null;
  });
  return true;
}

async function startApiServer() {
  if (apiProcess) return;
  for (const port of API_PORT_CANDIDATES) {
    if (await isWhiskyApiUp(port)) {
      apiPort = port;
      safeAppendCrash('startApiServer', `Reusing Whisky API already running on ${port}`);
      return;
    }
    if (!(await isPortFree(port))) {
      safeAppendCrash('startApiServer', `Port ${port} is in use by another app, trying next`);
      continue;
    }
    apiPort = port;
    if (!spawnApiOnPort(port)) return;
    if (await waitForApi(12000)) return;
    safeAppendCrash('startApiServer', `API on ${port} never became healthy, trying next`);
    stopApiServer();
  }
  safeAppendCrash('startApiServer', `No usable local API port among ${API_PORT_CANDIDATES.join(', ')}`);
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
      const res = await fetch(`http://127.0.0.1:${apiPort}/api/health`);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function resolveAppIcon() {
  // Windows uses the ICO; macOS/Linux ignore the window icon (the bundle icon is
  // supplied by electron-builder) but a PNG keeps dev windows branded too.
  const names = process.platform === 'win32' ? ['icon.ico', 'icon.png'] : ['icon.png'];
  const roots = isDev
    ? [path.join(__dirname, '..', 'build')]
    : [
        process.resourcesPath,
        path.join(process.resourcesPath, 'app.asar.unpacked', 'build'),
        path.join(__dirname, '..', 'build'),
      ];
  for (const root of roots) {
    for (const name of names) {
      const c = path.join(root, name);
      if (fs.existsSync(c)) return c;
    }
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
    // macOS keeps the native traffic lights, inset so they don't overlap the
    // sidebar. Windows uses the overlay controls coloured to match the theme.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
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
      // Chromium blocks audio/video autoplay by default; without this the YouTube iframe
      // posts a "play" message but the embed silently refuses to start audio until the
      // user clicks inside the iframe itself. Disabling the gesture requirement makes
      // our custom play button actually start audio.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  // Mirror renderer console + uncaught errors into a file we can inspect without DevTools.
  try {
    const rendererLogPath = path.join(app.getPath('userData'), 'renderer.log');
    const rendererStream = fs.createWriteStream(rendererLogPath, { flags: 'a' });
    rendererStream.write(`\n=== launch ${new Date().toISOString()} ===\n`);
    mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
      const tag = ['v', 'i', 'W', 'E'][level] || '?';
      rendererStream.write(`[${tag}] ${source}:${line} ${message}\n`);
    });
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      rendererStream.write(`[render-process-gone] ${JSON.stringify(details)}\n`);
    });
  } catch { /* ignore */ }

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
    // Show the splash IMMEDIATELY so the window doesn't sit blank while we wait for
    // the embedded API to come up. Once the API is ready, swap to the http://localhost
    // URL (required so window.location.origin is http for the YouTube IFrame embed).
    await mainWindow.loadFile(path.join(__dirname, 'splash.html'));
    waitForApi(10000).then(async (apiReady) => {
      if (!mainWindow) return;
      try {
        if (apiReady) {
          await mainWindow.loadURL(`http://127.0.0.1:${apiPort}/`);
        } else {
          // Fallback: API never came up â€” load file:// so the user sees the UI even
          // though YouTube embed will be broken. Better than a stuck splash.
          await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
        }
      } catch (err) {
        safeAppendCrash('postSplashLoad', err && err.message ? err.message : String(err));
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Grant media-related permissions to the renderer + the embedded YouTube iframe so
  // playback isn't silently blocked by Chromium's permission prompt (which never fires
  // a UI in our setup).
  const { session: defaultSession } = require('electron');
  const ses = defaultSession.defaultSession;
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (['media', 'mediaKeySystem', 'audioCapture', 'background-sync'].includes(permission)) {
      return callback(true);
    }
    callback(false);
  });

  await startApiServer();
  await createWindow();

  if (process.platform === 'darwin') {
    // Keep the standard macOS app + Edit menus so Cmd+C/V/X/A and window
    // shortcuts work inside the search box and dialogs.
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: 'appMenu' },
        { role: 'editMenu' },
        { role: 'windowMenu' },
      ]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }

  // Auto-update via electron-updater. Reads from GitHub Releases (provider in
  // package.json build.publish). Silently downloads in the background and
  // notifies the user once the new version is staged â€” they get the update on
  // next launch. Only runs in packaged builds (autoUpdater no-ops in dev).
  if (!isDev) {
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on('error', (err) => {
        safeAppendCrash('autoUpdater', err && err.message ? err.message : String(err));
      });
      autoUpdater.on('update-available', (info) => {
        safeAppendCrash('autoUpdater', `update available: ${info?.version || '?'}`);
      });
      autoUpdater.on('update-downloaded', (info) => {
        safeAppendCrash('autoUpdater', `downloaded ${info?.version || '?'} â€” will install on quit`);
      });
      // Fire-and-forget. checkForUpdatesAndNotify shows the OS notification when
      // an update is downloaded; the actual install runs when the app quits.
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        safeAppendCrash('autoUpdater', `check failed: ${err && err.message ? err.message : err}`);
      });
    } catch (err) {
      safeAppendCrash('autoUpdater', `init failed: ${err && err.message ? err.message : err}`);
    }
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

