const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pillBridge", {
  onStateChange: (callback) => {
    ipcRenderer.on("pill-state", (_, state) => callback(state));
  },
  onAudioData: (callback) => {
    ipcRenderer.on("pill-audio-data", (_, data) => callback(data));
  },
  requestResize: (width, height) => {
    ipcRenderer.send("pill-resize", width, height);
  },
});
