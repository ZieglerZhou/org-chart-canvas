const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '组织架构画布',
  });

  // 使用绝对路径加载，确保跨电脑兼容
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');
  
  if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    // 降级：尝试相对于 app 路径
    const altPath = path.join(app.getAppPath(), 'dist', 'index.html');
    if (fs.existsSync(altPath)) {
      mainWindow.loadFile(altPath);
    } else {
      mainWindow.loadURL('data:text/html,<h1>找不到 dist/index.html</h1><p>请确保 dist 目录存在</p>');
    }
  }
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

// IPC: 保存文件对话框
ipcMain.handle('save-file', async (event, data, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || '组织画布.json',
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, data, 'utf-8');
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

// IPC: 打开文件对话框
ipcMain.handle('open-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: filters || [
      { name: 'JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const data = fs.readFileSync(result.filePaths[0], 'utf-8');
    return { success: true, path: result.filePaths[0], data };
  }
  return { success: false };
});
