/* eslint-disable @typescript-eslint/no-require-imports */
const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  clipboard,
} = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const { exec } = require("child_process");

let mainWindow;
let indicatorWindow;
let tray = null;

function createTray() {
  // Usamos un circulo purpura como icono temporal si no hay uno real
  const iconPath = path.join(__dirname, "../public/favicon.ico");
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

  tray.setToolTip("Voz Flow - Dictado AI");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      return;
    }

    mainWindow.show();
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
      nodeIntegration: false,
      contextIsolation: true,
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
      <div class="text">Voz Flow Grabando</div>
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
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../out/index.html")}`;

  mainWindow.loadURL(url);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Atajo Global Principal (dictado rápido)
  // Windows: Ctrl+Shift+D, Mac: Cmd+Shift+D
  const primaryShortcut = "CommandOrControl+Shift+D";

  globalShortcut.register(primaryShortcut, () => {
    mainWindow.webContents.send("toggle-recording");
  });

  // Atajo de respaldo para evitar conflictos del sistema
  // Windows: Ctrl+Alt+D, Mac: Cmd+Option+Shift+D
  const backupShortcut =
    process.platform === "win32"
      ? "Ctrl+Alt+D"
      : "CommandOrControl+Alt+Shift+D";
  globalShortcut.register(backupShortcut, () => {
    mainWindow.webContents.send("toggle-recording");
  });

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
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("recording-state", (event, isRecording) => {
  if (indicatorWindow) {
    if (isRecording) {
      const { width } = screen.getPrimaryDisplay().workAreaSize;
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
  console.log("Pasting text via clipboard:", text.substring(0, 30) + "...");

  // Write text to clipboard
  clipboard.writeText(text);

  const timeout = setTimeout(() => {
    event.sender.send("type-text-error", "Timeout al pegar texto");
  }, 5000);

  const handleSuccess = () => {
    clearTimeout(timeout);
    event.sender.send("type-text-success");
  };

  const handleError = (error) => {
    clearTimeout(timeout);
    console.error("Error pasting text:", error);
    event.sender.send("type-text-error", error.message || "Error al pegar texto");
  };

  if (process.platform === "darwin") {
    // macOS: Simulate Cmd+V using AppleScript
    const cmd = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`;
    exec(cmd, (error) => {
      if (error) {
        handleError(error);
      } else {
        handleSuccess();
      }
    });
  } else if (process.platform === "win32") {
    // Windows: Simulate Ctrl+V using PowerShell SendKeys
    const psScript = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")`;
    exec(`powershell -Command "${psScript}"`, (error) => {
      if (error) {
        handleError(error);
      } else {
        handleSuccess();
      }
    });
  } else {
    // Linux: Use xdotool for Ctrl+V
    exec("xdotool key ctrl+v", (error) => {
      if (error) {
        handleError(error);
      } else {
        handleSuccess();
      }
    });
  }
});

ipcMain.handle("transcribe-audio", async (event, audioBuffer) => {
  const fs = require("fs");
  const MAX_RETRIES = 3;
  const BACKOFF_MS = [1000, 2000, 4000];

  // Check for API key
  if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY not found in environment variables");
    throw new Error("API key de Groq no configurada. Revisa la configuración.");
  }

  const Groq = require("groq-sdk");
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const tempPath = path.join(app.getPath("temp"), `audio_${Date.now()}.webm`);
  fs.writeFileSync(tempPath, Buffer.from(audioBuffer));

  const cleanupTemp = () => {
    try {
      fs.unlinkSync(tempPath);
    } catch (e) {
      console.warn("Could not delete temp file:", e.message);
    }
  };

  const attemptTranscription = async (attempt) => {
    try {
      console.log(`Transcription attempt ${attempt + 1}/${MAX_RETRIES}`);

      // 1. Transcribe with Groq Whisper
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: "whisper-large-v3",
        response_format: "verbose_json",
        language: "es",
      });

      const originalText = transcription.text;

      // 2. Refine with Llama 3
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "Eres un transcriptor de alta fidelidad. Tu objetivo es convertir el audio en texto EXACTAMENTE como fue dicho. REGLAS: 1. Mantén todas las palabras originales. 2. Respeta acentos y puntuación. 3. Elimina muletillas extremas. 4. NO resumas, NO parafrasees. Responde solo con el texto transcrito.",
          },
          {
            role: "user",
            content: originalText,
          },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
      });

      return {
        original: originalText,
        refined: chatCompletion.choices[0]?.message?.content || originalText,
      };
    } catch (error) {
      console.error(`Transcription attempt ${attempt + 1} failed:`, error.message);

      if (attempt < MAX_RETRIES - 1) {
        const delay = BACKOFF_MS[attempt];
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return attemptTranscription(attempt + 1);
      }

      throw error;
    }
  };

  try {
    const result = await attemptTranscription(0);
    cleanupTemp();
    return result;
  } catch (error) {
    cleanupTemp();
    console.error("Error en transcribe-audio (Electron):", error);
    throw new Error(`Transcripción fallida: ${error.message}`);
  }
});
