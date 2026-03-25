const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  // --- Existing ---
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

  // --- NEW: App state listener ---
  onAppStateChanged: (callback) => {
    const listener = (_, state) => callback(state);
    ipcRenderer.on("app-state-changed", listener);
    return () => ipcRenderer.removeListener("app-state-changed", listener);
  },

  // --- NEW: Audio data (renderer → main → pill) ---
  sendAudioData: (barValues) => ipcRenderer.send("audio-data", barValues),

  // --- NEW: Local SQLite DB ---
  dbInsert: (record) => ipcRenderer.invoke("db-insert", record),
  dbGetRecent: (limit) => ipcRenderer.invoke("db-get-recent", limit),
  dbSearch: (query, limit) => ipcRenderer.invoke("db-search", query, limit),
  dbCount: () => ipcRenderer.invoke("db-count"),
  dbDelete: (id) => ipcRenderer.invoke("db-delete", id),

  // --- NEW: Double-tap settings ---
  getDoubleTapSettings: () => ipcRenderer.invoke("get-doubletap-settings"),
  setDoubleTapSettings: (settings) =>
    ipcRenderer.invoke("set-doubletap-settings", settings),
});
