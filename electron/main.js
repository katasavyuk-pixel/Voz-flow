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

let mainWindow;
let indicatorWindow;
let tray = null;
let activeShortcut = null;
let lastTargetAppBundleId = null;
let lastTargetAppName = null;
let shortcutRecordingState = false;
app.isQuitting = false;
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

  return `Eres un motor de transcripcion y edicion de voz de alto rendimiento llamado "Flow".
Tu unica funcion es transformar texto hablado crudo en texto escrito limpio, pulido y perfectamente formateado, manteniendo al 100% el sentido e intencion original.

NO eres un chatbot. NO respondes preguntas. NO das opiniones. NO anades informacion. SOLO editas.

REGLAS OBLIGATORIAS:
1) Elimina muletillas y relleno (eh, um, mmm, bueno, o sea, tipo, es que, digamos, como que, etc.).
2) Corrige ortografia y gramatica sin cambiar significado.
3) Reestructura frases confusas para claridad, sin alterar intencion.
4) Formatea con puntuacion, parrafos y estructura natural.
5) Mantiene la personalidad y registro del hablante (formal/informal).
6) NO inventes informacion y NO cambies el sentido.
7) Si el texto es corto o ambiguo, devuelve igual o con correcciones minimas.

TONO/CONTEXTO:
Detecta automaticamente el contexto (email, chat, Slack, nota personal, tecnico, red social, legal, atencion al cliente, creativo, academico) y ajusta tono en consecuencia.
Si no es claro, usa neutral-profesional.

MULTILINGUE:
Detecta idioma automaticamente y responde en el mismo idioma.
Si hay cambio de idioma dentro del dictado, conserva cada seccion en su idioma.

COMANDOS DE VOZ ESPECIALES (si aparecen en el dictado, ejecutalos):
- "borra eso" / "eliminar eso": elimina la ultima oracion o fragmento previo.
- "en negrita [texto]": aplica negrita solo a ese fragmento.
- "hace una lista con...": convierte lo siguiente en lista.
- "nuevo parrafo": inserta salto de parrafo.
- "tono mas formal": rehace con tono mas formal.
- "tono mas casual": rehace con tono mas casual.
- "resumi esto": entrega un resumen conciso del dictado.
- "agrega un asunto": genera una linea de asunto si corresponde a email.
- "ponelo en modo email": formatea como email profesional con saludo, cuerpo y cierre.
- "puntos clave": extrae y lista los puntos principales.
${dictionaryBlock}${snippetsBlock}

SALIDA:
- Devuelve SOLO el texto final editado listo para usar.
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
  try {
    const bid = app.getBundleID();
    if (bid) { selfBundleId = bid; return; }
  } catch { /* ignore */ }

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
    return;
  }

  // 2. Build a SINGLE atomic AppleScript: activate via shell + delay + Cmd+V
  //    No setTimeout — everything runs inside osascript so nothing can steal focus in between
  const escapedBundle = String(target.bundleId || "")
    .replace(/'/g, "'\\''")
    .trim();

  const activateLine = escapedBundle
    ? `do shell script "open -b '${escapedBundle}'"
       delay 0.3`
    : "delay 0.1";

  const appleScript = `
    ${activateLine}
    tell application "System Events" to keystroke "v" using {command down}
  `;

  console.log("[Voz Flow] Running atomic AppleScript (activate + paste)...");
  exec(`osascript -e ${JSON.stringify(appleScript)}`, (error, _stdout, stderr) => {
    if (error) {
      console.error("[Voz Flow] AppleScript FAILED:", error.message);
      if (stderr) console.error("[Voz Flow] stderr:", stderr);
    } else {
      console.log(`[Voz Flow] Pasted OK into ${targetLabel}`);
    }
    console.log("[Voz Flow] === PASTE END ===");
  });
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

function updateIndicatorUI(state) {
  if (!indicatorWindow || indicatorWindow.isDestroyed()) return;

  const config = {
    recording: {
      color: "#ef4444",
      glow: "rgba(239, 68, 68, 0.7)",
      text: "Voz Flow Grabando",
      showWave: true,
      borderColor: "rgba(239, 68, 68, 0.5)",
    },
    processing: {
      color: "#a855f7",
      glow: "rgba(168, 85, 247, 0.7)",
      text: "Groq AI Procesando...",
      showWave: false,
      borderColor: "rgba(168, 85, 247, 0.6)",
    },
  };

  const current = config[state];
  if (!current) {
    indicatorWindow.hide();
    return;
  }

  const js = `
    document.querySelector('.dot').style.background = '${current.color}';
    document.querySelector('.dot').style.boxShadow = '0 0 15px ${current.glow}';
    document.querySelector('.text').innerText = '${current.text}';
    document.querySelector('.wave').style.display = '${current.showWave ? "flex" : "none"}';
    document.querySelector('.container').style.borderColor = '${current.borderColor}';
  `;

  indicatorWindow.webContents.executeJavaScript(js);

  if (state === "recording" || state === "processing") {
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    indicatorWindow.setPosition(Math.round(width / 2 - 160), 40);
    indicatorWindow.setAlwaysOnTop(true, "screen-saver");
    indicatorWindow.showInactive();
  }
}

function setIndicatorVisible(isRecording) {
  updateIndicatorUI(isRecording ? "recording" : "off");
}

function dispatchToggleRecordingToRenderer() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  const sendToggle = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("toggle-recording");
    }
  };

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
      // Toggle recording FIRST (instant feedback), then capture target app
      shortcutRecordingState = !shortcutRecordingState;
      setIndicatorVisible(shortcutRecordingState);
      dispatchToggleRecordingToRenderer();

      // Capture target app in background — never blocks UI
      try {
        if (process.platform === "darwin") {
          const focused = captureFrontmostApp();
          if (focused.bundleId && focused.bundleId !== selfBundleId) {
            lastTargetAppBundleId = focused.bundleId;
            lastTargetAppName = focused.appName;
            console.log(`[Voz Flow] Target: ${focused.appName} (${focused.bundleId})`);
          }
        }
      } catch (err) {
        console.error("[Voz Flow] Error capturing target (non-fatal):", err.message);
      }
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
  indicatorWindow = new BrowserWindow({
    width: 320,
    height: 70,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const htmlContent = `
    <style>
      body { margin: 0; padding: 0; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      .container { 
        display: flex; align-items: center; justify-content: center; gap: 12px;
        background: rgba(10, 10, 11, 0.9); 
        border: 1px solid rgba(168, 85, 247, 0.5);
        border-radius: 50px; height: 50px; padding: 0 24px;
        backdrop-filter: blur(15px); color: white;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 15px rgba(168, 85, 247, 0.2);
      }
      .dot { width: 10px; height: 10px; background: #ef4444; border-radius: 50%; animation: pulse 1.2s infinite; }
      .text { font-weight: 800; font-size: 12px; letter-spacing: 1px; color: #f3f4f6; text-transform: uppercase; }
      @keyframes pulse { 0% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { opacity: 0.5; transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
      .wave { display: flex; align-items: center; gap: 4px; }
      .bar { width: 3px; height: 12px; background: linear-gradient(to bottom, #a855f7, #06b6d4); border-radius: 10px; animation: wave 0.8s infinite alternate ease-in-out; }
      @keyframes wave { from { height: 6px; transform: scaleY(0.8); } to { height: 18px; transform: scaleY(1.2); } }
    </style>
    <div class="container">
      <div class="dot"></div>
      <div class="text">SoyVOZ Grabando</div>
      <div class="wave">
        <div class="bar" style="animation-delay: 0s"></div>
        <div class="bar" style="animation-delay: 0.15s"></div>
        <div class="bar" style="animation-delay: 0.3s"></div>
        <div class="bar" style="animation-delay: 0.45s"></div>
      </div>
    </div>
  `;

  indicatorWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`,
  );
}

function createWindow() {
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
    if (!win.isDestroyed()) {
      win.show();
    }
  });

  const savedShortcut = loadSavedShortcut();
  const normalizedSaved = normalizeShortcut(savedShortcut);
  const preferredShortcut = normalizedSaved.ok
    ? normalizedSaved.shortcut
    : null;
  registerRecordingShortcut(preferredShortcut, true);

  createTray();
  createIndicatorWindow();

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

  if (process.platform === "darwin" && app.dock) {
    try {
      app.dock.setIcon(getDockIconPath());
    } catch (error) {
      console.error("No se pudo aplicar el icono del Dock:", error);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (tray) {
    tray.destroy();
    tray = null;
  }
  if (indicatorWindow && !indicatorWindow.isDestroyed()) {
    indicatorWindow.destroy();
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

ipcMain.on("recording-state", (event, isRecording) => {
  shortcutRecordingState = Boolean(isRecording);
  setIndicatorVisible(shortcutRecordingState);
});

ipcMain.on("type-text", (event, text) => {
  console.log("Typing text parity:", text.substring(0, 20) + "...");

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

      // 1. Transcribir con Groq Whisper
      const tempPath = path.join(
        app.getPath("temp"),
        `audio_${Date.now()}.webm`,
      );
      fs.writeFileSync(tempPath, Buffer.from(audioBuffer));

      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: "whisper-large-v3",
        response_format: "verbose_json",
      });

      const originalText = transcription.text;
      const flowConfig = sanitizeFlowConfig(rawFlowConfig);

      // 2. Refinar con Llama 3
      const chatCompletion = await groq.chat.completions.create({
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
      });

      try {
        fs.unlinkSync(tempPath);
      } catch (e) { }

      console.log("[Voz Flow] Refinamiento completado. Caracteres:", chatCompletion.choices[0]?.message?.content?.length || 0);

      return {
        original: originalText,
        refined: chatCompletion.choices[0]?.message?.content || originalText,
      };
    } catch (error) {
      console.error("[Voz Flow] Error en transcribe-audio (Electron):", error);

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
    }
  },
);
