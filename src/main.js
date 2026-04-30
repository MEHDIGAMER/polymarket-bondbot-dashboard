const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Persistent settings — saved next to the user's appData
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return { apiUrl: 'http://204.168.195.17:8001', apiKey: '' };
  }
}

function writeSettings(s) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2));
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Strict app menu — no devtools in prod, but keep reload + zoom shortcuts
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open BondBot repo',
          click: () => shell.openExternal('https://github.com/MEHDIGAMER/polymarket-bond-bot'),
        },
      ],
    },
  ]));

  win.loadFile(path.join(__dirname, 'index.html'));
}

// Native fetch is available in Electron 32+ via Node's undici
async function apiFetch(pathSuffix) {
  const s = readSettings();
  const url = `${s.apiUrl.replace(/\/$/, '')}${pathSuffix}`;
  const headers = {};
  if (s.apiKey) headers['Authorization'] = `Bearer ${s.apiKey}`;
  const res = await fetch(url, { headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { error: text }; }
  return { ok: res.ok, status: res.status, body };
}

ipcMain.handle('settings:get', () => readSettings());
ipcMain.handle('settings:set', (_e, s) => { writeSettings(s); return s; });
ipcMain.handle('api:get', (_e, p) => apiFetch(p));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
