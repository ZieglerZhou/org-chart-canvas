const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data, defaultName) => ipcRenderer.invoke('save-file', data, defaultName),
  openFile: (filters) => ipcRenderer.invoke('open-file', filters),
});
