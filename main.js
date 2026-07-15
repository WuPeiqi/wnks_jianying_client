const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    shell,
    Menu,
} = require('electron');

// 保存主窗口引用
let mainWindow = null;

function createWindow() {
    // 设置应用菜单为空
    // Menu.setApplicationMenu(null);
    // 创建浏览器窗口
    const win = new BrowserWindow({
        width: 1200,
        height: 920,
        minWidth: 760,
        minHeight: 600,
        frame: true, // 无边框窗口
        icon: require('path').join(__dirname, 'icon.png'), // 窗口图标
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: require('path').join(__dirname, 'preload.js'),
        },
    });

    // 加载index.html文件
    win.loadFile('index.html', { encoding: 'utf-8' });

    // 打开开发者工具（开发时使用）
    // win.webContents.openDevTools();

    mainWindow = win;
    return win;
}

// 处理选择文件夹
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择剪映草稿路径',
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// 处理打开外部链接
ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
});

// 配置文件路径
// Windows: C:\Users\Administrator\AppData\Roaming\wnks_jianying_client\config.json
// macOS: ~/Library/Application Support/wnks_jianying_client
const fs = require('fs');
const path = require('path');
const configPath = path.join(app.getPath('userData'), 'config.json');
// 历史记录文件（与配置分开存储）
const historyPath = path.join(app.getPath('userData'), 'history.json');
// 历史记录最多保留条数
const HISTORY_MAX = 50;

// 读取历史记录（返回数组）
function readHistory() {
    try {
        if (fs.existsSync(historyPath)) {
            const data = fs.readFileSync(historyPath, 'utf8');
            const list = JSON.parse(data);
            return Array.isArray(list) ? list : [];
        }
    } catch (error) {
        // 读取失败时返回空数组
    }
    return [];
}

// 写入历史记录数组
function writeHistory(list) {
    try {
        fs.writeFileSync(historyPath, JSON.stringify(list, null, 2), 'utf8');
        return true;
    } catch (error) {
        return false;
    }
}

// 新增/更新一条历史记录：按 url 去重，存在则更新标题与时间并置顶
function addHistory(title, url) {
    if (!url) return;
    const list = readHistory();
    const filtered = list.filter((item) => item.url !== url);
    filtered.unshift({
        title: title || url,
        url,
        time: new Date().toLocaleString('zh-CN'),
    });
    writeHistory(filtered.slice(0, HISTORY_MAX));
}

// 读取配置
ipcMain.handle('load-config', async () => {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        // console.error('读取配置失败:', error);
    }
    return null;
});

// 保存配置
ipcMain.handle('save-config', async (event, config) => {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        // console.error('保存配置失败:', error);
        return false;
    }
});

// 获取历史记录列表
ipcMain.handle('load-history', async () => {
    return readHistory();
});

// 删除指定 url 的历史记录，返回删除后的列表
ipcMain.handle('delete-history', async (event, url) => {
    const list = readHistory().filter((item) => item.url !== url);
    writeHistory(list);
    return list;
});

// 清空全部历史记录
ipcMain.handle('clear-history', async () => {
    writeHistory([]);
    return [];
});

// 向渲染进程发送下载进度日志
function sendProgress(message, type = 'info') {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', { message, type });
    }
}

// 创建剪映草稿
// draftUrl：用户输入的草稿地址（草稿ID已包含在URL中）
// draftPath：本地剪映草稿根路径，作为 draft_foot_path 发送给服务端
ipcMain.handle('create-draft', async (event, draftUrl, draftPath) => {
    try {
        const axios = require('axios');

        // 1. 向草稿地址发送 POST 请求，请求体携带本地草稿路径
        const apiResponse = await axios.post(
            draftUrl,
            {
                draft_foot_path: draftPath,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        );

        // 2. 检查响应：非零 code 均为错误，从 message 读取错误信息
        if (apiResponse.data.code !== 0) {
            return {
                success: false,
                message: apiResponse.data.message || '请求失败',
            };
        }

        const respData = apiResponse.data.data;
        const content_dict = respData.draft_content;
        const meta_info_dict = respData.draft_meta_info;
        // 接口返回的中文标题，用于历史记录展示
        const title = respData.title || '';

        // 3. 草稿文件夹路径由服务端在 draft_meta_info.draft_fold_path 中返回
        const folderPath = meta_info_dict.draft_fold_path;
        if (!folderPath) {
            return {
                success: false,
                message: '返回数据缺少草稿路径（draft_fold_path）',
            };
        }

        // 3.1 若本地草稿已存在，提示用户重新创建草稿并中止操作
        if (fs.existsSync(folderPath)) {
            await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                buttons: ['我知道了'],
                defaultId: 0,
                cancelId: 0,
                noLink: true,
                title: '草稿已存在',
                message: '本地草稿已存在，请重新创建草稿',
                detail: `路径：${folderPath}\n\n该草稿文件夹已存在，请重新创建草稿。`,
            });

            return {
                success: false,
                canceled: true,
                message: '草稿路径已存在，请重新创建草稿',
            };
        }

        // 重新创建空的草稿文件夹（无论此前是否存在）
        fs.mkdirSync(folderPath, { recursive: true });

        // 4. 写入 draft_content.json
        fs.writeFileSync(
            path.join(folderPath, 'draft_content.json'),
            JSON.stringify(content_dict, null, 4),
            'utf8',
        );

        // 5. 写入 draft_meta_info.json
        fs.writeFileSync(
            path.join(folderPath, 'draft_meta_info.json'),
            JSON.stringify(meta_info_dict, null, 4),
            'utf8',
        );

        // 6. 循环下载 download_list 中的每个资源文件
        //    每一项为 { url, local_file_path }，local_file_path 为服务端给出的绝对路径
        const download_file_list = respData.download_list || [];
        sendProgress(
            `当前草稿相关 视频/音频/图片 等资源文件，共${download_file_list.length}个`,
            'info',
        );

        for (let i = 0; i < download_file_list.length; i++) {
            const remoteUrl = download_file_list[i].url;
            const localFilePath = download_file_list[i].local_file_path;

            try {
                // 确保目标目录存在
                const localDir = path.dirname(localFilePath);
                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }

                // 下载文件（以二进制方式接收数据）
                const response = await axios.get(remoteUrl, {
                    responseType: 'arraybuffer',
                    timeout: 60000 * 10, // 10*60秒超时
                });

                // 保存到本地
                fs.writeFileSync(localFilePath, response.data);

                sendProgress(
                    `下载成功 [${i + 1}/${download_file_list.length}]： ${remoteUrl}`,
                    'info',
                );
            } catch (error) {
                sendProgress(`下载失败 ${remoteUrl}`, 'error');
            }
        }

        // 7. 创建成功后写入历史记录（以草稿地址去重，展示中文标题）
        addHistory(title, draftUrl);

        return {
            success: true,
            folderPath,
            title,
        };
    } catch (error) {
        return {
            success: false,
            message: '草稿下载失败，请联系官方工作人员。',
        };
    }
});

// 当Electron完成初始化并准备创建浏览器窗口时，将调用此方法
app.whenReady().then(createWindow);

// 当所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // 在macOS上，当点击dock图标且没有其他窗口打开时，通常会在应用程序中重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
