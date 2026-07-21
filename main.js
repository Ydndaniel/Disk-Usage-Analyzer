const { app, BrowserWindow, ipcMain } = require('electron');
const { execFile } = require('child_process');
const { promises: fs, createReadStream } = require('fs');
const path = require('path');
const crypto = require('crypto');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-drives', () => {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-WmiObject Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace,VolumeName,DriveType | ConvertTo-Json'
    ], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      try {
        let data = JSON.parse(stdout.trim());
        if (!Array.isArray(data)) data = [data];
        const drives = data
          .filter(d => d.Size != null && d.DriveType !== 5)
          .map(d => ({
            DeviceID: d.DeviceID,
            VolumeName: d.VolumeName || '',
            DriveType: d.DriveType,
            Size: d.Size,
            FreeSpace: d.FreeSpace,
            UsedSpace: d.Size - d.FreeSpace
          }));
        resolve(drives);
      } catch (e) {
        reject(e);
      }
    });
  });
});

ipcMain.handle('get-directory-contents', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results = await Promise.allSettled(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stat = await fs.stat(fullPath);
          return {
            name: entry.name,
            path: fullPath,
            size: stat.size,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            lastModified: stat.mtime.toISOString(),
            accessible: true
          };
        } catch (err) {
          return {
            name: entry.name,
            path: fullPath,
            size: 0,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            lastModified: null,
            accessible: false,
            error: err.code
          };
        }
      })
    );

    const items = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return b.size - a.size;
    });

    return { path: dirPath, items, error: null };
  } catch (err) {
    return { path: dirPath, items: [], error: err.code || 'UNKNOWN' };
  }
});

ipcMain.handle('get-parent-path', (event, currentPath) => {
  const parent = path.dirname(currentPath);
  if (parent === currentPath) return null;
  return parent;
});

async function calcFolderSize(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const sizes = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          return await calcFolderSize(fullPath);
        } else {
          const stat = await fs.stat(fullPath);
          return stat.size;
        }
      } catch (_) {
        return 0;
      }
    }));
    return sizes.reduce((sum, size) => sum + size, 0);
  } catch (_) {
    return 0;
  }
}

ipcMain.handle('get-folder-size', (event, dirPath) => calcFolderSize(dirPath));

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function findDuplicatesInDir(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const fileEntries = entries.filter(entry => entry.isFile());

  const stats = await Promise.all(fileEntries.map(async (entry) => {
    const fullPath = path.join(dirPath, entry.name);
    try {
      const stat = await fs.stat(fullPath);
      return { name: entry.name, path: fullPath, size: stat.size };
    } catch (_) {
      return null;
    }
  }));

  const bySize = new Map();
  for (const file of stats) {
    if (!file || file.size === 0) continue;
    if (!bySize.has(file.size)) bySize.set(file.size, []);
    bySize.get(file.size).push(file);
  }
  const candidates = [...bySize.values()].filter(group => group.length > 1).flat();

  const hashed = await Promise.all(candidates.map(async (file) => {
    try {
      return { ...file, hash: await hashFile(file.path) };
    } catch (_) {
      return null;
    }
  }));

  const byHash = new Map();
  for (const file of hashed) {
    if (!file) continue;
    if (!byHash.has(file.hash)) byHash.set(file.hash, []);
    byHash.get(file.hash).push({ name: file.name, path: file.path, size: file.size });
  }

  return [...byHash.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([hash, files]) => ({
      hash,
      size: files[0].size,
      files,
      wastedBytes: files[0].size * (files.length - 1)
    }))
    .sort((a, b) => b.wastedBytes - a.wastedBytes);
}

ipcMain.handle('find-duplicates', async (event, dirPath) => {
  try {
    const groups = await findDuplicatesInDir(dirPath);
    const totalWastedBytes = groups.reduce((sum, group) => sum + group.wastedBytes, 0);
    return { path: dirPath, groups, totalWastedBytes, error: null };
  } catch (err) {
    return { path: dirPath, groups: [], totalWastedBytes: 0, error: err.code || 'UNKNOWN' };
  }
});
