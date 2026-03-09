const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  onToggleRecording: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("toggle-recording", listener);
    return () => ipcRenderer.removeListener("toggle-recording", listener);
  },
  typeText: (text) => ipcRenderer.send("type-text", text),
  setRecordingState: (isRecording) =>
    ipcRenderer.send("recording-state", isRecording),
  transcribeAudio: (audioBuffer, flowConfig) =>
    ipcRenderer.invoke("transcribe-audio", audioBuffer, flowConfig),
  getShortcut: () => ipcRenderer.invoke("get-shortcut"),
  getShortcutDiagnostics: () => ipcRenderer.invoke("get-shortcut-diagnostics"),
  setShortcut: (shortcut) => ipcRenderer.invoke("set-shortcut", shortcut),
  forceToggleRecording: () => ipcRenderer.invoke("force-toggle-recording"),
  getApiKey: () => ipcRenderer.invoke("get-api-key"),
  setApiKey: (apiKey) => ipcRenderer.invoke("set-api-key", apiKey),
  checkMacPermissions: () => ipcRenderer.invoke("check-mac-permissions"),
  openMacPrivacyPane: (section) =>
    ipcRenderer.invoke("open-mac-privacy-pane", section),
  setIndicatorState: (state) => ipcRenderer.send("set-indicator-state", state),
  schedulePasteTest: (delayMs) =>
    ipcRenderer.invoke("schedule-paste-test", delayMs),
});
