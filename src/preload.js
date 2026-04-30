const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bondbot', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:set', s),
  api: (path) => ipcRenderer.invoke('api:get', path),
});
