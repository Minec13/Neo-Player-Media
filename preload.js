const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('neoAPI', {
    // Fenêtre
    minimize: () => ipcRenderer.send('minimize-window'),
    maximize: () => ipcRenderer.send('maximize-window'),
    close: () => ipcRenderer.send('close-window'),
    setMiniMode: () => ipcRenderer.send('set-mini-mode'),
    setNormalMode: () => ipcRenderer.send('set-normal-mode'),
    toggleFullScreen: () => ipcRenderer.send('toggle-fullscreen'),
    
    // Fichiers
    getHomePath: () => ipcRenderer.invoke('get-home-path'),
    readDir: (path) => ipcRenderer.invoke('read-dir', path),
    openFile: () => ipcRenderer.invoke('open-file-dialog'),
    selectBackground: () => ipcRenderer.invoke('select-background-dialog'),
    getFolderFiles: (path) => ipcRenderer.invoke('get-folder-files', path),

    // Matériel
    getDrives: () => ipcRenderer.invoke('get-drives'),
    playCda: (path) => ipcRenderer.invoke('play-cda', path),
    // NOUVEAU : Metadata
    getMetadata: (path) => ipcRenderer.invoke('get-metadata', path)
});