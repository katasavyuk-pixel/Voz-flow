const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { exec } = require('child_process');

let mainWindow;
let indicatorWindow;

function createIndicatorWindow() {
    indicatorWindow = new BrowserWindow({
        width: 300,
        height: 80,
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

    // HTML simple para el indicador de grabación
    const htmlContent = `
    <style>
      body { margin: 0; padding: 0; overflow: hidden; font-family: sans-serif; }
      .container { 
        display: flex; align-items: center; justify-content: center; gap: 10px;
        background: rgba(10, 10, 11, 0.85); 
        border: 1px solid rgba(168, 85, 247, 0.4);
        border-radius: 40px; height: 60px; padding: 0 20px;
        backdrop-filter: blur(10px); color: white;
        box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
      }
      .dot { width: 12px; height: 12px; background: #ef4444; border-radius: 50%; animation: pulse 1s infinite; }
      .text { font-weight: bold; font-size: 14px; letter-spacing: 0.5px; }
      @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
      .wave { display: flex; align-items: center; gap: 3px; }
      .bar { width: 3px; height: 15px; background: #a855f7; border-radius: 10px; animation: wave 1s infinite alternate; }
      @keyframes wave { from { height: 5px; } to { height: 20px; } }
    </style>
    <div class="container">
      <div class="dot"></div>
      <div class="text">SOYVOZ GRABANDO...</div>
      <div class="wave">
        <div class="bar" style="animation-delay: 0s"></div>
        <div class="bar" style="animation-delay: 0.2s"></div>
        <div class="bar" style="animation-delay: 0.4s"></div>
      </div>
    </div>
  `;

    indicatorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        titleBarStyle: 'hidden',
        backgroundColor: '#0A0A0B',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    const url = isDev
        ? 'http://localhost:3000'
        : `file://${path.join(__dirname, '../out/index.html')}`;

    mainWindow.loadURL(url);

    // Atajos globales
    // Nota: 'Control' suele fallar como atajo único en Windows. 
    // Usaremos 'Alt+Space' o 'F8' que son muy rápidos y estables.
    // Pero intentaremos 'CommandOrControl+Shift+S' como estándar profesional.
    const shortcut = 'Alt+Space';

    globalShortcut.register(shortcut, () => {
        mainWindow.webContents.send('toggle-recording');
    });

    createIndicatorWindow();

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (indicatorWindow) indicatorWindow.close();
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC para mostrar/ocultar indicador
ipcMain.on('recording-state', (event, isRecording) => {
    if (indicatorWindow) {
        if (isRecording) {
            const { width, height } = screen.getPrimaryDisplay().workAreaSize;
            indicatorWindow.setPosition(width / 2 - 150, 50); // Arriba al centro
            indicatorWindow.show();
        } else {
            indicatorWindow.hide();
        }
    }
});

ipcMain.on('type-text', (event, text) => {
    if (process.platform === 'win32') {
        const escapedText = text.replace(/"/g, '`"').replace(/\n/g, ' ');
        const psCommand = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText("${escapedText}"); [System.Windows.Forms.SendKeys]::SendWait("^v")`;

        exec(`powershell -Command "${psCommand}"`, (error) => {
            if (error) console.error('Error typing text (Windows):', error);
        });
    } else if (process.platform === 'darwin') {
        const escapedText = text.replace(/"/g, '\\"').replace(/'/g, "'\\''");
        const appleScript = `
            set the clipboard to "${escapedText}"
            tell application "System Events"
                keystroke "v" using {command down}
            end tell
        `;

        exec(`osascript -e '${appleScript}'`, (error) => {
            if (error) console.error('Error typing text (Mac):', error);
        });
    } else {
        console.warn('Text typing is not supported on this platform:', process.platform);
    }
});
