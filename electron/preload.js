const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    onToggleRecording: (callback) => ipcRenderer.on('toggle-recording', callback),
    typeText: (text) => ipcRenderer.send('type-text', text),
    setRecordingState: (isRecording) => ipcRenderer.send('recording-state', isRecording),
    transcribeAudio: (audioBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer),
});
