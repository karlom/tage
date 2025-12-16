import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import Store from 'electron-store';
import { execFile, exec } from 'child_process';

// pdf-parse 和 mammoth 将在需要时动态导入
let PDFParse: any = null;
let mammoth: any = null;

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

// 模型能力接口（与前端保持同步）
interface ModelCapabilities {
  reasoning?: boolean;
  functionCalling?: boolean;
  vision?: boolean;
  audio?: boolean;
  video?: boolean;
  documents?: boolean;
}

// 文件格式分类
type FileCategory = 'image' | 'audio' | 'video' | 'document';

// 文件格式定义
interface FileFormatDef {
  extension: string;
  mimeType: string;
  category: FileCategory;
  requiredCapability: keyof ModelCapabilities;
}

// 所有支持的文件格式
const ALL_FILE_FORMATS: FileFormatDef[] = [
  // 图片格式
  { extension: 'jpg', mimeType: 'image/jpeg', category: 'image', requiredCapability: 'vision' },
  { extension: 'jpeg', mimeType: 'image/jpeg', category: 'image', requiredCapability: 'vision' },
  { extension: 'png', mimeType: 'image/png', category: 'image', requiredCapability: 'vision' },
  { extension: 'gif', mimeType: 'image/gif', category: 'image', requiredCapability: 'vision' },
  { extension: 'webp', mimeType: 'image/webp', category: 'image', requiredCapability: 'vision' },
  { extension: 'heic', mimeType: 'image/heic', category: 'image', requiredCapability: 'vision' },
  { extension: 'heif', mimeType: 'image/heif', category: 'image', requiredCapability: 'vision' },

  // 音频格式
  { extension: 'mp3', mimeType: 'audio/mpeg', category: 'audio', requiredCapability: 'audio' },
  { extension: 'wav', mimeType: 'audio/wav', category: 'audio', requiredCapability: 'audio' },
  { extension: 'm4a', mimeType: 'audio/m4a', category: 'audio', requiredCapability: 'audio' },
  { extension: 'flac', mimeType: 'audio/flac', category: 'audio', requiredCapability: 'audio' },
  { extension: 'aac', mimeType: 'audio/aac', category: 'audio', requiredCapability: 'audio' },
  { extension: 'ogg', mimeType: 'audio/ogg', category: 'audio', requiredCapability: 'audio' },

  // 视频格式
  { extension: 'mp4', mimeType: 'video/mp4', category: 'video', requiredCapability: 'video' },
  { extension: 'webm', mimeType: 'video/webm', category: 'video', requiredCapability: 'video' },
  { extension: 'mov', mimeType: 'video/quicktime', category: 'video', requiredCapability: 'video' },

  // 文档格式
  { extension: 'pdf', mimeType: 'application/pdf', category: 'document', requiredCapability: 'documents' },
  { extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'document', requiredCapability: 'documents' },
  { extension: 'doc', mimeType: 'application/msword', category: 'document', requiredCapability: 'documents' },
  { extension: 'txt', mimeType: 'text/plain', category: 'document', requiredCapability: 'documents' },
  { extension: 'md', mimeType: 'text/markdown', category: 'document', requiredCapability: 'documents' },
  { extension: 'csv', mimeType: 'text/csv', category: 'document', requiredCapability: 'documents' },
];

// 类别显示名称
const CATEGORY_LABELS: Record<FileCategory, string> = {
  image: '图片',
  audio: '音频',
  video: '视频',
  document: '文档',
};

// 根据模型能力获取支持的格式
function getSupportedFormats(capabilities?: ModelCapabilities): FileFormatDef[] {
  if (!capabilities) {
    // 如果没有能力信息，默认只支持文档（通过文本提取）
    return ALL_FILE_FORMATS.filter(f => f.category === 'document');
  }

  return ALL_FILE_FORMATS.filter(format => {
    const cap = format.requiredCapability;
    return capabilities[cap] === true;
  });
}

// 获取 MIME 类型
function getMimeType(ext: string): string {
  const format = ALL_FILE_FORMATS.find(f => f.extension.toLowerCase() === ext.toLowerCase());
  return format?.mimeType || 'application/octet-stream';
}

// 获取文件类别
function getFileCategory(ext: string): FileCategory | 'unknown' {
  const format = ALL_FILE_FORMATS.find(f => f.extension.toLowerCase() === ext.toLowerCase());
  return format?.category || 'unknown';
}

// 根据模型能力生成文件对话框过滤器
function generateFileFilters(capabilities?: ModelCapabilities): { name: string; extensions: string[] }[] {
  const formats = getSupportedFormats(capabilities);
  const filters: { name: string; extensions: string[] }[] = [];

  // 按类别分组
  const categories = new Map<FileCategory, string[]>();
  for (const format of formats) {
    if (!categories.has(format.category)) {
      categories.set(format.category, []);
    }
    categories.get(format.category)!.push(format.extension);
  }

  // 生成每个类别的过滤器
  for (const [category, extensions] of categories) {
    filters.push({
      name: CATEGORY_LABELS[category],
      extensions,
    });
  }

  // 添加"所有支持的格式"选项
  if (filters.length > 1) {
    const allExtensions = formats.map(f => f.extension);
    filters.unshift({
      name: '所有支持的格式',
      extensions: allExtensions,
    });
  }

  // 如果没有任何支持的格式，至少返回文档格式
  if (filters.length === 0) {
    filters.push({
      name: '文档',
      extensions: ['pdf', 'docx', 'doc', 'txt', 'md'],
    });
  }

  return filters;
}

// 文件选择 IPC（接受模型能力参数）
ipcMain.handle('select-files', async (_, capabilities?: ModelCapabilities) => {
  if (!mainWindow) return [];

  // 根据能力生成过滤器
  const filters = generateFileFilters(capabilities);
  console.log('File filters based on capabilities:', capabilities, filters);

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters,
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

      // 根据文件类型限制大小
      const category = getFileCategory(ext);
      const maxSize = category === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 视频 50MB，其他 10MB
      if (stats.size > maxSize) {
        console.warn(`File too large: ${fileName} (${stats.size} bytes, max ${maxSize} bytes)`);
        continue;
      }

      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // 确定文件类型
      const fileType = getFileCategory(ext);

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
            textContent = '';
          }
        } else if (ext === 'docx' || ext === 'doc') {
          try {
            // 动态导入 mammoth
            if (!mammoth) {
              mammoth = await import('mammoth');
            }
            const result = await mammoth.extractRawText({ buffer: buffer });
            textContent = result.value;
            console.log(`Word parsed: ${fileName}, ${textContent?.length || 0} chars`);
          } catch (wordError) {
            console.warn(`Word parse failed: ${fileName}`, wordError);
            textContent = '';
          }
        } else {
          // txt, md, csv 直接读取
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

