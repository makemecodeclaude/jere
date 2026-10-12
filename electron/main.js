/* M31 Planung – Desktop-Hülle (Electron). Lädt die lokale Oberfläche; Daten bleiben im Benutzerprofil. */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

if (!app.requestSingleInstanceLock()) app.quit();

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'M31 Planung',
    backgroundColor: '#EFEEEA',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.once('ready-to-show', () => win.maximize());

  // externe Links im Standard-Browser öffnen, keine neuen App-Fenster
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
}

Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'Datei', submenu: [
    { label: 'Drucken…', accelerator: 'CmdOrCtrl+P', click: () => win && win.webContents.print() },
    { type: 'separator' },
    { role: 'quit', label: 'Beenden' },
  ] },
  { label: 'Ansicht', submenu: [
    { role: 'reload', label: 'Neu laden' },
    { role: 'resetZoom', label: 'Originalgrösse' },
    { role: 'zoomIn', label: 'Vergrössern' },
    { role: 'zoomOut', label: 'Verkleinern' },
    { type: 'separator' },
    { role: 'togglefullscreen', label: 'Vollbild' },
    { role: 'toggleDevTools', label: 'Entwicklertools' },
  ] },
]));

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
