// 存储服务 - 用于持久化配置和聊天数据
// 支持 Electron (electron-store) 和浏览器 (localStorage) 环境

// ==================== 存储抽象层 ====================

// 检测是否在 Electron 环境
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.storeGet;
}

// 内存缓存 - 用于同步读取
let memoryCache: Record<string, unknown> = {};
let isCacheInitialized = false;
let initPromise: Promise<void> | null = null;

// 初始化存储 - 从 electron-store 或 localStorage 加载数据到内存
export async function initializeStorage(): Promise<void> {
  if (isCacheInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (isElectron()) {
      try {
        // 从 electron-store 加载所有数据
        const allData = await window.electronAPI!.storeGetAll();
        memoryCache = allData as Record<string, unknown>;

        // 检查是否需要从 localStorage 迁移
        const needsMigration = !memoryCache['_migrated'];
        if (needsMigration) {
          await migrateFromLocalStorage();
        }
      } catch (e) {
        console.error('Failed to initialize electron-store:', e);
        // 回退到 localStorage
        loadFromLocalStorage();
      }
    } else {
      loadFromLocalStorage();
    }
    isCacheInitialized = true;
  })();

  return initPromise;
}

// 从 localStorage 加载到内存缓存
function loadFromLocalStorage(): void {
  for (const key of Object.keys(STORAGE_KEYS)) {
    const storageKey = STORAGE_KEYS[key as keyof typeof STORAGE_KEYS];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        memoryCache[storageKey] = JSON.parse(stored);
      }
    } catch (e) {
      console.error(`Failed to load ${storageKey} from localStorage:`, e);
    }
  }
}

// 从 localStorage 迁移到 electron-store
async function migrateFromLocalStorage(): Promise<void> {
  if (!isElectron()) return;

  const migrationData: Record<string, unknown> = {};
  for (const key of Object.keys(STORAGE_KEYS)) {
    const storageKey = STORAGE_KEYS[key as keyof typeof STORAGE_KEYS];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        migrationData[storageKey] = JSON.parse(stored);
      }
    } catch (e) {
      console.error(`Failed to read ${storageKey} for migration:`, e);
    }
  }

  if (Object.keys(migrationData).length > 0) {
    try {
      await window.electronAPI!.storeMigrate(migrationData);
      // 更新内存缓存
      Object.assign(memoryCache, migrationData);
      // 标记迁移完成
      await window.electronAPI!.storeSet('_migrated', true);
      memoryCache['_migrated'] = true;
      console.log('Migration from localStorage completed');
    } catch (e) {
      console.error('Migration failed:', e);
    }
  } else {
    // 没有数据需要迁移，标记完成
    await window.electronAPI!.storeSet('_migrated', true);
    memoryCache['_migrated'] = true;
  }
}

// 同步读取（从内存缓存）
function storageGet<T>(key: string, defaultValue: T): T {
  if (!isCacheInitialized) {
    // 如果缓存未初始化，先尝试从 localStorage 读取
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch (e) {
      console.error(`Failed to read ${key}:`, e);
    }
    return defaultValue;
  }

  const value = memoryCache[key];
  return value !== undefined ? (value as T) : defaultValue;
}

// ==================== 批量写入优化 ====================
// 写入队列 - 合并多次写入为一次批量操作
const writeQueue = new Map<string, unknown>();
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY = 100; // 100ms 内的写入会被合并

// 执行批量写入
async function flushWrites(): Promise<void> {
  if (writeQueue.size === 0) return;

  const batch = new Map(writeQueue);
  writeQueue.clear();
  flushTimeout = null;

  if (isElectron()) {
    try {
      // 批量写入到 electron-store
      const batchObj = Object.fromEntries(batch);
      await window.electronAPI!.storeBatch(batchObj);
    } catch (e) {
      console.error('Failed to batch write to electron-store:', e);
      // 回退到单独写入
      for (const [key, value] of batch) {
        try {
          await window.electronAPI!.storeSet(key, value);
        } catch (err) {
          console.error(`Failed to persist ${key}:`, err);
        }
      }
    }
  } else {
    // localStorage 批量写入
    for (const [key, value] of batch) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error(`Failed to save ${key} to localStorage:`, e);
      }
    }
  }
}

// 同步写入（更新内存缓存，延迟批量持久化）
function storageSet(key: string, value: unknown): void {
  // 更新内存缓存
  memoryCache[key] = value;

  // 添加到写入队列
  writeQueue.set(key, value);

  // 设置延迟刷新
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushWrites();
    }, FLUSH_DELAY);
  }
}

// 同步删除
export function storageDelete(key: string): void {
  delete memoryCache[key];

  if (isElectron()) {
    window.electronAPI!.storeDelete(key).catch((e) => {
      console.error(`Failed to delete ${key} from electron-store:`, e);
    });
  } else {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`Failed to delete ${key} from localStorage:`, e);
    }
  }
}

// ==================== 模型能力相关 ====================

// 模型能力接口
export interface ModelCapabilities {
  reasoning?: boolean;        // 推理/扩展思考
  functionCalling?: boolean;  // 工具调用
  vision?: boolean;           // 视觉识别
}

// 推理强度级别
export type ReasoningLevel = 'off' | 'low' | 'medium' | 'high';

// 工具选择模式
export type ToolSelectionMode = 'auto' | 'all' | 'none' | 'custom';

export interface ModelConfig {
  id: string;
  enabled: boolean;
  capabilities?: ModelCapabilities;  // 模型能力
}

export interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  apiKey: string;
  baseUrl?: string;
  models: ModelConfig[];
}

// 保存的工具调用记录
export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  error?: string;
  success: boolean;
  duration?: number; // 毫秒
}

// 用量信息
export interface UsageInfo {
  promptTokens: number;      // 输入 Token
  completionTokens: number;  // 输出 Token
  totalTokens: number;       // 总 Token
  firstTokenTime?: number;   // 首个 Token 时间（毫秒）
  tokensPerSecond?: number;  // Token/秒
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;        // AI 回复使用的模型
  providerName?: string; // 提供商名称
  // 新增：工具调用相关
  toolCalls?: ToolCallRecord[];  // 工具调用记录
  thinkingTime?: number;         // 思考时间（毫秒）
  // 新增：用量信息
  usage?: UsageInfo;
  // 新增：文件附件
  attachments?: FileAttachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// 记忆项接口
export interface Memory {
  id: string;
  content: string;
  source: 'auto' | 'manual';  // 来源：自动生成或手动添加
  createdAt: number;
  updatedAt: number;
  embedding?: number[];  // 向量嵌入（可选）
  // 智能遗忘相关字段
  importance: number;       // 重要性分数 0-100
  accessCount: number;      // 被访问/引用次数
  lastAccessedAt: number;   // 最后访问时间
  pinned: boolean;          // 用户标记为重要（不会被遗忘）
}

// 衰减速率类型
export type DecayRate = 'fast' | 'normal' | 'slow';

// 清理频率类型
export type CleanupFrequency = 'after_chat' | 'daily' | 'manual';

// 记忆设置接口
export interface MemorySettings {
  // 记忆功能
  enabled: boolean;
  
  // 记忆检索
  autoRetrieve: boolean;
  queryRewriting: boolean;
  maxRetrieveCount: number;  // 1-20
  similarityThreshold: number;  // 0-100
  
  // 记忆总结
  autoSummarize: boolean;
  
  // 模型配置
  toolModel: string;  // 记忆工具模型，空字符串表示使用默认
  embeddingModel: string;  // 嵌入模型
  
  // 智能遗忘设置
  forgettingEnabled: boolean;      // 是否启用智能遗忘
  maxMemoryCount: number;          // 最大记忆数量限制
  importanceThreshold: number;     // 重要性阈值（低于此分数自动清理）0-100
  decayRate: DecayRate;            // 衰减速率
  cleanupFrequency: CleanupFrequency;  // 清理频率
}

// 默认记忆设置
const defaultMemorySettings: MemorySettings = {
  enabled: false,
  autoRetrieve: true,
  queryRewriting: true,
  maxRetrieveCount: 5,
  similarityThreshold: 10,
  autoSummarize: true,
  toolModel: '',
  embeddingModel: 'text-embedding-3-small',
  // 智能遗忘默认设置
  forgettingEnabled: true,
  maxMemoryCount: 100,
  importanceThreshold: 20,
  decayRate: 'normal',
  cleanupFrequency: 'after_chat',
};

// ==================== 搜索 API 配置 ====================

// 搜索 API 提供商类型
export type SearchApiProvider = 'none' | 'serpapi' | 'brave' | 'google';

// 搜索 API 配置接口
export interface SearchApiConfig {
  provider: SearchApiProvider;
  apiKey: string;
  enabled: boolean;
  // Google Custom Search API 需要额外的 Search Engine ID
  searchEngineId?: string;
}

// 默认搜索 API 配置
const defaultSearchApiConfig: SearchApiConfig = {
  provider: 'none',
  apiKey: '',
  enabled: false,
};

// ==================== 工具相关 ====================

// 工具接口
export interface Tool {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  enabled: boolean;
}

// 工具分类接口
export interface ToolCategory {
  id: string;
  name: string;
  icon?: string;
  expanded?: boolean;
}

// 默认工具分类
const defaultToolCategories: ToolCategory[] = [
  { id: 'network', name: '网络与搜索', icon: 'globe', expanded: true },
  { id: 'workspace', name: '工作区与文件', icon: 'folder', expanded: true },
  { id: 'utility', name: '实用工具', icon: 'wrench', expanded: true },
  { id: 'macos', name: 'macOS 系统', icon: 'apple', expanded: true },
];

// 默认工具列表
const defaultTools: Tool[] = [
  { id: 'web_fetch', name: '网络获取', description: '抓取 URL 的原始内容', categoryId: 'network', enabled: true },
  { id: 'web_search', name: '网络搜索', description: '在网上搜索最新信息', categoryId: 'network', enabled: true },
  { id: 'glob_files', name: 'Glob 文件', description: '用 glob 模式列出匹配的文件', categoryId: 'workspace', enabled: true },
  { id: 'read_file', name: '读取文件', description: '读取工作区文件内容', categoryId: 'workspace', enabled: true },
  { id: 'get_current_time', name: '获取时间', description: '获取当前的日期和时间', categoryId: 'utility', enabled: true },
  { id: 'calculator', name: '计算器', description: '执行数学计算表达式', categoryId: 'utility', enabled: true },
  { id: 'mac_calendar_create_event', name: '创建日历事件', description: '在 macOS 日历中创建事件', categoryId: 'macos', enabled: true },
  { id: 'mac_calendar_list_today', name: '查看今日日历', description: '读取今天的日历事件', categoryId: 'macos', enabled: true },
  { id: 'mac_reminder_add', name: '添加提醒事项', description: '在提醒事项中创建代办', categoryId: 'macos', enabled: true },
  { id: 'mac_reminder_list_today', name: '查看今日提醒', description: '读取今天到期的提醒', categoryId: 'macos', enabled: true },
  { id: 'mac_set_volume', name: '设置音量', description: '调整系统输出音量 (0-100)', categoryId: 'macos', enabled: true },
  { id: 'mac_open_app', name: '打开应用', description: '打开指定的 macOS 应用', categoryId: 'macos', enabled: true },
  { id: 'mac_run_shell', name: '运行 Shell', description: '执行本机 shell 命令', categoryId: 'macos', enabled: true },
  { id: 'mac_run_applescript', name: '运行 AppleScript', description: '执行 AppleScript 脚本', categoryId: 'macos', enabled: true },
];

const STORAGE_KEYS = {
  PROVIDERS: 'tageai_providers',
  CHAT_SESSIONS: 'tageai_chat_sessions',
  SETTINGS: 'tageai_settings',
  MEMORIES: 'tageai_memories',
  MEMORY_SETTINGS: 'tageai_memory_settings',
  TOOLS: 'tageai_tools',
  TOOL_CATEGORIES: 'tageai_tool_categories',
  SEARCH_API_CONFIG: 'tageai_search_api_config',
  CHAT_SETTINGS: 'tageai_chat_settings',
  GENERAL_SETTINGS: 'tageai_general_settings',
  UI_SETTINGS: 'tageai_ui_settings',
};

// ==================== 设置接口 ====================

// 聊天设置接口
export interface ChatSettings {
  temperature: number;           // 0-2, 默认 0.7
  maxTokens: number;             // 1-32000, 默认 2048
  enableStreaming: boolean;      // 默认 true
  showTokenUsage: boolean;       // 默认 true
  enableMarkdown: boolean;       // 默认 true
  enableSoundEffects: boolean;   // 默认 false
  autoSave: boolean;             // 默认 true
  historyRetentionDays: number;  // 默认 30
}

// 默认聊天设置
const defaultChatSettings: ChatSettings = {
  temperature: 0.7,
  maxTokens: 2048,
  enableStreaming: true,
  showTokenUsage: true,
  enableMarkdown: true,
  enableSoundEffects: false,
  autoSave: true,
  historyRetentionDays: 30,
};

// 通用设置接口
export interface GeneralSettings {
  toolModel: string;              // 工具模型，空字符串表示使用默认
  language: 'zh' | 'en';          // 默认 'zh'
  launchAtLogin: boolean;         // 默认 false
  minimizeToTray: boolean;        // 默认 false
}

// 默认通用设置
const defaultGeneralSettings: GeneralSettings = {
  toolModel: '',
  language: 'zh',
  launchAtLogin: false,
  minimizeToTray: false,
};

// UI 设置接口
export type ThemeMode = 'light' | 'dark' | 'system';

export interface UISettings {
  theme: ThemeMode;               // 默认 'system'
  compactMode: boolean;           // 默认 false
  showSidebar: boolean;           // 默认 true
}

// 默认 UI 设置
const defaultUISettings: UISettings = {
  theme: 'system',
  compactMode: false,
  showSidebar: true,
};

// 默认提供商配置
const defaultProviders: Provider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-chat', enabled: true, capabilities: { functionCalling: true } },
      { id: 'deepseek-reasoner', enabled: true, capabilities: { reasoning: true } },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4', enabled: true, capabilities: { functionCalling: true, vision: true } },
      { id: 'gpt-4-turbo', enabled: true, capabilities: { functionCalling: true, vision: true } },
      { id: 'gpt-4o', enabled: true, capabilities: { functionCalling: true, vision: true } },
      { id: 'gpt-3.5-turbo', enabled: true, capabilities: { functionCalling: true } },
      { id: 'o1', enabled: true, capabilities: { reasoning: true } },
      { id: 'o1-mini', enabled: true, capabilities: { reasoning: true } },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-3-opus-20240229', enabled: true, capabilities: { functionCalling: true, vision: true } },
      { id: 'claude-3-sonnet-20240229', enabled: true, capabilities: { functionCalling: true, vision: true } },
      { id: 'claude-3-haiku-20240307', enabled: true, capabilities: { functionCalling: true, vision: true } },
      { id: 'claude-3-5-sonnet-20241022', enabled: true, capabilities: { functionCalling: true, vision: true } },
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-pro', enabled: true, capabilities: { functionCalling: true } },
      { id: 'gemini-pro-vision', enabled: true, capabilities: { functionCalling: true, vision: true } },
      { id: 'gemini-2.5-pro', enabled: true, capabilities: { functionCalling: true, reasoning: true, vision: true } },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [],
  },
];

// 迁移旧数据格式 (string[] -> ModelConfig[])
function migrateModels(models: (string | ModelConfig)[]): ModelConfig[] {
  return models.map((m) => {
    if (typeof m === 'string') {
      // 根据已知模型名自动添加能力
      return { id: m, enabled: true, capabilities: getModelCapabilities(m) };
    }
    // 如果没有 capabilities，尝试自动推断
    if (!m.capabilities) {
      return { ...m, capabilities: getModelCapabilities(m.id) };
    }
    return m;
  });
}

// 根据模型名称推断能力
function getModelCapabilities(modelId: string): ModelCapabilities {
  const id = modelId.toLowerCase();
  const capabilities: ModelCapabilities = {};
  
  // 推理能力检测
  if (id.includes('reasoner') || id.includes('o1') || id.includes('thinking') || 
      id.includes('2.5-pro') || id.includes('2.5pro')) {
    capabilities.reasoning = true;
  }
  
  // 视觉能力检测
  if (id.includes('vision') || id.includes('4o') || id.includes('gpt-4-turbo') ||
      id.includes('claude-3') || id.includes('gemini')) {
    capabilities.vision = true;
  }
  
  // 工具调用能力检测（大多数现代模型都支持）
  if (!id.includes('reasoner') && !id.includes('o1-') && !id.includes('o1')) {
    // 推理模型通常不支持工具调用
    capabilities.functionCalling = true;
  }
  
  return capabilities;
}

// 提供商相关
export function getProviders(): Provider[] {
  try {
    const stored = storageGet<Provider[] | null>(STORAGE_KEYS.PROVIDERS, null);
    if (stored) {
      // 迁移旧数据格式
      const migrated = stored.map((p) => ({
        ...p,
        models: migrateModels(p.models as (string | ModelConfig)[]),
      }));
      return migrated;
    }
  } catch (e) {
    console.error('Failed to load providers:', e);
  }
  return defaultProviders;
}

export function saveProviders(providers: Provider[]): void {
  try {
    storageSet(STORAGE_KEYS.PROVIDERS, providers);
    // 触发自定义事件通知其他组件配置已更改
    window.dispatchEvent(new CustomEvent('providers-updated'));
  } catch (e) {
    console.error('Failed to save providers:', e);
  }
}

export function getEnabledProvider(): Provider | null {
  const providers = getProviders();
  return providers.find((p) => p.enabled && p.apiKey) || null;
}

export function getProviderById(id: string): Provider | null {
  const providers = getProviders();
  return providers.find((p) => p.id === id) || null;
}

// 获取所有启用且配置了 API Key 的提供商
export function getActiveProviders(): Provider[] {
  const providers = getProviders();
  return providers.filter((p) => p.enabled && p.apiKey);
}

// 模型信息（包含能力）
export interface ModelInfo {
  id: string;
  capabilities?: ModelCapabilities;
}

// 获取当前活跃提供商的可用模型（只返回启用的模型）
export function getAvailableModels(): { providerId: string; providerName: string; models: string[] }[] {
  const activeProviders = getActiveProviders();
  return activeProviders.map((p) => {
    // 只返回启用的模型
    const enabledModels = p.models.filter((m) => m.enabled).map((m) => m.id);
    return {
      providerId: p.id,
      providerName: p.name,
      models: enabledModels.length > 0 ? enabledModels : getDefaultModels(p.id),
    };
  });
}

// 获取当前活跃提供商的可用模型（包含能力信息）
export function getAvailableModelsWithCapabilities(): { 
  providerId: string; 
  providerName: string; 
  models: ModelInfo[] 
}[] {
  const activeProviders = getActiveProviders();
  return activeProviders.map((p) => {
    // 只返回启用的模型（包含能力）
    const enabledModels = p.models
      .filter((m) => m.enabled)
      .map((m) => ({ id: m.id, capabilities: m.capabilities }));
    return {
      providerId: p.id,
      providerName: p.name,
      models: enabledModels.length > 0 ? enabledModels : getDefaultModelsWithCapabilities(p.id),
    };
  });
}

// 获取指定模型的能力
export function getModelCapabilitiesById(providerId: string, modelId: string): ModelCapabilities | undefined {
  const provider = getProviderById(providerId);
  if (!provider) return undefined;
  
  const model = provider.models.find((m) => m.id === modelId);
  return model?.capabilities;
}

// 获取提供商的默认模型（包含能力）
function getDefaultModelsWithCapabilities(providerId: string): ModelInfo[] {
  const defaultProvider = defaultProviders.find((p) => p.id === providerId);
  if (defaultProvider) {
    return defaultProvider.models.map((m) => ({ id: m.id, capabilities: m.capabilities }));
  }
  return [];
}

// 获取提供商的默认模型
function getDefaultModels(providerId: string): string[] {
  switch (providerId) {
    case 'deepseek':
      return ['deepseek-chat', 'deepseek-reasoner'];
    case 'openai':
      return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    case 'anthropic':
      return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
    case 'google':
      return ['gemini-pro', 'gemini-pro-vision'];
    case 'openrouter':
      return [];
    default:
      return [];
  }
}

// 聊天会话相关
export function getChatSessions(): ChatSession[] {
  try {
    const stored = storageGet<ChatSession[] | null>(STORAGE_KEYS.CHAT_SESSIONS, null);
    if (stored) {
      return stored;
    }
  } catch (e) {
    console.error('Failed to load chat sessions:', e);
  }
  return [];
}

export function saveChatSessions(sessions: ChatSession[]): void {
  try {
    storageSet(STORAGE_KEYS.CHAT_SESSIONS, sessions);
  } catch (e) {
    console.error('Failed to save chat sessions:', e);
  }
}

export function getChatSession(id: string): ChatSession | null {
  const sessions = getChatSessions();
  return sessions.find((s) => s.id === id) || null;
}

export function createChatSession(title: string = '新对话'): ChatSession {
  const session: ChatSession = {
    id: crypto.randomUUID(),
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  const sessions = getChatSessions();
  sessions.unshift(session);
  saveChatSessions(sessions);
  
  return session;
}

export function updateChatSession(id: string, updates: Partial<ChatSession>): void {
  const sessions = getChatSessions();
  const index = sessions.findIndex((s) => s.id === id);
  if (index !== -1) {
    sessions[index] = { ...sessions[index], ...updates, updatedAt: Date.now() };
    saveChatSessions(sessions);
  }
}

export function deleteChatSession(id: string): void {
  const sessions = getChatSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  saveChatSessions(filtered);
}

export function addMessageToSession(
  sessionId: string,
  message: Omit<Message, 'id' | 'timestamp'>
): Message {
  const sessions = getChatSessions();
  const session = sessions.find((s) => s.id === sessionId);
  
  const newMessage: Message = {
    ...message,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  
  if (session) {
    session.messages.push(newMessage);
    session.updatedAt = Date.now();
    
    // 如果是第一条用户消息，更新会话标题
    if (session.messages.length === 1 && message.role === 'user') {
      session.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
    }
    
    saveChatSessions(sessions);
  }
  
  return newMessage;
}

export function updateMessageInSession(
  sessionId: string,
  messageId: string,
  content: string
): void {
  const sessions = getChatSessions();
  const session = sessions.find((s) => s.id === sessionId);
  
  if (session) {
    const message = session.messages.find((m) => m.id === messageId);
    if (message) {
      message.content = content;
      session.updatedAt = Date.now();
      saveChatSessions(sessions);
    }
  }
}

export function deleteMessageFromSession(
  sessionId: string,
  messageId: string
): void {
  const sessions = getChatSessions();
  const session = sessions.find((s) => s.id === sessionId);
  
  if (session) {
    session.messages = session.messages.filter((m) => m.id !== messageId);
    session.updatedAt = Date.now();
    saveChatSessions(sessions);
  }
}

// ==================== 记忆相关 ====================

// 获取记忆设置
export function getMemorySettings(): MemorySettings {
  try {
    const stored = storageGet<Partial<MemorySettings> | null>(STORAGE_KEYS.MEMORY_SETTINGS, null);
    if (stored) {
      return { ...defaultMemorySettings, ...stored };
    }
  } catch (e) {
    console.error('Failed to load memory settings:', e);
  }
  return defaultMemorySettings;
}

// 保存记忆设置
export function saveMemorySettings(settings: MemorySettings): void {
  try {
    storageSet(STORAGE_KEYS.MEMORY_SETTINGS, settings);
    window.dispatchEvent(new CustomEvent('memory-settings-updated'));
  } catch (e) {
    console.error('Failed to save memory settings:', e);
  }
}

// 迁移旧记忆数据格式
function migrateMemory(memory: Partial<Memory> & { id: string; content: string }): Memory {
  const now = Date.now();
  return {
    id: memory.id,
    content: memory.content,
    source: memory.source || 'manual',
    createdAt: memory.createdAt || now,
    updatedAt: memory.updatedAt || now,
    embedding: memory.embedding,
    // 新增字段的默认值
    importance: memory.importance ?? (memory.source === 'manual' ? 60 : 40),
    accessCount: memory.accessCount ?? 0,
    lastAccessedAt: memory.lastAccessedAt ?? (memory.createdAt || now),
    pinned: memory.pinned ?? false,
  };
}

// 获取所有记忆
export function getMemories(): Memory[] {
  try {
    const stored = storageGet<Partial<Memory>[] | null>(STORAGE_KEYS.MEMORIES, null);
    if (stored) {
      // 迁移旧数据格式
      return stored.map((m) => migrateMemory(m as Partial<Memory> & { id: string; content: string }));
    }
  } catch (e) {
    console.error('Failed to load memories:', e);
  }
  return [];
}

// 保存所有记忆
export function saveMemories(memories: Memory[]): void {
  try {
    storageSet(STORAGE_KEYS.MEMORIES, memories);
    window.dispatchEvent(new CustomEvent('memories-updated'));
  } catch (e) {
    console.error('Failed to save memories:', e);
  }
}

// 添加记忆
export function addMemory(content: string, source: 'auto' | 'manual' = 'manual'): Memory {
  const memories = getMemories();
  const now = Date.now();
  // 手动添加的初始重要性分数为 60，自动生成的为 40
  const initialImportance = source === 'manual' ? 60 : 40;
  const newMemory: Memory = {
    id: crypto.randomUUID(),
    content,
    source,
    createdAt: now,
    updatedAt: now,
    importance: initialImportance,
    accessCount: 0,
    lastAccessedAt: now,
    pinned: false,
  };
  memories.unshift(newMemory);
  saveMemories(memories);
  return newMemory;
}

// 更新记忆
export function updateMemory(id: string, content: string): void {
  const memories = getMemories();
  const index = memories.findIndex((m) => m.id === id);
  if (index !== -1) {
    memories[index] = {
      ...memories[index],
      content,
      updatedAt: Date.now(),
    };
    saveMemories(memories);
  }
}

// 删除记忆
export function deleteMemory(id: string): void {
  const memories = getMemories();
  const filtered = memories.filter((m) => m.id !== id);
  saveMemories(filtered);
}

// 更新记忆的嵌入向量
export function updateMemoryEmbedding(id: string, embedding: number[]): void {
  const memories = getMemories();
  const index = memories.findIndex((m) => m.id === id);
  if (index !== -1) {
    memories[index].embedding = embedding;
    saveMemories(memories);
  }
}

// 清空所有记忆
export function clearAllMemories(): void {
  saveMemories([]);
}

// 获取记忆统计
export function getMemoryStats(): { total: number; auto: number; manual: number } {
  const memories = getMemories();
  return {
    total: memories.length,
    auto: memories.filter((m) => m.source === 'auto').length,
    manual: memories.filter((m) => m.source === 'manual').length,
  };
}

// 搜索记忆（简单文本搜索，实际使用时可替换为向量搜索）
export function searchMemories(query: string): Memory[] {
  if (!query.trim()) return getMemories();
  
  const memories = getMemories();
  const lowerQuery = query.toLowerCase();
  return memories.filter((m) => 
    m.content.toLowerCase().includes(lowerQuery)
  );
}

// ==================== 智能遗忘相关 ====================

// 衰减因子配置
const DECAY_FACTORS: Record<DecayRate, number> = {
  fast: 0.95,    // 每天衰减 5%
  normal: 0.98,  // 每天衰减 2%
  slow: 0.995,   // 每天衰减 0.5%
};

// 计算记忆的当前重要性分数
export function calculateImportance(memory: Memory, decayRate: DecayRate = 'normal'): number {
  // 如果被固定，返回最高分
  if (memory.pinned) {
    return 100;
  }
  
  const now = Date.now();
  const daysSinceLastAccess = (now - memory.lastAccessedAt) / (1000 * 60 * 60 * 24);
  const decayFactor = DECAY_FACTORS[decayRate];
  
  // 基础分（根据来源）
  const baseScore = memory.source === 'manual' ? 60 : 40;
  
  // 时间衰减：基础分 × 衰减因子^(天数)
  const decayedScore = baseScore * Math.pow(decayFactor, daysSinceLastAccess);
  
  // 访问加成：log(accessCount + 1) × 10
  const accessBonus = Math.log(memory.accessCount + 1) * 10;
  
  // 最终分数，限制在 0-100
  const finalScore = Math.min(100, Math.max(0, decayedScore + accessBonus));
  
  return Math.round(finalScore * 10) / 10; // 保留一位小数
}

// 记录记忆被访问
export function recordMemoryAccess(id: string): void {
  const memories = getMemories();
  const index = memories.findIndex((m) => m.id === id);
  if (index !== -1) {
    const now = Date.now();
    memories[index] = {
      ...memories[index],
      accessCount: memories[index].accessCount + 1,
      lastAccessedAt: now,
      updatedAt: now,
    };
    saveMemories(memories);
  }
}

// 批量记录多个记忆被访问
export function recordMemoriesAccess(ids: string[]): void {
  if (ids.length === 0) return;
  
  const memories = getMemories();
  const now = Date.now();
  const idSet = new Set(ids);
  
  const updated = memories.map((m) => {
    if (idSet.has(m.id)) {
      return {
        ...m,
        accessCount: m.accessCount + 1,
        lastAccessedAt: now,
        updatedAt: now,
      };
    }
    return m;
  });
  
  saveMemories(updated);
}

// 切换记忆的固定状态
export function toggleMemoryPinned(id: string): boolean {
  const memories = getMemories();
  const index = memories.findIndex((m) => m.id === id);
  if (index !== -1) {
    const newPinned = !memories[index].pinned;
    memories[index] = {
      ...memories[index],
      pinned: newPinned,
      updatedAt: Date.now(),
    };
    saveMemories(memories);
    return newPinned;
  }
  return false;
}

// 获取所有记忆及其当前重要性分数
export function getMemoriesWithImportance(decayRate: DecayRate = 'normal'): (Memory & { currentImportance: number })[] {
  const memories = getMemories();
  return memories.map((m) => ({
    ...m,
    currentImportance: calculateImportance(m, decayRate),
  }));
}

// 获取增强的记忆统计
export function getMemoryStatsEnhanced(decayRate: DecayRate = 'normal'): {
  total: number;
  auto: number;
  manual: number;
  pinned: number;
  avgImportance: number;
  belowThreshold: number;  // 低于阈值的记忆数
  threshold: number;
} {
  const settings = getMemorySettings();
  const memories = getMemoriesWithImportance(decayRate);
  
  const total = memories.length;
  const auto = memories.filter((m) => m.source === 'auto').length;
  const manual = memories.filter((m) => m.source === 'manual').length;
  const pinned = memories.filter((m) => m.pinned).length;
  
  const avgImportance = total > 0
    ? Math.round(memories.reduce((sum, m) => sum + m.currentImportance, 0) / total * 10) / 10
    : 0;
  
  const belowThreshold = memories.filter(
    (m) => !m.pinned && m.currentImportance < settings.importanceThreshold
  ).length;
  
  return {
    total,
    auto,
    manual,
    pinned,
    avgImportance,
    belowThreshold,
    threshold: settings.importanceThreshold,
  };
}

// 预览将被清理的记忆
export function previewCleanup(): {
  toDelete: (Memory & { currentImportance: number })[];
  willKeep: (Memory & { currentImportance: number })[];
  reason: 'threshold' | 'limit' | 'both' | 'none';
} {
  const settings = getMemorySettings();
  const memories = getMemoriesWithImportance(settings.decayRate);
  
  // 分离固定和非固定记忆
  const pinnedMemories = memories.filter((m) => m.pinned);
  const unpinnedMemories = memories.filter((m) => !m.pinned);
  
  // 按重要性分数排序（降序）
  unpinnedMemories.sort((a, b) => b.currentImportance - a.currentImportance);
  
  const toDelete: (Memory & { currentImportance: number })[] = [];
  const willKeep: (Memory & { currentImportance: number })[] = [...pinnedMemories];
  
  let reason: 'threshold' | 'limit' | 'both' | 'none' = 'none';
  
  for (const memory of unpinnedMemories) {
    // 检查是否低于阈值
    const belowThreshold = memory.currentImportance < settings.importanceThreshold;
    // 检查是否超过数量限制（包括固定的）
    const overLimit = willKeep.length >= settings.maxMemoryCount;
    
    if (belowThreshold || overLimit) {
      toDelete.push(memory);
      if (belowThreshold && overLimit) {
        reason = 'both';
      } else if (belowThreshold && reason !== 'both') {
        reason = reason === 'limit' ? 'both' : 'threshold';
      } else if (overLimit && reason !== 'both') {
        reason = reason === 'threshold' ? 'both' : 'limit';
      }
    } else {
      willKeep.push(memory);
    }
  }
  
  return { toDelete, willKeep, reason };
}

// 执行智能遗忘清理
export function performSmartCleanup(): {
  deletedCount: number;
  deletedMemories: Memory[];
  reason: string;
} {
  const settings = getMemorySettings();
  
  if (!settings.forgettingEnabled) {
    return { deletedCount: 0, deletedMemories: [], reason: '智能遗忘功能已禁用' };
  }
  
  const { toDelete, willKeep, reason } = previewCleanup();
  
  if (toDelete.length === 0) {
    return { deletedCount: 0, deletedMemories: [], reason: '没有需要清理的记忆' };
  }
  
  // 保存保留的记忆（去除 currentImportance 字段）
  const memoriesToKeep: Memory[] = willKeep.map(({ currentImportance, ...m }) => m);
  saveMemories(memoriesToKeep);
  
  // 生成清理原因描述
  let reasonText = '';
  switch (reason) {
    case 'threshold':
      reasonText = `清理了 ${toDelete.length} 条重要性低于 ${settings.importanceThreshold} 分的记忆`;
      break;
    case 'limit':
      reasonText = `清理了 ${toDelete.length} 条记忆以保持在 ${settings.maxMemoryCount} 条限制内`;
      break;
    case 'both':
      reasonText = `清理了 ${toDelete.length} 条记忆（低于阈值和超出限制）`;
      break;
    default:
      reasonText = `清理了 ${toDelete.length} 条记忆`;
  }
  
  // 去除 currentImportance 字段
  const deletedMemories: Memory[] = toDelete.map(({ currentImportance, ...m }) => m);
  
  return {
    deletedCount: toDelete.length,
    deletedMemories,
    reason: reasonText,
  };
}

// 获取将被清理的记忆数量（用于 UI 预览）
export function getCleanupPreviewCount(): number {
  const { toDelete } = previewCleanup();
  return toDelete.length;
}

// 强制清理指定数量的最低重要性记忆
export function forceCleanup(count: number): {
  deletedCount: number;
  deletedMemories: Memory[];
} {
  const settings = getMemorySettings();
  const memories = getMemoriesWithImportance(settings.decayRate);
  
  // 分离固定和非固定记忆
  const pinnedMemories = memories.filter((m) => m.pinned);
  const unpinnedMemories = memories.filter((m) => !m.pinned);
  
  // 按重要性分数排序（升序，最低的在前）
  unpinnedMemories.sort((a, b) => a.currentImportance - b.currentImportance);
  
  // 取出要删除的记忆
  const toDelete = unpinnedMemories.slice(0, Math.min(count, unpinnedMemories.length));
  const toKeep = unpinnedMemories.slice(Math.min(count, unpinnedMemories.length));
  
  // 合并保留的记忆
  const memoriesToKeep: Memory[] = [...pinnedMemories, ...toKeep].map(
    ({ currentImportance, ...m }) => m
  );
  saveMemories(memoriesToKeep);
  
  const deletedMemories: Memory[] = toDelete.map(({ currentImportance, ...m }) => m);
  
  return {
    deletedCount: toDelete.length,
    deletedMemories,
  };
}

// ==================== 工具管理相关 ====================

// 获取所有工具
export function getTools(): Tool[] {
  try {
    const stored = storageGet<Tool[] | null>(STORAGE_KEYS.TOOLS, null);
    if (stored) {
      return stored;
    }
  } catch (e) {
    console.error('Failed to load tools:', e);
  }
  return defaultTools;
}

// 保存所有工具
export function saveTools(tools: Tool[]): void {
  try {
    storageSet(STORAGE_KEYS.TOOLS, tools);
    window.dispatchEvent(new CustomEvent('tools-updated'));
  } catch (e) {
    console.error('Failed to save tools:', e);
  }
}

// 获取工具分类
export function getToolCategories(): ToolCategory[] {
  try {
    const stored = storageGet<ToolCategory[] | null>(STORAGE_KEYS.TOOL_CATEGORIES, null);
    if (stored) {
      return stored;
    }
  } catch (e) {
    console.error('Failed to load tool categories:', e);
  }
  return defaultToolCategories;
}

// 保存工具分类
export function saveToolCategories(categories: ToolCategory[]): void {
  try {
    storageSet(STORAGE_KEYS.TOOL_CATEGORIES, categories);
    window.dispatchEvent(new CustomEvent('tool-categories-updated'));
  } catch (e) {
    console.error('Failed to save tool categories:', e);
  }
}

// 添加工具
export function addTool(tool: Omit<Tool, 'id'>): Tool {
  const tools = getTools();
  const newTool: Tool = {
    ...tool,
    id: crypto.randomUUID(),
  };
  tools.push(newTool);
  saveTools(tools);
  return newTool;
}

// 更新工具
export function updateTool(id: string, updates: Partial<Tool>): void {
  const tools = getTools();
  const index = tools.findIndex((t) => t.id === id);
  if (index !== -1) {
    tools[index] = { ...tools[index], ...updates };
    saveTools(tools);
  }
}

// 删除工具
export function deleteTool(id: string): void {
  const tools = getTools();
  const filtered = tools.filter((t) => t.id !== id);
  saveTools(filtered);
}

// 切换工具启用状态
export function toggleToolEnabled(id: string): boolean {
  const tools = getTools();
  const index = tools.findIndex((t) => t.id === id);
  if (index !== -1) {
    const newEnabled = !tools[index].enabled;
    tools[index] = { ...tools[index], enabled: newEnabled };
    saveTools(tools);
    return newEnabled;
  }
  return false;
}

// 获取启用的工具
export function getEnabledTools(): Tool[] {
  return getTools().filter((t) => t.enabled);
}

// 按分类获取工具
export function getToolsByCategory(): { category: ToolCategory; tools: Tool[] }[] {
  const categories = getToolCategories();
  const tools = getTools();
  
  return categories.map((category) => ({
    category,
    tools: tools.filter((t) => t.categoryId === category.id),
  }));
}

// 批量设置工具启用状态
export function setAllToolsEnabled(enabled: boolean): void {
  const tools = getTools();
  const updated = tools.map((t) => ({ ...t, enabled }));
  saveTools(updated);
}

// 设置指定工具列表的启用状态
export function setToolsEnabled(toolIds: string[], enabled: boolean): void {
  const tools = getTools();
  const idSet = new Set(toolIds);
  const updated = tools.map((t) => 
    idSet.has(t.id) ? { ...t, enabled } : t
  );
  saveTools(updated);
}

// ==================== 搜索 API 配置 ====================

// 获取搜索 API 配置
export function getSearchApiConfig(): SearchApiConfig {
  try {
    const stored = storageGet<SearchApiConfig | null>(STORAGE_KEYS.SEARCH_API_CONFIG, null);
    if (stored) {
      return stored;
    }
  } catch (e) {
    console.error('Failed to load search API config:', e);
  }
  return { ...defaultSearchApiConfig };
}

// 保存搜索 API 配置
export function saveSearchApiConfig(config: SearchApiConfig): void {
  try {
    storageSet(STORAGE_KEYS.SEARCH_API_CONFIG, config);
    window.dispatchEvent(new CustomEvent('search-api-config-updated'));
  } catch (e) {
    console.error('Failed to save search API config:', e);
  }
}

// ==================== 聊天设置 ====================

// 获取聊天设置
export function getChatSettings(): ChatSettings {
  try {
    const stored = storageGet<Partial<ChatSettings> | null>(STORAGE_KEYS.CHAT_SETTINGS, null);
    if (stored) {
      return { ...defaultChatSettings, ...stored };
    }
  } catch (e) {
    console.error('Failed to load chat settings:', e);
  }
  return { ...defaultChatSettings };
}

// 保存聊天设置
export function saveChatSettings(settings: ChatSettings): void {
  try {
    storageSet(STORAGE_KEYS.CHAT_SETTINGS, settings);
    window.dispatchEvent(new CustomEvent('chat-settings-updated'));
  } catch (e) {
    console.error('Failed to save chat settings:', e);
  }
}

// 更新聊天设置（部分更新）
export function updateChatSettings(updates: Partial<ChatSettings>): ChatSettings {
  const current = getChatSettings();
  const updated = { ...current, ...updates };
  saveChatSettings(updated);
  return updated;
}

// ==================== 通用设置 ====================

// 获取通用设置
export function getGeneralSettings(): GeneralSettings {
  try {
    const stored = storageGet<Partial<GeneralSettings> | null>(STORAGE_KEYS.GENERAL_SETTINGS, null);
    if (stored) {
      return { ...defaultGeneralSettings, ...stored };
    }
  } catch (e) {
    console.error('Failed to load general settings:', e);
  }
  return { ...defaultGeneralSettings };
}

// 保存通用设置
export function saveGeneralSettings(settings: GeneralSettings): void {
  try {
    storageSet(STORAGE_KEYS.GENERAL_SETTINGS, settings);
    window.dispatchEvent(new CustomEvent('general-settings-updated'));
  } catch (e) {
    console.error('Failed to save general settings:', e);
  }
}

// 更新通用设置（部分更新）
export function updateGeneralSettings(updates: Partial<GeneralSettings>): GeneralSettings {
  const current = getGeneralSettings();
  const updated = { ...current, ...updates };
  saveGeneralSettings(updated);
  return updated;
}

// ==================== UI 设置 ====================

// 获取 UI 设置
export function getUISettings(): UISettings {
  try {
    const stored = storageGet<Partial<UISettings> | null>(STORAGE_KEYS.UI_SETTINGS, null);
    if (stored) {
      return { ...defaultUISettings, ...stored };
    }
  } catch (e) {
    console.error('Failed to load UI settings:', e);
  }
  return { ...defaultUISettings };
}

// 保存 UI 设置
export function saveUISettings(settings: UISettings): void {
  try {
    storageSet(STORAGE_KEYS.UI_SETTINGS, settings);
    window.dispatchEvent(new CustomEvent('ui-settings-updated'));
  } catch (e) {
    console.error('Failed to save UI settings:', e);
  }
}

// 更新 UI 设置（部分更新）
export function updateUISettings(updates: Partial<UISettings>): UISettings {
  const current = getUISettings();
  const updated = { ...current, ...updates };
  saveUISettings(updated);
  return updated;
}
