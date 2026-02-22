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
  transcribeAudio: (audioBuffer) =>
    ipcRenderer.invoke("transcribe-audio", audioBuffer),
  getShortcut: () => ipcRenderer.invoke("get-shortcut"),
  setShortcut: (shortcut) => ipcRenderer.invoke("set-shortcut", shortcut),
  getApiKey: () => ipcRenderer.invoke("get-api-key"),
  setApiKey: (apiKey) => ipcRenderer.invoke("set-api-key", apiKey),
});
