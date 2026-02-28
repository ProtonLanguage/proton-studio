const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studio', {
  openFolder:  ()             => ipcRenderer.invoke('open-folder'),
  newProject:  ()             => ipcRenderer.invoke('new-project'),
  saveFile:    (data)         => ipcRenderer.invoke('save-file', data),
  readFile:    (path)         => ipcRenderer.invoke('read-file', path),
  newScript:   (folder)       => ipcRenderer.invoke('new-script', folder),
  saveScene:   (data)         => ipcRenderer.invoke('save-scene', data),
  loadScene:   ()             => ipcRenderer.invoke('load-scene'),
});
