const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    loadConfig: () => ipcRenderer.invoke('load-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    createDraft: (draftUrl, draftPath) =>
        ipcRenderer.invoke('create-draft', draftUrl, draftPath),
    // 历史记录相关
    loadHistory: () => ipcRenderer.invoke('load-history'),
    deleteHistory: (url) => ipcRenderer.invoke('delete-history', url),
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    // 监听下载进度消息
    onDownloadProgress: (callback) => {
        ipcRenderer.on('download-progress', (_event, data) => callback(data));
    },
});
