# Product Requirements Document: AI Unified Desktop Client (Tage AI)

**Version:** 1.0
**Date:** 2023-12-11
**Status:** Ready for Development
**Target Stack:** Electron, React, TypeScript, Tailwind CSS, Shadcn/UI

---

## 1. 项目概述 (Project Overview)

**产品定义：**
一个基于 Electron 的现代化桌面 AI 客户端，旨在聚合多种大模型 API（OpenAI, Gemini, DeepSeek, Anthropic），提供统一、极简且具备高级记忆功能（RAG）的对话体验。

**核心价值：**

- **统一管理：** 一站式管理所有 AI 提供商和 API Key。
- **本地记忆：** 基于向量检索的长期记忆功能，支持自动注入上下文。
- **极度可定制：** 从模型参数（温度、Token）到界面 UI（快捷键、主题）的精细控制。
- **原生体验：** 极简设计，高性能，类 macOS 原生交互。

---

## 2. 技术栈选型 (Tech Stack)

为了确保 AI 能够生成高质量、可维护的代码，强制使用以下技术栈：

- **Core Framework:** Electron (主进程) + React (渲染进程) + Vite
- **Language:** TypeScript (Strict Mode)
- **UI Framework:** **Shadcn/UI** (关键组件库) + Radix UI
- **Styling:** Tailwind CSS (核心样式方案)
- **State Management:** Zustand (用于全局设置和会话状态管理)
- **Data Persistence:**
  - 配置存储: `electron-store`
  - 聊天记录/向量数据: `RxDB` 或 `SQLite` (better-sqlite3)
- **Vector Search (Memory):** 本地 Cosine Similarity 算法或轻量级向量库 (如 `connery-js`)

---

## 3. 全局 UI 规范 (Global UI Specs)

- **窗口样式:**
  - Frameless Window (无边框)。
  - Hidden Titlebar (隐藏默认标题栏，自定义拖拽区)。
  - macOS 风格红绿灯控制钮。
- **配色方案:**
  - **Sidebar:** `bg-gray-50` / Dark: `bg-zinc-900`
  - **Main Content:** `bg-white` / Dark: `bg-zinc-950`
  - **Accents:** 使用 Slate/Zinc 色系，保持克制和专业感。
- **布局结构:**
  - **Sidebar (Left):** 固定宽度 (~260px)，承载导航和历史记录。
  - **Content (Right):** 自适应宽度，承载设置面板或聊天窗口。

---

## 4. 功能模块详解 (Functional Modules)

### 4.1 侧边栏 (Sidebar)

- **导航模式 (Settings Mode):**
  - 菜单项：通用 (General), 提供商 (Providers), 聊天 (Chat), 记忆 (Memory), 用户界面 (UI), 网络 (Network), 快捷键 (Shortcuts), 关于 (About)。
  - 底部操作：导入设置、导出设置、重置设置 (红色警告样式)。
- **会话模式 (Chat Mode):**
  - "New Chat" 按钮 (顶部)。
  - 历史会话列表 (支持右键重命名/删除)。
  - 底部工具栏：管理提示词 (Prompts), 图库, 设置入口。

### 4.2 设置模块 (Settings Modules)

#### A. 提供商管理 (Providers)

- **列表视图:** 左侧显示已添加的提供商 (OpenAI, DeepSeek, etc.)，带状态指示灯 (Active/Inactive)。
- **详情视图:**
  - 显示 Logo、描述。
  - "Enable Provider" 开关。
  - 配置表单：API Key 输入框, Base URL, 自定义模型列表。

#### B. 通用设置 (General)

- **工具模型 (Tool Model):** 下拉选择，用于后台任务（如总结标题、重写查询）。
- **语言:** 中文/英文切换。
- **启动:** 开机自启、启动时最小化到托盘。

#### C. 聊天设置 (Chat Settings)

- **参数控制:**
  - **Temperature:** 滑块 (0.0 - 2.0)，标记 "保守", "平衡", "创意"。
  - **Max Tokens:** 输入框 (默认 2048)。
- **体验设置:**
  - 流式响应 (Streaming) 开关。
  - 显示 Token 使用量开关。
  - Markdown 渲染开关。
  - **音效:** 生成时播放音效 (类似 ryOS)。
- **历史记录:** 自动保存开关，保留天数设置 (默认 30 天)。

#### D. 记忆与 RAG (Memory)

- **核心开关:** "启用记忆" (Enable Memory)。
- **检索配置:**
  - **自动检索:** 每次对话前自动搜索相关历史。
  - **查询重写 (Query Rewriting):** 使用工具模型优化搜索词。
  - **最大检索数 (Top K):** 滑块 (1-20)。
  - **相似度阈值:** 滑块 (0% - 100%)。

#### E. 快捷键 (Shortcuts)

- **功能:** 列表展示所有快捷键。
- **交互:** 点击录制新快捷键，支持重置。
- **预设:**
  - 新建聊天: `Cmd+N`
  - 全局快速聊天 (Overlay): `Cmd+Shift+Space`
  - 搜索: `Cmd+F`

### 4.3 聊天主界面 (Chat Interface)

- **Header:** 显示当前 Topic 及消息数。
- **消息流 (Message Stream):**
  - **用户消息:** 右侧，深色气泡。
  - **AI 消息:** 左侧，显示头像、模型名。
  - **元数据:** 显示 "思考了 X 秒" (Thinking time)。
  - **工具输出:** 如果调用了工具 (如 AppleScript 读取邮件)，需展示折叠的工具执行状态。
- **输入框 (Input Area):**
  - 多行文本域 (Textarea)。
  - **功能图标:** 附件 (Clip), 提示词增强 (Magic), 联网搜索 (Globe), 视觉识别 (Eye)。
  - **模型切换:** 底部居中显示当前模型 (e.g., "Gemini Flash Latest")，点击可快速切换。

---

## 5. 数据结构 (Data Schema)

请在开发时使用以下 TypeScript 接口定义：

```typescript
// 设置存储 (Settings Store)
interface AppSettings {
  general: {
    toolModel: string;
    language: "zh" | "en";
    launchAtLogin: boolean;
    minimizeToTray: boolean;
  };
  providers: Record<string, ProviderConfig>;
  chat: {
    temperature: number; // 0.0 - 2.0
    maxTokens: number;
    enableStreaming: boolean;
    showTokenUsage: boolean;
    enableMarkdown: boolean;
    enableSoundEffects: boolean;
    historyRetentionDays: number;
  };
  memory: {
    enabled: boolean;
    autoRetrieve: boolean;
    queryRewriting: boolean;
    maxContextCount: number; // 1-20
    similarityThreshold: number; // 0.0 - 1.0
  };
  shortcuts: Record<string, string>;
}

interface ProviderConfig {
  id: string;
  enabled: boolean;
  apiKey: string;
  baseUrl?: string;
  models: string[];
}

// 消息与会话 (Chat Session)
interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  meta?: {
    thinkingTimeMs?: number; // 思考耗时
    tokenUsage?: { prompt: number; completion: number };
    toolCalls?: any[]; // 工具调用详情
  };
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  providerId: string; // 该会话使用的默认模型
  modelId: string;
}
```
