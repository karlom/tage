/// <reference types="vite/client" />

// 模型能力接口（与 storage.ts 保持同步）
interface ModelCapabilitiesForIPC {
  reasoning?: boolean;
  functionCalling?: boolean;
  vision?: boolean;
  audio?: boolean;
  video?: boolean;
  documents?: boolean;
}

// 文件附件接口
interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'audio' | 'video' | 'document' | 'unknown';
  size: number;
  base64: string;
  dataUrl: string;
  mimeType: string;
  textContent?: string;  // 文档的提取文本内容
}

// 文件内容读取结果
interface FileContentResult {
  type: 'pdf' | 'text';
  content: string;
}

interface ElectronAPI {
  platform: string;
  close?: () => void;
  minimize?: () => void;
  maximize?: () => void;

  // electron-store 存储 API
  storeGet: <T = unknown>(key: string) => Promise<T>;
  storeSet: (key: string, value: unknown) => Promise<boolean>;
  storeDelete: (key: string) => Promise<boolean>;
  storeHas: (key: string) => Promise<boolean>;
  storeClear: () => Promise<boolean>;
  storeMigrate: (data: Record<string, unknown>) => Promise<boolean>;
  storeGetAll: () => Promise<Record<string, unknown>>;
  storeBatch: (data: Record<string, unknown>) => Promise<boolean>;

  // 开机自启设置
  setAutoLaunch: (enable: boolean) => Promise<boolean>;

  // 文件附件 API（接受模型能力参数）
  selectFiles: (capabilities?: ModelCapabilitiesForIPC) => Promise<FileAttachment[]>;
  readFileContent: (filePath: string) => Promise<FileContentResult | null>;

  // 系统能力
  runAppleScript: (script: string) => Promise<string>;
  runShell: (command: string) => Promise<string>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
