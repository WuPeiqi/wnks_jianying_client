// 存储配置（不包含日志）
let config = {
    path: '',
};

// 日志单独存储，不持久化
let logs = [];

// 自定义提示框
function showAlert(message, type = 'info') {
    const overlay = document.getElementById('customAlertOverlay');
    const icon = document.getElementById('customAlertIcon');
    const messageEl = document.getElementById('customAlertMessage');
    const btn = document.getElementById('customAlertBtn');

    // 设置图标
    const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
    };
    icon.textContent = icons[type] || icons.info;

    // 设置消息
    messageEl.textContent = message;

    // 显示提示框
    overlay.classList.add('show');

    // 点击按钮关闭
    const closeAlert = () => {
        overlay.classList.remove('show');
        btn.removeEventListener('click', closeAlert);
        overlay.removeEventListener('click', overlayClick);
    };

    // 点击遮罩层关闭
    const overlayClick = (e) => {
        if (e.target === overlay) {
            closeAlert();
        }
    };

    btn.addEventListener('click', closeAlert);
    overlay.addEventListener('click', overlayClick);
}

// 加载配置
async function loadConfig() {
    try {
        const savedConfig = await window.electronAPI.loadConfig();

        if (savedConfig) {
            // 只加载路径，不加载日志
            config.path = savedConfig.path || '';

            updatePathDisplay();
        } else {
            // console.log('没有找到保存的配置');
        }
        // 每次打开程序日志都是空的
        updateLogDisplay();
    } catch (error) {}
}

// 保存配置（只保存路径，不保存日志）
async function saveConfig() {
    try {
        const configToSave = {
            path: config.path,
        };
        const success = await window.electronAPI.saveConfig(configToSave);
        if (success) {
            // console.log('配置保存成功');
        } else {
            // console.error('配置保存失败');
        }
    } catch (error) {
        // console.error('保存配置错误:', error);
    }
}

// 更新路径显示
function updatePathDisplay() {
    const pathElement = document.getElementById('currentPath');
    pathElement.textContent = config.path || '未设置';
}

// 添加日志（不持久化）
function addLog(message, type = 'info') {
    const log = {
        time: new Date().toLocaleString('zh-CN'),
        message,
        type,
    };

    logs.push(log);

    // 最新日志在上面
    // logs.unshift(log);
    // 只保留最近100条日志
    // if (logs.length > 100) {
    //     logs = logs.slice(0, 100);
    // }

    updateLogDisplay();
}

// 清除日志
function clearLogs() {
    logs = [];
    updateLogDisplay();
}

// 更新日志显示
function updateLogDisplay() {
    const logContainer = document.getElementById('logContainer');

    // 更新内容前，先判断用户当前是否停在底部附近（留 20px 容差）
    // 只有原本贴底时才在更新后自动吸底，避免用户上翻查看历史时被强行拽回
    const stickToBottom =
        logContainer.scrollHeight -
            logContainer.scrollTop -
            logContainer.clientHeight <
        20;

    if (logs.length === 0) {
        logContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <div class="empty-text">暂无日志</div>
            </div>
        `;
        return;
    }

    const logListHTML = logs
        .map(
            (log) => `
        <div class="log-item ${log.type}">
            <div class="log-time">${log.time}</div>
            <div class="log-message">${log.message}</div>
        </div>
    `,
        )
        .join('');

    logContainer.innerHTML = `<div class="log-list">${logListHTML}</div>`;

    // 仅当更新前用户就贴在底部时，才自动滚动到最新日志
    if (stickToBottom) {
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}

// 前往首页按钮
document.getElementById('homeBtn').addEventListener('click', async () => {
    try {
        await window.electronAPI.openExternal('https://www.wunian.chat/');
    } catch (error) {}
});

// 设置修改按钮
document.getElementById('modifyPathBtn').addEventListener('click', async () => {
    try {
        const selectedPath = await window.electronAPI.selectFolder();
        if (selectedPath) {
            config.path = selectedPath;
            await saveConfig();
            updatePathDisplay();
            // console.log('配置已保存:', config);
        }
    } catch (error) {
        // console.error('选择文件夹错误:', error);
        showAlert('选择文件夹失败，请重试', 'error');
    }
});

// 创建剪映草稿按钮
document.getElementById('createBtn').addEventListener('click', async () => {
    const draftInput = document.getElementById('draftInput');
    const draftUrl = draftInput.value.trim();

    if (!draftUrl) {
        showAlert('请输入草稿地址', 'warning');
        return;
    }

    if (!config.path) {
        showAlert('请先设置剪映草稿路径', 'warning');
        return;
    }

    // 清除历史日志
    clearLogs();

    const createBtn = document.getElementById('createBtn');
    createBtn.disabled = true;
    // createBtn.textContent = '创建中...';

    try {
        addLog(`开始创建草稿: ${draftUrl}`, 'info');
        const result = await window.electronAPI.createDraft(
            draftUrl,
            config.path,
        );
        if (result.success) {
            const titlePart = result.title ? `【${result.title}】` : '';
            addLog(`草稿创建成功${titlePart}: ${result.folderPath}`, 'success');
            // draftInput.value = '';
        } else if (result.canceled) {
            // 用户取消覆盖，作为普通信息记录，不显示为错误
            addLog(result.message || '已取消操作', 'warning');
        } else {
            addLog(`草稿创建失败: ${result.message}`, 'error');
        }
    } catch (error) {
        addLog(`草稿创建失败: ${error.message}`, 'error');
    } finally {
        // 修改按钮文字和是否可用
        createBtn.disabled = false;
        // createBtn.textContent = '创建剪映草稿';
    }
});

// 清除日志按钮
document.getElementById('clearLogBtn').addEventListener('click', () => {
    clearLogs();
});

// ===================== 历史记录 =====================

// HTML 转义，防止标题/URL 中的特殊字符破坏结构
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 渲染历史记录列表
function renderHistoryList(list) {
    const historyList = document.getElementById('historyList');

    if (!list || list.length === 0) {
        historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
        return;
    }

    historyList.innerHTML = list
        .map(
            (item) => `
        <div class="history-item" data-url="${escapeHtml(item.url)}">
            <div class="history-item-info">
                <div class="history-item-top">
                    <div class="history-item-title">${escapeHtml(item.title || item.url)}</div>
                    <div class="history-item-time">${escapeHtml(item.time || '')}</div>
                </div>
                <div class="history-item-url">${escapeHtml(item.url)}</div>
            </div>
            <button class="history-item-delete" title="删除此记录">🗑</button>
        </div>
    `,
        )
        .join('');
}

// 打开历史记录弹窗并加载数据
async function openHistory() {
    const overlay = document.getElementById('historyOverlay');
    try {
        const list = await window.electronAPI.loadHistory();
        renderHistoryList(list);
    } catch (error) {
        renderHistoryList([]);
    }
    overlay.classList.add('show');
}

// 关闭历史记录弹窗
function closeHistory() {
    document.getElementById('historyOverlay').classList.remove('show');
}

// 打开历史记录按钮
document.getElementById('historyBtn').addEventListener('click', openHistory);

// 关闭按钮
document
    .getElementById('closeHistoryBtn')
    .addEventListener('click', closeHistory);

// 点击遮罩层空白处关闭
document.getElementById('historyOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'historyOverlay') {
        closeHistory();
    }
});

// 清空全部历史
document
    .getElementById('clearHistoryBtn')
    .addEventListener('click', async () => {
        try {
            const list = await window.electronAPI.clearHistory();
            renderHistoryList(list);
        } catch (error) {}
    });

// 历史列表的点击事件（选择填入 / 删除单条），使用事件委托
document.getElementById('historyList').addEventListener('click', async (e) => {
    const itemEl = e.target.closest('.history-item');
    if (!itemEl) return;
    const url = itemEl.dataset.url;

    // 点击删除按钮：删除该条，不关闭弹窗
    if (e.target.closest('.history-item-delete')) {
        e.stopPropagation();
        try {
            const list = await window.electronAPI.deleteHistory(url);
            renderHistoryList(list);
        } catch (error) {}
        return;
    }

    // 点击整行：把地址填入输入框并关闭弹窗
    const draftInput = document.getElementById('draftInput');
    draftInput.value = url;
    closeHistory();
    draftInput.focus();
});

// 设置下载进度监听器
window.electronAPI.onDownloadProgress((data) => {
    addLog(data.message, data.type);
});

// 初始化
loadConfig();
