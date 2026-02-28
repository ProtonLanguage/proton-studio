const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1600,
    height: 950,
    minWidth:  1100,
    minHeight: 700,
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111111',
      symbolColor: '#ffffff',
      height: 36
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

// ── FILE IPC ──

ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project',
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  const folderPath = result.filePaths[0];
  return { path: folderPath, name: path.basename(folderPath), files: scanFolder(folderPath) };
});

ipcMain.handle('new-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Project Location',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled) return null;
  const name = path.basename(result.filePaths[0]);
  const projectPath = result.filePaths[0];
  // Create default project files
  fs.writeFileSync(path.join(projectPath, 'main.pros'), defaultMainScript(name), 'utf8');
  fs.writeFileSync(path.join(projectPath, 'server.pros'), defaultServerScript(), 'utf8');
  fs.mkdirSync(path.join(projectPath, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'assets'),  { recursive: true });
  return { path: projectPath, name, files: scanFolder(projectPath) };
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  if (filePath) { fs.writeFileSync(filePath, content, 'utf8'); return filePath; }
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Proton Scripts', extensions: ['pros'] }]
  });
  if (result.canceled) return null;
  fs.writeFileSync(result.filePath, content, 'utf8');
  return result.filePath;
});

ipcMain.handle('read-file', async (event, filePath) => {
  return { path: filePath, name: path.basename(filePath), content: fs.readFileSync(filePath, 'utf8') };
});

ipcMain.handle('new-script', async (event, folder) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'New Script',
    defaultPath: path.join(folder || '', 'script.pros'),
    filters: [{ name: 'Proton Scripts', extensions: ['pros'] }]
  });
  if (result.canceled) return null;
  const content = '-- New Proton# Script\n\n';
  fs.writeFileSync(result.filePath, content, 'utf8');
  return { path: result.filePath, name: path.basename(result.filePath), content };
});

ipcMain.handle('save-scene', async (event, { filePath, scene }) => {
  const content = JSON.stringify(scene, null, 2);
  if (filePath) { fs.writeFileSync(filePath, content, 'utf8'); return filePath; }
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Proton Scene', extensions: ['pscene'] }]
  });
  if (result.canceled) return null;
  fs.writeFileSync(result.filePath, content, 'utf8');
  return result.filePath;
});

ipcMain.handle('load-scene', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Proton Scene', extensions: ['pscene'] }],
    properties: ['openFile']
  });
  if (result.canceled) return null;
  const content = fs.readFileSync(result.filePaths[0], 'utf8');
  return { path: result.filePaths[0], scene: JSON.parse(content) };
});

// ── HELPERS ──

function scanFolder(dir, depth = 0) {
  if (depth > 4) return [];
  const items = [];
  try {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(item => {
      if (item.name.startsWith('.')) return;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        items.push({ type: 'folder', name: item.name, path: full, children: scanFolder(full, depth + 1) });
      } else if (item.name.endsWith('.pros') || item.name.endsWith('.pscene')) {
        items.push({ type: 'file', name: item.name, path: full, ext: path.extname(item.name) });
      }
    });
  } catch {}
  return items;
}

function defaultMainScript(name) {
  return `-- ${name} — main.pros
-- Entry point for your Proton# game

import std.events;
import std.gui;

-- Game setup
module.gameName = "${name}";
module.running  = false;

-- Start screen
var:local startBtn = gui.create("Button");
startBtn.text   = "Play";
startBtn.x      = 300;
startBtn.y      = 250;
startBtn.width  = 200;
startBtn.height = 60;
startBtn.color  = "#FF6B00";
gui.add(startBtn);

startBtn.onClick(func() do
    module.running = true;
    gui.clear();
    event.fire("GameStart");
end);

event.on("GameStart", func() do
    print("${name} started!");
end);
`;
}

function defaultServerScript() {
  return `-- server.pros
-- Run this to host a multiplayer session

import std.network;

module.players = [];

network.onConnect(func(player) do
    print(player.name .. " connected.");
    module.players.push(player);
    network.broadcast("PlayerJoined", { name: player.name });
end);

network.onDisconnect(func(player) do
    var:local idx = module.players.indexOf(player);
    module.players.remove(idx);
    network.broadcast("PlayerLeft", { name: player.name });
end);

network.startServer(7777);
print("Server running on port 7777");
`;
}

app.whenReady().then(() => {
  createWindow();
  Menu.setApplicationMenu(null);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
