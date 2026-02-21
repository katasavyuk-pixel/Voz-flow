const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = !app.isPackaged;
const { exec } = require("child_process");

let mainWindow;
let indicatorWindow;
let tray = null;
let activeShortcut = null;
const defaultShortcuts = [
  "CommandOrControl+Shift+Space",
  "Control+Space",
  "Alt+Space",
];

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSavedShortcut() {
  try {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) return null;
    const data = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    return typeof data.shortcut === "string" ? data.shortcut.trim() : null;
  } catch {
    return null;
  }
}

function saveShortcut(shortcut) {
  try {
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify({ shortcut }, null, 2),
      "utf8",
    );
  } catch (error) {
    console.error("No se pudo guardar el atajo:", error);
  }
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
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("toggle-recording");
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

function registerRecordingShortcut() {
  const candidates = [
    "CommandOrControl+Shift+Space",
    "Control+Space",
    "Alt+Space",
  ];

  for (const shortcut of candidates) {
    const ok = globalShortcut.register(shortcut, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("toggle-recording");
      }
    });

    if (ok) {
      activeShortcut = shortcut;
      return shortcut;
    }
  }

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
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  updateTrayTooltip();
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
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
  mainWindow = new BrowserWindow({
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
    },
  });

  const url = isDev
    ? "http://localhost:3333/dashboard"
    : `file://${path.join(__dirname, "../out/dashboard/index.html")}`;

  mainWindow.loadURL(url);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  registerRecordingShortcut(loadSavedShortcut(), true);

  createTray();
  createIndicatorWindow();

  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (indicatorWindow) indicatorWindow.close();
  });
}

app.whenReady().then(() => {
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

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

ipcMain.handle("get-shortcut", () => {
  return activeShortcut || loadSavedShortcut() || defaultShortcuts[0];
});

ipcMain.handle("set-shortcut", (event, rawShortcut) => {
  const shortcut = String(rawShortcut || "").trim();
  if (!shortcut) {
    return { ok: false, error: "Atajo vacío" };
  }

  const registered = registerRecordingShortcut(shortcut, false);
  if (!registered) {
    registerRecordingShortcut(loadSavedShortcut(), true);
    return {
      ok: false,
      error:
        "Atajo no válido o en uso por otra app. Prueba CommandOrControl+Shift+Space.",
    };
  }

  saveShortcut(registered);
  return { ok: true, shortcut: registered };
});

ipcMain.on("recording-state", (event, isRecording) => {
  if (indicatorWindow) {
    if (isRecording) {
      const { width, height } = screen.getPrimaryDisplay().workAreaSize;
      // Posicionamiento inteligente: Arriba al centro
      indicatorWindow.setPosition(Math.round(width / 2 - 160), 40);
      indicatorWindow.setAlwaysOnTop(true, "screen-saver");
      indicatorWindow.showInactive();
    } else {
      indicatorWindow.hide();
    }
  }
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
    const escapedText = text.replace(/"/g, '\\"').replace(/'/g, "'\\''");
    const appleScript = `
            set the clipboard to "${escapedText}"
            tell application "System Events"
                keystroke "v" using {command down}
            end tell
        `;

    exec(`osascript -e '${appleScript}'`, (error) => {
      if (error) console.error("Error typing text (Mac):", error);
    });
  }
});

ipcMain.handle("transcribe-audio", async (event, audioBuffer) => {
  try {
    const Groq = require("groq-sdk");
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // 1. Transcribir con Groq Whisper
    const fs = require("fs");
    const tempPath = path.join(app.getPath("temp"), `audio_${Date.now()}.webm`);
    fs.writeFileSync(tempPath, Buffer.from(audioBuffer));

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3",
      response_format: "verbose_json",
    });

    const originalText = transcription.text;

    // 2. Refinar con Llama 3
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a high-fidelity transcription assistant. Your goal is to convert audio into polished text. RULES: 1. Detect the language (Spanish or English) and respond in the SAME language. 2. Remove filler words (um, uh, eh, am) but keep the speaker's style and personality. 3. Fix grammar and punctuation naturally. 4. Do NOT summarize or paraphrase - keep all the meaning and content. 5. Format into clear, readable text. 6. Output ONLY the cleaned transcription, no explanations.",
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
    } catch (e) {}

    return {
      original: originalText,
      refined: chatCompletion.choices[0]?.message?.content || originalText,
    };
  } catch (error) {
    console.error("Error en transcribe-audio (Electron):", error);
    throw error;
  }
});
