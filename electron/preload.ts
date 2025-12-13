import { contextBridge, ipcRenderer } from 'electron';

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  close: () => ipcRenderer.send('window-close'),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),

  // electron-store 存储 API
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: unknown) =>
    ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key: string) => ipcRenderer.invoke('store-delete', key),
  storeHas: (key: string) => ipcRenderer.invoke('store-has', key),
  storeClear: () => ipcRenderer.invoke('store-clear'),
  storeMigrate: (data: Record<string, unknown>) =>
    ipcRenderer.invoke('store-migrate', data),
  storeGetAll: () => ipcRenderer.invoke('store-get-all'),
  storeBatch: (data: Record<string, unknown>) =>
    ipcRenderer.invoke('store-batch', data),

  // 开机自启设置
  setAutoLaunch: (enable: boolean) =>
    ipcRenderer.invoke('set-auto-launch', enable),

  // 文件附件 API
  selectFiles: () => ipcRenderer.invoke('select-files'),
  readFileContent: (filePath: string) =>
    ipcRenderer.invoke('read-file-content', filePath),

  // 系统能力
  runAppleScript: (script: string) => ipcRenderer.invoke('run-apple-script', script),
  runShell: (command: string) => ipcRenderer.invoke('run-shell', command),
});

