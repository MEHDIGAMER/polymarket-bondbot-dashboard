const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bondbot', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:set', s),
  api: (path) => ipcRenderer.invoke('api:get', path),
  onStreamEvent: (cb) => ipcRenderer.on('stream:event', (_e, p) => cb(p)),
  onStreamStatus: (cb) => ipcRenderer.on('stream:status', (_e, p) => cb(p)),
});
