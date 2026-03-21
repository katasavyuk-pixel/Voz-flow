/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  onToggleRecording: (callback) => ipcRenderer.on("toggle-recording", callback),
  typeText: (text) => ipcRenderer.send("type-text", text),
  onTypeTextSuccess: (callback) =>
    ipcRenderer.on("type-text-success", callback),
  onTypeTextError: (callback) =>
    ipcRenderer.on("type-text-error", (event, errorMessage) =>
      callback(errorMessage),
    ),
  setRecordingState: (isRecording) =>
    ipcRenderer.send("recording-state", isRecording),
  transcribeAudio: (audioBuffer) =>
    ipcRenderer.invoke("transcribe-audio", audioBuffer),
});
