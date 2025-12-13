import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import Store from 'electron-store';
import { execFile, exec } from 'child_process';

// pdf-parse 将在需要时动态导入
let PDFParse: any = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 开发环境判断
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 初始化 electron-store
const store = new Store({
  name: 'tageai-data',
  defaults: {
    providers: [],
    chatSessions: [],
    settings: {},
    memories: [],
    memorySettings: {},
    tools: [],
    toolCategories: [],
    searchApiConfig: {},
    chatSettings: {},
    generalSettings: {},
    uiSettings: {},
  },
});

let mainWindow: BrowserWindow | null = null;

// 窗口控制 IPC - 只注册一次
ipcMain.on('window-close', () => {
  mainWindow?.close();
});

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

// electron-store IPC handlers
ipcMain.handle('store-get', (_, key: string) => {
  return store.get(key);
});

ipcMain.handle('store-set', (_, key: string, value: unknown) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('store-delete', (_, key: string) => {
  store.delete(key as keyof typeof store.store);
  return true;
});

ipcMain.handle('store-has', (_, key: string) => {
  return store.has(key as keyof typeof store.store);
});

ipcMain.handle('store-clear', () => {
  store.clear();
  return true;
});

// 数据迁移 - 从 localStorage 迁移到 electron-store
ipcMain.handle('store-migrate', (_, data: Record<string, unknown>) => {
  Object.entries(data).forEach(([key, value]) => {
    if (!store.has(key as keyof typeof store.store)) {
      store.set(key, value);
    }
  });
  return true;
});

// 获取所有数据
ipcMain.handle('store-get-all', () => {
  return store.store;
});

// 批量写入数据
ipcMain.handle('store-batch', (_, data: Record<string, unknown>) => {
  Object.entries(data).forEach(([key, value]) => {
    store.set(key, value);
  });
  return true;
});

// 运行 AppleScript
ipcMain.handle('run-apple-script', async (_event, script: string) => {
  return await new Promise<string>((resolve, reject) => {
    execFile('osascript', ['-e', script], { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout?.trim() || '');
    });
  });
});

// 运行 shell 命令
ipcMain.handle('run-shell', async (_event, command: string) => {
  return await new Promise<string>((resolve, reject) => {
    exec(command, { encoding: 'utf8', shell: '/bin/bash', maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve((stdout || '').trim());
    });
  });
});

// 设置开机自启
ipcMain.handle('set-auto-launch', (_, enable: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: false,
  });
  return true;
});

// 文件附件接口
interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  base64: string;
  dataUrl: string;
  mimeType: string;
  textContent?: string;  // 文档的提取文本内容
}

// 支持的文件类型
const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const SUPPORTED_DOCUMENT_EXTENSIONS = ['pdf', 'txt', 'md'];

// 获取 MIME 类型
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

// 文件选择 IPC
ipcMain.handle('select-files', async () => {
  if (!mainWindow) return [];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Images',
        extensions: SUPPORTED_IMAGE_EXTENSIONS,
      },
      {
        name: 'Documents',
        extensions: SUPPORTED_DOCUMENT_EXTENSIONS,
      },
      {
        name: 'All Supported',
        extensions: [...SUPPORTED_IMAGE_EXTENSIONS, ...SUPPORTED_DOCUMENT_EXTENSIONS],
      },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  const files: FileAttachment[] = [];

  for (const filePath of result.filePaths) {
    try {
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mimeType = getMimeType(ext);
      const stats = fs.statSync(filePath);

      // 限制文件大小（10MB）
      if (stats.size > 10 * 1024 * 1024) {
        console.warn(`File too large: ${fileName}`);
        continue;
      }

      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // 确定文件类型
      let fileType = 'unknown';
      if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
        fileType = 'image';
      } else if (SUPPORTED_DOCUMENT_EXTENSIONS.includes(ext)) {
        fileType = 'document';
      }

      // 对文档类型，解析文本内容
      let textContent: string | undefined;
      if (fileType === 'document') {
        if (ext === 'pdf') {
          try {
            // 动态导入 pdf-parse
            if (!PDFParse) {
              const pdfParseModule = await import('pdf-parse');
              PDFParse = pdfParseModule.PDFParse;
            }
            const pdfParser = new PDFParse({ data: buffer });
            const textResult = await pdfParser.getText();
            textContent = textResult.text;
            console.log(`PDF parsed: ${fileName}, ${textContent?.length || 0} chars`);
          } catch (pdfError) {
            console.warn(`PDF parse failed: ${fileName}`, pdfError);
            // PDF 解析失败时，设置为空字符串而不是 undefined
            textContent = '';
          }
        } else {
          // txt, md 直接读取
          textContent = buffer.toString('utf-8');
        }
      }

      files.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        name: fileName,
        type: fileType,
        size: stats.size,
        base64,
        dataUrl,
        mimeType,
        textContent,
      });
    } catch (error) {
      console.error(`Failed to read file: ${filePath}`, error);
    }
  }

  return files;
});

// 读取文件内容（用于文档解析）
ipcMain.handle('read-file-content', async (_, filePath: string) => {
  try {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const buffer = fs.readFileSync(filePath);

    if (ext === 'pdf') {
      try {
        // 动态导入 pdf-parse
        if (!PDFParse) {
          const pdfParseModule = await import('pdf-parse');
          PDFParse = pdfParseModule.PDFParse;
        }
        const pdfParser = new PDFParse({ data: buffer });
        const textResult = await pdfParser.getText();
        return {
          type: 'pdf',
          content: textResult.text,
        };
      } catch (pdfError) {
        console.error('PDF parse failed:', pdfError);
        return {
          type: 'pdf',
          content: '',
          error: 'PDF 解析失败',
        };
      }
    } else {
      // 文本文件直接读取
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        type: 'text',
        content,
      };
    }
  } catch (error) {
    console.error('Failed to read file:', error);
    return null;
  }
});

function createWindow() {
  const preloadPath = isDev
    ? path.join(__dirname, 'preload.js')
    : path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 无边框窗口
    titleBarStyle: 'hiddenInset', // 使用原生交通灯按钮
    trafficLightPosition: { x: 12, y: 12 }, // 调整原生按钮位置
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // 在打包后，__dirname 指向 app.asar/dist-electron/electron/
    // 需要加载 app.asar/app-dist/index.html
    // 使用 app.getAppPath() 获取应用路径，然后拼接 app-dist/index.html
    const appPath = app.getAppPath();
    const htmlPath = path.join(appPath, 'app-dist', 'index.html');
    console.log('Loading HTML from:', htmlPath);
    mainWindow?.loadFile(htmlPath).catch((err) => {
      console.error('Failed to load index.html from app-dist:', err);
      // 如果失败，尝试直接加载 index.html（可能在根目录）
      const fallbackPath = path.join(appPath, 'index.html');
      console.log('Trying fallback path:', fallbackPath);
      mainWindow?.loadFile(fallbackPath).catch((err2) => {
        console.error('Failed to load index.html from root:', err2);
      });
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

