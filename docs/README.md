# 无念剪映小助手

一个用于管理剪映草稿的桌面工具。

## 功能特点

- 📁 设置剪映草稿路径
- 🎬 通过草稿 ID 创建剪映草稿
- 📥 自动下载草稿相关文件
- 📝 实时显示操作日志
- 💾 自动保存配置

## 开发

### 安装依赖

```bash
npm install
```

### 运行开发版本

```bash
npm start
```

### 打包成可执行文件

本项目统一使用 GitHub Actions 进行编译，不再本地打包。

推送一个 `v` 开头的 tag 即可自动触发构建，并生成 Windows / macOS 全平台安装包：

```bash
git tag v1.0.0
git push origin v1.0.0
```

构建完成后，可在 GitHub 仓库的 Releases 页面下载对应平台的安装包。

## 使用说明

1. **设置草稿路径**
    - 点击"设置修改"按钮
    - 选择剪映草稿存储路径（通常是 `D:\Application\JianyingPro Drafts`）

2. **创建草稿**
    - 在输入框中输入草稿 ID
    - 点击"创建剪映草稿"按钮
    - 等待下载完成

3. **查看日志**
    - 操作日志会实时显示在页面下方
    - 可以点击"清除日志"清空日志记录

## 技术栈

- Electron
- Node.js
- Axios
- HTML/CSS/JavaScript

## 项目结构

```
wnks_jianying_client/
├── main.js           # 主进程
├── preload.js        # 预加载脚本
├── renderer.js       # 渲染进程
├── index.html        # 主页面
├── styles.css        # 样式文件
├── package.json      # 项目配置
└── README.md         # 说明文档
```

## 许可证

MIT
