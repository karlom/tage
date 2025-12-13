# Tage AI

一款现代化、功能丰富的 AI 聊天桌面客户端，基于 Electron、React 和 TypeScript 构建。支持多个 AI 服务商、工具调用、记忆系统以及深度 macOS 集成。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-28-47848F.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)

[English](./README.md) | 中文

## 功能特性

- **多服务商支持** - 无缝切换 DeepSeek、OpenAI、Anthropic、Google Gemini 和 OpenRouter
- **工具调用** - 内置函数调用，支持网络搜索、文件操作、计算器等
- **macOS 集成** - 原生 AppleScript 支持，可操作日历、提醒事项、音量控制和 Shell 命令
- **记忆系统** - 向量嵌入实现上下文感知对话 (RAG)
- **流式响应** - 实时 SSE 流式传输，支持 Token 用量追踪
- **推理模型** - 支持 DeepSeek Reasoner 和 OpenAI o1 模型
- **视觉理解** - 多模态对话，支持图像理解
- **现代化 UI** - 简洁的原生风格界面，支持深色模式

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Electron 28 |
| 前端 | React 18, TypeScript 5 |
| 构建 | Vite 5 |
| 样式 | Tailwind CSS 3, Shadcn/UI |
| 图标 | Lucide React |
| 存储 | electron-store |

## 快速开始

### 环境要求

- Node.js 18+
- pnpm（推荐）或 npm

### 安装

```bash
# 克隆仓库
git clone https://github.com/karlom/tage.git
cd tage

# 安装依赖
pnpm install
```

### 开发

```bash
# 启动开发服务器（仅 Web）
pnpm dev

# 启动 Electron 开发环境（推荐）
pnpm electron:dev
```

### 构建

```bash
# 构建 Web 资源
pnpm build

# 构建 Electron 主进程/预加载脚本
pnpm build:electron

# 完整生产构建并打包
pnpm electron:build
```

## 项目结构

```
tage/
├── electron/               # Electron 主进程
│   ├── main.ts            # 窗口管理、IPC 处理
│   └── preload.ts         # 安全 IPC 桥接 (window.electronAPI)
├── src/
│   ├── components/        # React 组件
│   │   ├── ui/           # 可复用 UI 基础组件
│   │   ├── settings/     # 设置页面模块
│   │   ├── ChatPage.tsx  # 主聊天界面
│   │   └── Sidebar.tsx   # 导航侧边栏
│   ├── services/
│   │   ├── deepseek.ts   # AI API 客户端（多服务商）
│   │   ├── storage.ts    # 持久化层
│   │   ├── tools.ts      # 工具执行引擎
│   │   ├── embedding.ts  # 向量嵌入服务
│   │   └── persona.ts    # AI 人设管理
│   └── hooks/            # React Hooks
├── public/               # 静态资源
└── app-dist/             # 构建输出
```

## 配置说明

### AI 服务商

在 设置 > 服务商 中配置 API 密钥：

| 服务商 | 模型 | 特性 |
|--------|------|------|
| DeepSeek | deepseek-chat, deepseek-reasoner | 推理、工具调用 |
| OpenAI | gpt-4o, gpt-4-turbo, o1 | 视觉、工具调用 |
| Anthropic | claude-3.5-sonnet, claude-3-opus | 视觉、工具调用 |
| Google | gemini-1.5-pro, gemini-1.5-flash | 视觉、长上下文 |
| OpenRouter | 多种模型 | 聚合访问 |

### 内置工具

| 类别 | 工具 |
|------|------|
| 网络 | `web_fetch`, `web_search`（SerpAPI/Brave/Google） |
| 工作区 | `glob_files`, `read_file` |
| 实用 | `calculator`, `get_current_time` |
| macOS | `calendar`, `reminders`, `volume`, `shell`, `applescript` |

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘ + N` | 新建对话 |
| `⌘ + K` | 搜索对话 |
| `⌘ + ,` | 打开设置 |
| `⌘ + Enter` | 发送消息 |

## 截图

*即将添加*

## 开发计划

- [ ] Windows/Linux 支持
- [ ] 插件系统
- [ ] 本地模型支持（Ollama）
- [ ] 导出/导入对话
- [ ] 多语言界面

## 参与贡献

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 发起 Pull Request

## 开源协议

本项目基于 MIT 协议开源 - 详见 [LICENSE](LICENSE) 文件。

## 致谢

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn/UI](https://ui.shadcn.com/)
- [Lucide Icons](https://lucide.dev/)
