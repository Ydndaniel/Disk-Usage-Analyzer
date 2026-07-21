const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('diskAPI', {
  getDrives: () => ipcRenderer.invoke('get-drives'),
  getDirectoryContents: (p) => ipcRenderer.invoke('get-directory-contents', p),
  getParentPath: (p) => ipcRenderer.invoke('get-parent-path', p),
  getFolderSize: (p) => ipcRenderer.invoke('get-folder-size', p),
  findDuplicates: (p) => ipcRenderer.invoke('find-duplicates', p)
});
