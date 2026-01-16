const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const si = require('systeminformation');
const mm = require('music-metadata');

let mainWindow;

// CONFIG CHEMIN FFMPEG
let ffmpegPath;
if (app.isPackaged) {
    ffmpegPath = path.join(process.resourcesPath, 'ffmpeg.exe');
} else {
    ffmpegPath = path.join(__dirname, 'ffmpeg.exe');
}
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 850,
        minWidth: 1000, minHeight: 700,
        frame: false,
        backgroundColor: '#050505',
        icon: path.join(__dirname, 'logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false, // Indispensable
            webviewTag: true,
            allowRunningInsecureContent: true
        }
    });

    // --- LE FIX YOUTUBE ULTIME (MODE AGRESSIF) ---
    
    // 1. Définir un User-Agent de Chrome standard (pas Electron)
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    mainWindow.webContents.setUserAgent(userAgent);

    const filter = {
        urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*', '*://*.youtube-nocookie.com/*']
    };

    // 2. Modifier les requêtes ENVOYÉES (On ment sur l'origine)
    session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        details.requestHeaders['User-Agent'] = userAgent;
        details.requestHeaders['Referer'] = 'https://www.youtube.com/';
        details.requestHeaders['Origin'] = 'https://www.youtube.com';
        
        // SUPPRESSION DES TRACEURS ELECTRON
        delete details.requestHeaders['Sec-Fetch-Dest'];
        delete details.requestHeaders['Sec-Fetch-Mode'];
        delete details.requestHeaders['Sec-Fetch-Site'];
        delete details.requestHeaders['sec-ch-ua']; // Très important
        delete details.requestHeaders['sec-ch-ua-mobile'];
        delete details.requestHeaders['sec-ch-ua-platform'];

        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    // 3. Modifier les réponses REÇUES (On force l'acceptation de l'iframe)
    session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
        const responseHeaders = Object.assign({}, details.responseHeaders);
        
        // On retire les blocages de sécurité de YouTube (X-Frame-Options)
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['content-security-policy'];
        
        callback({ responseHeaders: responseHeaders });
    });
    // ------------------------------------------------

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// --- IPC HANDLERS ---

// Fenêtre
ipcMain.on('minimize-window', (e) => BrowserWindow.fromWebContents(e.sender).minimize());
ipcMain.on('maximize-window', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('close-window', (e) => BrowserWindow.fromWebContents(e.sender).close());
ipcMain.on('set-mini-mode', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win.setSize(400, 120); win.setAlwaysOnTop(true);
});
ipcMain.on('set-normal-mode', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win.setSize(1280, 850); win.setAlwaysOnTop(false);
});

// Fichiers
ipcMain.handle('get-home-path', () => app.getPath('home'));

ipcMain.handle('read-dir', async (e, dirPath) => {
    try {
        const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
        const files = items.map(item => ({
            name: item.name, 
            isDirectory: item.isDirectory(), 
            path: path.join(dirPath, item.name)
        })).filter(item => {
            return item.isDirectory || ['.mp3','.wav','.ogg','.flac','.mp4','.mkv','.webm','.avi'].includes(path.extname(item.name).toLowerCase());
        });
        return { success: true, files };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('get-folder-files', async (e, dirPath) => {
    try {
        const items = await fs.promises.readdir(dirPath);
        const supported = ['.mp3','.wav','.ogg','.flac','.mp4','.mkv','.webm','.avi'];
        const files = items.filter(f => supported.includes(path.extname(f).toLowerCase()))
                           .map(f => ({ name: f, path: path.join(dirPath, f) }));
        return { success: true, files };
    } catch (e) { return { success: false, files: [] }; }
});

ipcMain.handle('open-file-dialog', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Media', extensions: ['mp3','wav','ogg','flac','mp4','mkv','avi'] }] });
    return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('select-background-dialog', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg','png','webp','gif'] }] });
    return res.canceled ? null : res.filePaths[0];
});

// Matériel
ipcMain.handle('get-drives', async () => {
    try {
        const devices = await si.blockDevices();
        const fsSizes = await si.fsSize();
        const results = devices.filter(d => d.mount && d.mount.length > 0).map(d => {
            const fsInfo = fsSizes.find(fs => fs.mount === d.mount) || {};
            const isSystem = d.mount.toLowerCase().startsWith('c:');
            const isCD = d.type === 'rom' || (d.model && d.model.toLowerCase().includes('cd'));
            let finalLabel = d.label || fsInfo.label || d.name;
            if (!finalLabel || finalLabel.trim() === '') finalLabel = isCD ? "CD/DVD" : "Disque";
            return { mount: d.mount, label: finalLabel, isUSB: d.protocol === 'USB' || d.removable, isCD: isCD, isSystem: isSystem };
        });
        return results;
    } catch (error) { console.error("Erreur Drive:", error); return []; }
});

// Metadata
ipcMain.handle('get-metadata', async (event, filePath) => {
    try {
        const metadata = await mm.parseFile(filePath);
        if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];
            const base64String = `data:${picture.format};base64,${picture.data.toString('base64')}`;
            return { success: true, cover: base64String, artist: metadata.common.artist, title: metadata.common.title };
        }
        return { success: false };
    } catch (error) { return { success: false }; }
});