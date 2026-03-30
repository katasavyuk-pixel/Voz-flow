const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pillBridge", {
  onStateChange: (callback) => {
    const listener = (_, state) => callback(state);
    ipcRenderer.on("pill-state", listener);
    return () => ipcRenderer.removeListener("pill-state", listener);
  },
  onAudioData: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on("pill-audio-data", listener);
    return () => ipcRenderer.removeListener("pill-audio-data", listener);
  },
  requestResize: (width, height) => {
    ipcRenderer.send("pill-resize", width, height);
  },
});
