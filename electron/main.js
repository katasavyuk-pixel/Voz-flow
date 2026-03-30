const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = !app.isPackaged;
const { exec, execSync } = require("child_process");
const { TranscriptionDB } = require("./database");
const { UiohookKey, uIOhook } = require("uiohook-napi");

let mainWindow;
let indicatorWindow;
let tray = null;
let activeShortcut = null;
let lastTargetAppBundleId = null;
let lastTargetAppName = null;
let shortcutRecordingState = false;
app.isQuitting = false;

// === APP STATE MACHINE (ported from SFlow) ===
const AppState = {
  IDLE: "idle",
  RECORDING: "recording",
  PROCESSING: "processing",
  DONE: "done",
  ERROR: "error",
};
let currentAppState = AppState.IDLE;
let stateTimeoutId = null;

// === LOCAL DATABASE ===
let db = null;

// === DOUBLE-TAP HOTKEY (ported from SFlow's hotkey.py) ===
const DOUBLE_TAP_INTERVAL = 400; // ms
let doubleTapEnabled = true;
let lastCtrlPress = 0;
let ctrlTapCount = 0;
let isHandsFreeRecording = false;

// Audio data throttle
let lastAudioForward = 0;
const AUDIO_FORWARD_INTERVAL = 33; // ~30fps

// === DOUBLE-TAP CTRL: global keyboard listener via uiohook-napi ===
let doubleTapCooldown = 0; // Cooldown to prevent instant re-trigger
let ctrlIsDown = false;    // Track key-down to ignore repeats

function startDoubleTapListener() {
  // Use keydown to track press state, keyup to count taps
  uIOhook.on("keydown", (e) => {
    if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
      ctrlIsDown = true;
    } else {
      // Any non-Ctrl key resets tap count
      ctrlTapCount = 0;
    }
  });

  uIOhook.on("keyup", (e) => {
    if (!doubleTapEnabled) return;
    if (e.keycode !== UiohookKey.Ctrl && e.keycode !== UiohookKey.CtrlRight) return;

    ctrlIsDown = false;
    const now = Date.now();

    // Ignore if within cooldown (prevents re-trigger on stop)
    if (now - doubleTapCooldown < 600) return;

    if (now - lastCtrlPress < DOUBLE_TAP_INTERVAL) {
      ctrlTapCount++;
    } else {
      ctrlTapCount = 1;
    }
    lastCtrlPress = now;

    if (ctrlTapCount >= 2) {
      ctrlTapCount = 0;
      doubleTapCooldown = now; // Set cooldown
      console.log("[Voz Flow] Double-tap Ctrl detected — toggling recording");

      // Same logic as shortcut handler
      const wasRecording = shortcutRecordingState;
      shortcutRecordingState = !shortcutRecordingState;

      if (!wasRecording && shortcutRecordingState) {
        try {
          if (process.platform === "darwin") {
            const focused = captureFrontmostApp();
            if (focused.bundleId && focused.bundleId !== selfBundleId) {
              lastTargetAppBundleId = focused.bundleId;
              lastTargetAppName = focused.appName;
              console.log(`[Voz Flow] Target captured on double-tap: ${focused.appName} (${focused.bundleId})`);
            }
          }
        } catch (err) {
          console.error("[Voz Flow] Error capturing target (non-fatal):", err.message);
        }
      }

      setIndicatorVisible(shortcutRecordingState);
      dispatchToggleRecordingToRenderer();
    }
  });

  uIOhook.start();
  console.log("[Voz Flow] Double-tap Ctrl listener started (uiohook)");
}

const defaultShortcuts = [
  "CommandOrControl+Alt+R",
  "CommandOrControl+Alt+D",
  "CommandOrControl+Alt+V",
  "CommandOrControl+Alt+Shift+R",
  "CommandOrControl+Alt+Shift+D",
  "CommandOrControl+Alt+Shift+V",
  "CommandOrControl+Alt+9",
  "CommandOrControl+Alt+0",
];

function sanitizeFlowConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== "object") {
    return { personalDictionary: [], snippets: [] };
  }

  const personalDictionary = Array.isArray(rawConfig.personalDictionary)
    ? rawConfig.personalDictionary
      .map((entry) => String(entry).trim())
      .filter(Boolean)
    : [];

  const snippets = Array.isArray(rawConfig.snippets)
    ? rawConfig.snippets
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const trigger = String(item.trigger || "").trim();
        const output = String(item.output || "").trim();
        if (!trigger || !output) return null;
        return { trigger, output };
      })
      .filter((item) => item !== null)
    : [];

  return { personalDictionary, snippets };
}

function buildFlowSystemPrompt(config) {
  const dictionaryBlock = config.personalDictionary.length
    ? `\n\nDICCIONARIO PERSONAL (obligatorio):\n${config.personalDictionary
      .map((term) => `- ${term}`)
      .join("\n")}`
    : "";

  const snippetsBlock = config.snippets.length
    ? `\n\nSNIPPETS (reemplazo obligatorio cuando detectes el trigger):\n${config.snippets
      .map((snippet) => `- ${snippet.trigger} -> ${snippet.output}`)
      .join("\n")}`
    : "";

  return `Eres un limpiador minimo de transcripciones de voz. Tu trabajo es hacer el MENOR cambio posible para que el texto sea legible.

REGLAS ESTRICTAS:
1) CONSERVA las palabras exactas del hablante. NO reemplaces palabras por sinonimos. NO reescribas frases.
2) Solo elimina muletillas obvias: eh, um, mmm, este, eee, ah.
3) Agrega puntuacion basica (comas, puntos) donde sea necesario.
4) Corrige errores de transcripcion evidentes (palabras mal captadas por el reconocimiento de voz).
5) NO cambies el tono, el estilo ni el nivel de formalidad.
6) NO agregues palabras que el hablante no dijo.
7) NO resumas, NO reorganices, NO "mejores" el texto.
8) Si el texto ya esta bien, devuelvelo igual.

PROHIBIDO:
- Cambiar "voy a" por "me dirigire a"
- Cambiar palabras informales por formales
- Agregar frases de cortesia que no se dijeron
- Reestructurar el orden de las ideas
- Inventar contenido
${dictionaryBlock}${snippetsBlock}

SALIDA: Devuelve SOLO el texto limpio, nada mas.
- Nunca incluyas explicaciones, etiquetas, metadatos ni prefacios.`;
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
  try {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) return {};
    const data = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    return typeof data === "object" && data ? data : {};
  } catch {
    return {};
  }
}

function saveSettings(nextData) {
  try {
    const current = loadSettings();
    const merged = { ...current, ...nextData };
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify(merged, null, 2),
      "utf8",
    );
    return merged;
  } catch {
    return null;
  }
}

function loadSavedShortcut() {
  const settings = loadSettings();
  return typeof settings.shortcut === "string"
    ? settings.shortcut.trim()
    : null;
}

function loadSavedApiKey() {
  const settings = loadSettings();
  return typeof settings.groqApiKey === "string"
    ? settings.groqApiKey.trim()
    : "";
}

function normalizeShortcut(rawShortcut) {
  const parts = String(rawShortcut || "")
    .trim()
    .replace(/\s+/g, "")
    .split("+")
    .filter(Boolean);

  if (!parts.length) return { ok: false, error: "Atajo vacío" };

  const modifiers = [];
  let key = null;

  const mapToken = (token) => {
    const t = token.toLowerCase();
    if (t === "cmd" || t === "command" || t === "commandorcontrol") {
      return "CommandOrControl";
    }
    if (t === "ctrl" || t === "control") return "Control";
    if (t === "opt" || t === "option" || t === "alt") return "Alt";
    if (t === "shift") return "Shift";
    if (t === "space" || t === "spacebar") return "Space";
    if (t === "fn" || t === "function") return "Fn";
    return token.length === 1 ? token.toUpperCase() : token;
  };

  for (const token of parts) {
    const mapped = mapToken(token);
    if (mapped === "Fn") {
      return {
        ok: false,
        error:
          "La tecla fn sola no se puede usar como atajo global en macOS/Electron.",
      };
    }

    if (["CommandOrControl", "Control", "Alt", "Shift"].includes(mapped)) {
      if (!modifiers.includes(mapped)) modifiers.push(mapped);
      continue;
    }

    if (key) {
      return {
        ok: false,
        error: "Atajo inválido: solo puede haber una tecla final",
      };
    }
    key = mapped;
  }

  if (!key) {
    return {
      ok: false,
      error: "Falta la tecla final (por ejemplo: R, D o V)",
    };
  }

  if (key === "Space") {
    return {
      ok: false,
      error: "No usamos Space porque da conflictos. Usa Command+Option+letra.",
    };
  }

  if (!modifiers.includes("CommandOrControl") || !modifiers.includes("Alt")) {
    return {
      ok: false,
      error:
        "El atajo debe incluir Command y Option (ejemplo: CommandOrControl+Alt+R).",
    };
  }

  return { ok: true, shortcut: [...modifiers, key].join("+") };
}

// Self bundle ID — resolved once at startup, never blocks the hot path
let selfBundleId = null;

function initSelfBundleId() {
  if (process.platform === "darwin") {
    try {
      const out = execSync(
        `osascript -e 'tell application "System Events" to get bundle identifier of first application process whose unix id is ${process.pid}'`,
        { encoding: "utf8", timeout: 3000 },
      ).trim();
      if (out && out !== "missing value") { selfBundleId = out; return; }
    } catch { /* ignore */ }
  }

  selfBundleId = "com.vozflow.app";
}

// Single osascript call to get both bundle ID and name of frontmost app (fast)
function captureFrontmostApp() {
  if (process.platform !== "darwin") return { bundleId: null, appName: null };

  try {
    const out = execSync(
      `osascript -e 'tell application "System Events" to set fp to first application process whose frontmost is true' -e 'return (bundle identifier of fp) & "|" & (name of fp)'`,
      { encoding: "utf8", timeout: 1500 },
    ).trim().replace(/\r?\n/g, "");
    const [bundleId, appName] = out.split("|");
    return { bundleId: bundleId || null, appName: appName || null };
  } catch {
    return { bundleId: null, appName: null };
  }
}

function resolveTargetAppForPaste() {
  // Always use the target saved when shortcut was pressed — no extra execSync here
  if (lastTargetAppBundleId) {
    return { bundleId: lastTargetAppBundleId, appName: lastTargetAppName || null };
  }
  return { bundleId: null, appName: null };
}

function pasteTextOnMac(text) {
  const target = resolveTargetAppForPaste();
  const targetLabel = target.appName || target.bundleId || "Unknown App";
  console.log(`[Voz Flow] === PASTE START ===`);
  console.log(`[Voz Flow] Target: ${targetLabel} (bundle: ${target.bundleId || "N/A"})`);
  console.log(`[Voz Flow] Text length: ${(text || "").length}`);

  // 1. Set clipboard synchronously via pbcopy
  try {
    execSync("pbcopy", { input: text, encoding: "utf8" });
    console.log("[Voz Flow] Clipboard set OK");
  } catch (err) {
    console.error("[Voz Flow] pbcopy FAILED:", err.message);
    notifyPasteResult(false, "No se pudo copiar al portapapeles");
    return;
  }

  // 2. Build atomic AppleScript: activate via shell + delay + Cmd+V
  //    Each statement is a separate -e flag so osascript parses them correctly
  const escapedBundle = String(target.bundleId || "")
    .replace(/'/g, "'\\''")
    .trim();

  const lines = escapedBundle
    ? [
        `do shell script "open -b '${escapedBundle}'"`,
        `delay 0.5`,
        `tell application "System Events" to keystroke "v" using {command down}`,
      ]
    : [
        `delay 0.15`,
        `tell application "System Events" to keystroke "v" using {command down}`,
      ];

  const osascriptCmd = lines.map((l) => `-e ${JSON.stringify(l)}`).join(" ");

  const runPaste = (attempt) => {
    console.log(`[Voz Flow] Paste attempt ${attempt}...`);
    exec(`osascript ${osascriptCmd}`, (error, _stdout, stderr) => {
      if (error) {
        console.error(`[Voz Flow] AppleScript FAILED (attempt ${attempt}):`, error.message);
        if (stderr) console.error("[Voz Flow] stderr:", stderr);
        if (attempt < 2) {
          console.log("[Voz Flow] Retrying paste in 600ms...");
          setTimeout(() => runPaste(attempt + 1), 600);
        } else {
          console.log("[Voz Flow] === PASTE END (failed) ===");
          notifyPasteResult(false, `No se pudo pegar en ${targetLabel}`);
        }
      } else {
        console.log(`[Voz Flow] Pasted OK into ${targetLabel}`);
        console.log("[Voz Flow] === PASTE END ===");
        notifyPasteResult(true);
      }
    });
  };

  runPaste(1);
}

function notifyPasteResult(ok, errorMessage) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("paste-result", { ok, error: errorMessage || null });
  }
}

function checkMacPermissions() {
  if (process.platform !== "darwin") {
    return {
      accessibility: true,
      automation: true,
      message: "ok",
    };
  }

  const runProbe = (script) => {
    try {
      execSync(`osascript -e ${JSON.stringify(script)}`, { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  };

  const accessibility = runProbe(
    'tell application "System Events" to get name of first application process whose frontmost is true',
  );
  const automation = runProbe(
    'tell application "System Events" to keystroke ""',
  );

  let message = "ok";
  if (!accessibility) message = "Falta permiso de Accesibilidad";
  else if (!automation) message = "Falta permiso de Automatizacion";

  return { accessibility, automation, message };
}

function openMacPrivacyPane(section) {
  if (process.platform !== "darwin") return;

  const pane =
    section === "automation"
      ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
      : "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

  shell.openExternal(pane);
}

// === UNIFIED STATE MANAGEMENT (ported from SFlow) ===
function setAppState(newState) {
  if (stateTimeoutId) {
    clearTimeout(stateTimeoutId);
    stateTimeoutId = null;
  }

  currentAppState = newState;

  // Update pill window
  if (indicatorWindow && !indicatorWindow.isDestroyed()) {
    indicatorWindow.webContents.send("pill-state", newState);

    if (newState === AppState.IDLE) {
      // Keep pill visible but small
      indicatorWindow.showInactive();
    } else {
      indicatorWindow.setAlwaysOnTop(true, "screen-saver");
      indicatorWindow.showInactive();
    }
  }

  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("app-state-changed", newState);
  }

  // Auto-transition for done/error states (SFlow pattern)
  if (newState === AppState.DONE) {
    stateTimeoutId = setTimeout(() => setAppState(AppState.IDLE), 800);
  } else if (newState === AppState.ERROR) {
    stateTimeoutId = setTimeout(() => setAppState(AppState.IDLE), 1200);
  }

  // Sync shortcutRecordingState
  shortcutRecordingState = newState === AppState.RECORDING;
}

function updateIndicatorUI(state) {
  // Legacy compatibility — map old calls to new state system
  if (state === "recording") setAppState(AppState.RECORDING);
  else if (state === "processing") setAppState(AppState.PROCESSING);
  else if (state === "done") setAppState(AppState.DONE);
  else if (state === "error") setAppState(AppState.ERROR);
  else setAppState(AppState.IDLE);
}

function setIndicatorVisible(isRecording) {
  if (isRecording) {
    setAppState(AppState.RECORDING);
  } else if (currentAppState === AppState.RECORDING) {
    // Only go idle if we were recording (not if processing)
    setAppState(AppState.IDLE);
  }
}

function dispatchToggleRecordingToRenderer() {
  const sendToggle = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("toggle-recording");
    }
  };

  if (!mainWindow || mainWindow.isDestroyed()) {
    // Create window silently (no show/focus) — just need it for IPC
    createWindow({ silent: true });
    mainWindow.webContents.once("did-finish-load", sendToggle);
    return;
  }

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", sendToggle);
    return;
  }

  sendToggle();
}

function updateTrayTooltip() {
  if (!tray) return;
  const shortcutHint = activeShortcut ? ` (${activeShortcut})` : "";
  tray.setToolTip(`Voz Flow - Dictado AI${shortcutHint}`);
}

function registerRecordingShortcut(preferredShortcut, allowFallback = true) {
  if (activeShortcut) {
    globalShortcut.unregister(activeShortcut);
    activeShortcut = null;
  }

  const candidates = [];
  if (preferredShortcut) candidates.push(preferredShortcut);
  if (allowFallback) {
    defaultShortcuts.forEach((shortcut) => {
      if (!candidates.includes(shortcut)) candidates.push(shortcut);
    });
  }

  for (const shortcut of candidates) {
    const ok = globalShortcut.register(shortcut, () => {
      const wasRecording = shortcutRecordingState;
      shortcutRecordingState = !shortcutRecordingState;

      // Capture target app ONLY when STARTING recording (not when stopping)
      // This preserves the original chat app even if focus changed during recording
      if (!wasRecording && shortcutRecordingState) {
        try {
          if (process.platform === "darwin") {
            const focused = captureFrontmostApp();
            if (focused.bundleId && focused.bundleId !== selfBundleId) {
              lastTargetAppBundleId = focused.bundleId;
              lastTargetAppName = focused.appName;
              console.log(`[Voz Flow] Target captured on START: ${focused.appName} (${focused.bundleId})`);
            }
          }
        } catch (err) {
          console.error("[Voz Flow] Error capturing target (non-fatal):", err.message);
        }
      }

      setIndicatorVisible(shortcutRecordingState);
      dispatchToggleRecordingToRenderer();
    });

    if (ok) {
      activeShortcut = shortcut;
      updateTrayTooltip();
      return shortcut;
    }
  }

  updateTrayTooltip();
  return null;
}

function getDockIconPath() {
  if (isDev) {
    return path.join(__dirname, "../public/icon.png");
  }

  const prodPng = path.join(process.resourcesPath, "icon.png");
  const prodIcns = path.join(process.resourcesPath, "icon.icns");
  return require("fs").existsSync(prodPng) ? prodPng : prodIcns;
}

function createTray() {
  if (tray) return; // Already created
  const iconPath = isDev
    ? path.join(__dirname, "../public/tray-icon.png")
    : path.join(__dirname, "../out/tray-icon.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: "Mostrar Voz Flow", click: () => mainWindow.show() },
    {
      label: "Abrir al iniciar sesión",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          path: app.getPath("exe"),
        });
      },
    },
    { type: "separator" },
    {
      label: "Salir",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  updateTrayTooltip();
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      return;
    }

    if (mainWindow.webContents.isCrashed()) {
      mainWindow.reload();
    }

    if (mainWindow.webContents.getURL() === "about:blank") {
      mainWindow.reload();
    }

    mainWindow.show();
    mainWindow.focus();
  });
}

function createIndicatorWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  indicatorWindow = new BrowserWindow({
    width: 32,
    height: 28,
    x: Math.round(screenW / 2 - 16),
    y: screenH - 50,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "pill-preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  indicatorWindow.setAlwaysOnTop(true, "screen-saver");
  indicatorWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  indicatorWindow.loadFile(path.join(__dirname, "pill.html"));

  indicatorWindow.once("ready-to-show", () => {
    indicatorWindow.showInactive();
  });
}

// pill-resize handler — registered once at module scope
ipcMain.on("pill-resize", (event, width, height) => {
  if (indicatorWindow && !indicatorWindow.isDestroyed()) {
    indicatorWindow.setSize(Math.max(32, Math.round(width)), Math.round(height));
  }
});

function createWindow({ silent = false } = {}) {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0A0A0B",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });
  mainWindow = win;

  const prodDashboardHtml = path.join(__dirname, "../out/dashboard.html");
  const prodDashboardIndex = path.join(
    __dirname,
    "../out/dashboard/index.html",
  );
  const prodFallback = path.join(__dirname, "../out/index.html");
  const prodFile = fs.existsSync(prodDashboardHtml)
    ? prodDashboardHtml
    : fs.existsSync(prodDashboardIndex)
      ? prodDashboardIndex
      : prodFallback;

  const url = isDev ? "http://localhost:3333/dashboard" : `file://${prodFile}`;

  win.loadURL(url);

  win.webContents.on("render-process-gone", () => {
    if (!win.isDestroyed()) {
      win.reload();
    }
  });

  win.on("show", () => {
    if (!win.isDestroyed() && win.webContents.getURL() === "about:blank") {
      win.loadURL(url);
    }
  });

  win.once("ready-to-show", () => {
    if (!win.isDestroyed() && !silent) {
      win.show();
    }
  });

  // Shortcut, tray, and indicator are initialized once from app.whenReady()
  // Not here — createWindow() can be called multiple times

  win.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      if (!win.isDestroyed()) {
        win.hide();
      }
    }
  });

  win.on("closed", () => {
    mainWindow = null;
    if (indicatorWindow && !indicatorWindow.isDestroyed()) {
      indicatorWindow.close();
    }
    indicatorWindow = null;
  });
}

app.whenReady().then(() => {
  initSelfBundleId();
  console.log(`[Voz Flow] Self bundle ID: ${selfBundleId}`);

  // Initialize local SQLite database
  try {
    db = new TranscriptionDB();
    console.log(`[Voz Flow] DB initialized. ${db.count()} transcriptions stored.`);
  } catch (err) {
    console.warn("[Voz Flow] DB init failed (history disabled):", err.message);
  }

  // Load double-tap settings and start listener
  const settings = loadSettings();
  doubleTapEnabled = settings.doubleTapEnabled !== false;
  try {
    startDoubleTapListener();
  } catch (err) {
    console.error("[Voz Flow] Failed to start double-tap listener:", err.message);
  }

  if (process.platform === "darwin" && app.dock) {
    try {
      app.dock.setIcon(getDockIconPath());
    } catch (error) {
      console.error("No se pudo aplicar el icono del Dock:", error);
    }
  }

  createWindow({ silent: true });

  // Register shortcut, tray, and indicator ONCE here (not inside createWindow)
  const savedShortcut = loadSavedShortcut();
  const normalizedSaved = normalizeShortcut(savedShortcut);
  const preferredShortcut = normalizedSaved.ok ? normalizedSaved.shortcut : null;
  registerRecordingShortcut(preferredShortcut, true);
  createTray();
  createIndicatorWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  // Stop uiohook keyboard listener
  try { uIOhook.stop(); } catch { /* ignore */ }
  if (tray) {
    tray.destroy();
    tray = null;
  }
  if (indicatorWindow && !indicatorWindow.isDestroyed()) {
    indicatorWindow.destroy();
  }
  // Close SQLite DB
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    db = null;
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

ipcMain.handle("get-shortcut", () => {
  const savedShortcut = loadSavedShortcut();
  const normalizedSaved = normalizeShortcut(savedShortcut);
  return (
    activeShortcut ||
    (normalizedSaved.ok ? normalizedSaved.shortcut : defaultShortcuts[0])
  );
});

ipcMain.handle("get-shortcut-diagnostics", () => {
  return {
    activeShortcut,
    registered: Boolean(
      activeShortcut && globalShortcut.isRegistered(activeShortcut),
    ),
    fallbackPool: defaultShortcuts,
  };
});

ipcMain.handle("force-toggle-recording", () => {
  shortcutRecordingState = !shortcutRecordingState;
  setIndicatorVisible(shortcutRecordingState);
  dispatchToggleRecordingToRenderer();
  return { ok: true };
});

ipcMain.handle("set-shortcut", (event, rawShortcut) => {
  const normalized = normalizeShortcut(rawShortcut);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error };
  }

  const shortcut = normalized.shortcut;
  const registered = registerRecordingShortcut(shortcut, false);
  if (!registered) {
    registerRecordingShortcut(loadSavedShortcut(), true);
    return {
      ok: false,
      error:
        "Atajo no válido o en uso por otra app. Prueba CommandOrControl+Alt+R.",
    };
  }

  saveSettings({ shortcut: registered });
  return { ok: true, shortcut: registered };
});

ipcMain.handle("get-api-key", () => {
  return loadSavedApiKey();
});

ipcMain.handle("set-api-key", (event, rawApiKey) => {
  const apiKey = String(rawApiKey || "").trim();
  if (!apiKey) {
    return { ok: false, error: "La API key no puede estar vacía" };
  }

  const saved = saveSettings({ groqApiKey: apiKey });
  if (!saved) {
    return { ok: false, error: "No se pudo guardar la API key" };
  }

  return { ok: true };
});

ipcMain.handle("check-mac-permissions", () => {
  return checkMacPermissions();
});

ipcMain.handle("open-mac-privacy-pane", (event, section) => {
  openMacPrivacyPane(section);
  return { ok: true };
});

ipcMain.handle("schedule-paste-test", (event, rawDelayMs) => {
  const delayMs = Math.max(1000, Math.min(7000, Number(rawDelayMs) || 3000));

  setTimeout(() => {
    if (process.platform === "darwin") {
      const focused = captureFrontmostApp();
      if (focused.bundleId && focused.bundleId !== selfBundleId) {
        lastTargetAppBundleId = focused.bundleId;
        lastTargetAppName = focused.appName;
      }
      pasteTextOnMac("[Voz Flow] prueba de pegado OK");
    }
  }, delayMs);

  return { ok: true, delayMs };
});

// === DATABASE IPC HANDLERS ===
ipcMain.handle("db-insert", (_, record) => {
  if (!db) return null;
  return db.insert(record);
});

ipcMain.handle("db-get-recent", (_, limit) => {
  if (!db) return [];
  return db.getRecent(limit || 50);
});

ipcMain.handle("db-search", (_, query, limit) => {
  if (!db) return [];
  return db.search(query, limit || 50);
});

ipcMain.handle("db-count", () => {
  if (!db) return 0;
  return db.count();
});

ipcMain.handle("db-delete", (_, id) => {
  if (!db) return false;
  return db.deleteById(id);
});

// === AUDIO DATA FORWARDING (renderer → pill) ===
ipcMain.on("audio-data", (event, barValues) => {
  const now = Date.now();
  if (now - lastAudioForward < AUDIO_FORWARD_INTERVAL) return;
  lastAudioForward = now;

  if (indicatorWindow && !indicatorWindow.isDestroyed()) {
    indicatorWindow.webContents.send("pill-audio-data", barValues);
  }
});

// === DOUBLE-TAP SETTINGS ===
ipcMain.handle("get-doubletap-settings", () => {
  const settings = loadSettings();
  return {
    enabled: settings.doubleTapEnabled !== false,
    interval: settings.doubleTapInterval || DOUBLE_TAP_INTERVAL,
  };
});

ipcMain.handle("set-doubletap-settings", (_, newSettings) => {
  doubleTapEnabled = newSettings.enabled !== false;
  saveSettings({
    doubleTapEnabled: doubleTapEnabled,
    doubleTapInterval: newSettings.interval || DOUBLE_TAP_INTERVAL,
  });
  return { ok: true };
});

ipcMain.on("recording-state", (event, isRecording) => {
  shortcutRecordingState = Boolean(isRecording);
  setIndicatorVisible(shortcutRecordingState);
});

ipcMain.on("type-text", (event, text) => {
  console.log("[Voz Flow] type-text received, length:", (text || "").length);

  if (process.platform === "win32") {
    // Mejorado para Windows: Usamos portapapeles y pegado para evitar problemas de caracteres
    const escapedText = text.replace(/"/g, '`"').replace(/\n/g, " ");
    const psCommand = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText("${escapedText}"); [System.Windows.Forms.SendKeys]::SendWait("^v")`;

    exec(`powershell -Command "${psCommand}"`, (error) => {
      if (error) console.error("Error typing text (Windows):", error);
    });
  } else if (process.platform === "darwin") {
    pasteTextOnMac(text);
  }
});

ipcMain.on("set-indicator-state", (event, state) => {
  updateIndicatorUI(state);
});

ipcMain.handle(
  "transcribe-audio",
  async (event, audioBuffer, rawFlowConfig) => {
    try {
      // Validate audio buffer is not empty or too small (<1KB likely silence)
      if (!audioBuffer || audioBuffer.byteLength < 1000) {
        console.log("[Voz Flow] Audio too short/empty, skipping transcription");
        setAppState(AppState.IDLE);
        return { original: "", refined: "" };
      }

      const apiKey = process.env.GROQ_API_KEY || loadSavedApiKey();
      if (!apiKey) {
        throw new Error(
          "Falta GROQ_API_KEY. Abre Dashboard y guarda tu API key de Groq en Configuracion.",
        );
      }

      const Groq = require("groq-sdk");
      const groq = new Groq({
        apiKey,
      });

      // Helper: race a promise against a timeout
      const withTimeout = (promise, ms, label) =>
        Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${label} tardo mas de ${ms / 1000}s`)), ms),
          ),
        ]);

      // 1. Transcribir con Groq Whisper
      var _tempPath = path.join(
        app.getPath("temp"),
        `audio_${Date.now()}.webm`,
      );
      fs.writeFileSync(_tempPath, Buffer.from(audioBuffer));

      const transcription = await withTimeout(
        groq.audio.transcriptions.create({
          file: fs.createReadStream(_tempPath),
          model: "whisper-large-v3",
          response_format: "verbose_json",
          language: "es",
          prompt: "Transcripcion de dictado por voz en español.",
        }),
        30000,
        "Transcripcion",
      );

      const originalText = (transcription.text || "").trim();

      // Skip refinement if Whisper returned nothing
      if (!originalText) {
        setAppState(AppState.IDLE);
        return { original: "", refined: "" };
      }

      const flowConfig = sanitizeFlowConfig(rawFlowConfig);

      // 2. Refinar con Llama 3
      const chatCompletion = await withTimeout(
        groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: buildFlowSystemPrompt(flowConfig),
            },
            {
              role: "user",
              content: originalText,
            },
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
        }),
        15000,
        "Refinamiento",
      );

      const refinedText = chatCompletion.choices[0]?.message?.content || originalText;
      console.log("[Voz Flow] Refinamiento completado. Caracteres:", refinedText.length);

      // Auto-save to local SQLite DB
      try {
        if (db) {
          db.insert({
            originalText,
            refinedText,
            language: transcription.language || null,
            durationSeconds: transcription.duration || null,
            model: "whisper-large-v3",
          });
          console.log("[Voz Flow] Transcripcion guardada en DB local");
        }
      } catch (dbErr) {
        console.error("[Voz Flow] Error guardando en DB (non-fatal):", dbErr.message);
      }

      // Transition to DONE state
      setAppState(AppState.DONE);

      return {
        original: originalText,
        refined: refinedText,
      };
    } catch (error) {
      console.error("[Voz Flow] Error en transcribe-audio (Electron):", error);
      setAppState(AppState.ERROR);

      if (error.status === 403 || (error.message && error.message.includes("403"))) {
        throw new Error(
          "Error 403 (Acceso Denegado) de Groq. Esto suele ocurrir por:\n" +
          "1. API Key inválida o caducada.\n" +
          "2. Tu región está bloqueada por Groq.\n" +
          "3. Estás usando una VPN o Proxy que Groq está bloqueando.\n\n" +
          "Por favor, revisa tu conexión y prueba a generar una nueva API Key en console.groq.com."
        );
      }
      throw error;
    } finally {
      // Always clean up temp audio file
      if (_tempPath) { try { fs.unlinkSync(_tempPath); } catch { } }
    }
  },
);
