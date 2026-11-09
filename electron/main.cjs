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

const { app, BrowserWindow, shell, Menu, dialog, ipcMain, clipboard } = require('electron');
const { spawn } = require('node:child_process');
const net = require('node:net');

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

// Expose the Chromium DevTools protocol for automated UI checks. Dev uses 9222 by
// default; a packaged build opts in only when WHISKY_CDP_PORT is set.
if (isDev || process.env.WHISKY_CDP_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.WHISKY_CDP_PORT || '9222');
}

const CONFIGURED_API_PORT = Number(process.env.RESEND_API_PORT || 8787);
// Resolved at startup. If the preferred port is taken (another Whisky instance or an
// unrelated app), we fall back to the next free one instead of silently running without
// a backend — without this the UI loads from file:// and every /api call fails.
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
    // A stray dev API also reports apiVersion 2 but serves no bundled UI; reusing it
    // used to leave the packaged splash stuck forever.
    return payload?.apiVersion === 2 && (isDev || payload?.ui === true);
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
  if (apiProcess) return true;
  for (const port of API_PORT_CANDIDATES) {
    if (await isWhiskyApiUp(port)) {
      apiPort = port;
      safeAppendCrash('startApiServer', `Reusing Whisky API already running on ${port}`);
      return true;
    }
    if (!(await isPortFree(port))) {
      safeAppendCrash('startApiServer', `Port ${port} is in use by another app, trying next`);
      continue;
    }
    apiPort = port;
    if (!spawnApiOnPort(port)) return false;
    if (await waitForApi(12000)) return true;
    safeAppendCrash('startApiServer', `API on ${port} never became healthy, trying next`);
    stopApiServer();
  }
  safeAppendCrash('startApiServer', `No usable local API port among ${API_PORT_CANDIDATES.join(', ')}`);
  return false;
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

async function loadPackagedUi(win, apiReady) {
  if (!win || win.isDestroyed()) return;
  if (apiReady) {
    const url = `http://127.0.0.1:${apiPort}/`;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await win.loadURL(url);
        return;
      } catch (err) {
        safeAppendCrash(
          'postSplashLoad',
          `attempt ${attempt}: ${err && err.message ? err.message : String(err)}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 700));
        if (!win || win.isDestroyed()) return;
      }
    }
  }
  // API never became reachable (or the UI URL kept failing). Show an actionable error
  // instead of leaving the user staring at the splash forever.
  try {
    await win.loadFile(path.join(__dirname, 'startup-error.html'));
  } catch (err) {
    safeAppendCrash('startupErrorPage', err && err.message ? err.message : String(err));
  }
}

async function retryStartup() {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  try {
    await win.loadFile(path.join(__dirname, 'splash.html'));
  } catch {
    /* keep going */
  }
  stopApiServer();
  const apiReady = await startApiServer();
  await loadPackagedUi(win, apiReady);
}

async function createWindow(apiReadyPromise) {
  const iconPath = resolveAppIcon();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
      backgroundColor: '#14111A',
      // macOS keeps the native traffic lights, inset so they don't overlap the
      // sidebar. Windows goes frameless and draws themed window controls in the
      // renderer so the title bar blends into the floating top bar.
      ...(process.platform === 'win32'
        ? { frame: false }
        : { titleBarStyle: 'hiddenInset' }),
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
    if (!mainWindow) return;
    await mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Show the splash IMMEDIATELY, then swap to the API-served http://127.0.0.1 URL
    // once the embedded API is up (required so window.location.origin is http for the
    // YouTube IFrame embed). Every failure path ends on a retry screen, never a hang.
    await mainWindow.loadFile(path.join(__dirname, 'splash.html'));
    const apiReady = await (apiReadyPromise ?? startApiServer());
    if (!mainWindow) return;
    await loadPackagedUi(mainWindow, apiReady);
  }

  if (!mainWindow) return;
  const syncMaximized = () => {
    mainWindow?.webContents.send('window:maximized-changed', Boolean(mainWindow?.isMaximized()));
  };
  mainWindow.on('maximize', syncMaximized);
  mainWindow.on('unmaximize', syncMaximized);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:toggle-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle('window:is-maximized', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
});

ipcMain.on('startup:retry', () => {
  void retryStartup();
});

ipcMain.handle('clipboard:write-text', (_event, text) => {
  const value = typeof text === 'string' ? text : String(text ?? '');
  clipboard.writeText(value);
  return clipboard.readText() === value;
});

app.whenReady().then(async () => {
  // Grant media-related permissions to the renderer + the embedded YouTube iframe so
  // playback isn't silently blocked by Chromium's permission prompt (which never fires
  // a UI in our setup).
  const { session: defaultSession } = require('electron');
  const ses = defaultSession.defaultSession;
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (
      [
        'media',
        'mediaKeySystem',
        'audioCapture',
        'background-sync',
        // navigator.clipboard.writeText asks for this in Electron; denying it was why
        // "Link copied" could appear with an empty clipboard.
        'clipboard-sanitized-write',
        'clipboard-read',
      ].includes(permission)
    ) {
      return callback(true);
    }
    callback(false);
  });

  // Kick the API off in the background and show the window/splash immediately — waiting
  // up to 12s per candidate port before painting anything looked like a dead app.
  const apiReadyPromise = startApiServer();
  await createWindow(apiReadyPromise);

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
  // notifies the user once the new version is staged — they get the update on
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
        safeAppendCrash('autoUpdater', `downloaded ${info?.version || '?'} — will install on quit`);
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

