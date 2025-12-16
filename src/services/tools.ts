// 工具执行器服务 - 实现实际的工具调用逻辑

import { getTools, getSearchApiConfig } from './storage';

// 桌面环境检测与统一提示
function desktopOnlyResponse(details: Record<string, unknown> & { message: string }): string {
  return JSON.stringify({ ...details, suggestion: '请在桌面应用中使用该工具' }, null, 2);
}

function escapeAppleScriptString(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function runAppleScript(script: string): Promise<string> {
  // 检查是否在 Electron 桌面环境
  if (typeof window === 'undefined' || !window.electronAPI) {
    return desktopOnlyResponse({ message: 'AppleScript 工具仅在桌面应用可用' });
  }

  // 检查是否有 runAppleScript 方法
  const api = window.electronAPI as any;
  if (typeof api.runAppleScript !== 'function') {
    // 列出可用的方法以帮助调试
    const availableKeys = Object.keys(window.electronAPI).join(', ');
    console.error('electronAPI.runAppleScript is not a function. Available keys:', availableKeys);
    return desktopOnlyResponse({
      message: 'AppleScript 工具仅在桌面应用可用',
      availableAPIs: availableKeys,
    });
  }

  try {
    const result = await api.runAppleScript(script);
    return result ?? '';
  } catch (error) {
    console.error('AppleScript execution error:', error);
    throw error;
  }
}

async function runShellCommand(command: string): Promise<string> {
  // 检查是否在 Electron 桌面环境
  if (typeof window === 'undefined' || !window.electronAPI) {
    return desktopOnlyResponse({ message: 'Shell 工具仅在桌面应用可用' });
  }

  // 检查是否有 runShell 方法
  const api = window.electronAPI as any;
  if (typeof api.runShell !== 'function') {
    // 列出可用的方法以帮助调试
    const availableKeys = Object.keys(window.electronAPI).join(', ');
    console.error('electronAPI.runShell is not a function. Available keys:', availableKeys);
    return desktopOnlyResponse({
      message: 'Shell 工具仅在桌面应用可用',
      availableAPIs: availableKeys,
    });
  }

  try {
    const result = await api.runShell(command);
    return result ?? '';
  } catch (error) {
    console.error('Shell command execution error:', error);
    throw error;
  }
}

// 工具调用请求接口
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON 字符串
  };
}

// 工具执行上下文
export interface ToolContext {
  toolCall: ToolCall;
  args: Record<string, unknown>;
}

// 工具中间件接口
export type Middleware = (
  context: ToolContext,
  next: () => Promise<ToolResult>
) => Promise<ToolResult>;

// 全局中间件列表
const globalMiddlewares: Middleware[] = [];

// 注册中间件
export function useToolMiddleware(middleware: Middleware) {
  globalMiddlewares.push(middleware);
}

// 清除中间件 (用于测试或重置)
export function clearToolMiddlewares() {
  globalMiddlewares.length = 0;
}

// 工具执行结果接口
export interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: string;
  success: boolean;
  error?: string;
}

// 工具执行状态
export type ToolExecutionStatus = 'pending' | 'running' | 'completed' | 'error';

// 工具执行进度回调
export interface ToolExecutionCallbacks {
  onStart?: (toolCall: ToolCall) => void;
  onComplete?: (result: ToolResult) => void;
  onError?: (toolCallId: string, error: Error) => void;
}

// ==================== 工具实现 ====================

// 网络获取工具 - 抓取 URL 内容
async function executeWebFetch(args: { url?: string }): Promise<string> {
  const url = args.url;
  if (!url) {
    throw new Error('缺少必需参数: url');
  }

  try {
    // 使用 cors-anywhere 代理或直接请求
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TageAI/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const json = await response.json();
      return JSON.stringify(json, null, 2);
    } else if (contentType.includes('text/html')) {
      const html = await response.text();
      // 简单提取文本内容，移除 HTML 标签
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 5000); // 限制长度
      return textContent || '无法提取文本内容';
    } else {
      const text = await response.text();
      return text.slice(0, 5000);
    }
  } catch (error) {
    throw new Error(`获取 URL 失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// SerpAPI 搜索实现
async function searchWithSerpAPI(query: string, apiKey: string): Promise<string> {
  try {
    const url = `https://serpapi.com/search.json?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&engine=google`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key 无效，请检查 SerpAPI 配置');
      }
      if (response.status === 429) {
        throw new Error('API 调用次数已达上限，请稍后再试或升级套餐');
      }
      throw new Error(`SerpAPI 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // 提取搜索结果
    const results = (data.organic_results || []).slice(0, 10).map((result: any) => ({
      title: result.title || '',
      snippet: result.snippet || '',
      url: result.link || '',
    }));

    return JSON.stringify({
      query,
      provider: 'SerpAPI',
      results,
      count: results.length,
    }, null, 2);
  } catch (error) {
    throw new Error(`SerpAPI 搜索失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Brave Search API 搜索实现
async function searchWithBrave(query: string, apiKey: string): Promise<string> {
  try {
    // 检查是否在开发环境，使用代理避免 CORS 问题
    const isDev = import.meta.env.DEV;
    const baseUrl = isDev
      ? '/api/brave/res/v1/web/search'
      : 'https://api.search.brave.com/res/v1/web/search';

    const url = `${baseUrl}?q=${encodeURIComponent(query)}&count=10`;
    const response = await fetch(url, {
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
      },
    });

    if (!response.ok) {
      let errorMessage = '';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || '';
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || '';
      }

      if (response.status === 400) {
        throw new Error(`请求参数错误: ${errorMessage || '请检查查询参数格式'}`);
      }
      if (response.status === 401) {
        throw new Error('API Key 无效，请检查 Brave Search API 配置');
      }
      if (response.status === 429) {
        throw new Error('API 调用次数已达上限，请稍后再试或升级套餐');
      }
      throw new Error(`Brave Search API 请求失败: ${response.status} ${response.statusText}${errorMessage ? ' - ' + errorMessage : ''}`);
    }

    const data = await response.json();

    // 提取搜索结果
    const results = ((data.web && data.web.results) || []).map((result: any) => ({
      title: result.title || '',
      snippet: result.description || '',
      url: result.url || '',
    }));

    return JSON.stringify({
      query,
      provider: 'Brave Search API',
      results,
      count: results.length,
    }, null, 2);
  } catch (error) {
    throw new Error(`Brave Search API 搜索失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Google Custom Search API 搜索实现
async function searchWithGoogle(query: string, apiKey: string, searchEngineId: string): Promise<string> {
  try {
    // Google Custom Search API 需要两个参数：API Key 和 Custom Search Engine ID
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(searchEngineId)}&q=${encodeURIComponent(query)}&num=10`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key 无效，请检查 Google Custom Search API 配置');
      }
      if (response.status === 429) {
        throw new Error('API 调用次数已达上限（免费额度：100 次/天），请稍后再试或升级套餐');
      }
      throw new Error(`Google Custom Search API 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // 提取搜索结果
    const results = ((data.items) || []).map((result: any) => ({
      title: result.title || '',
      snippet: result.snippet || '',
      url: result.link || '',
    }));

    return JSON.stringify({
      query,
      provider: 'Google Custom Search API',
      results,
      count: results.length,
    }, null, 2);
  } catch (error) {
    throw new Error(`Google Custom Search API 搜索失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Tavily Search API 搜索实现（专为 AI Agent 优化）
async function searchWithTavily(query: string, apiKey: string): Promise<string> {
  try {
    // 检查是否在开发环境，使用代理避免 CORS 问题
    const isDev = import.meta.env.DEV;
    const baseUrl = isDev
      ? '/api/tavily/search'
      : 'https://api.tavily.com/search';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic', // 'basic' = 1 credit, 'advanced' = 2 credits
        include_answer: true,  // 包含 AI 生成的答案摘要
        include_raw_content: false,
        max_results: 10,
      }),
    });

    if (!response.ok) {
      let errorMessage = '';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorData.error || '';
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || '';
      }

      if (response.status === 401) {
        throw new Error('API Key 无效，请检查 Tavily API 配置');
      }
      if (response.status === 429) {
        throw new Error('API 调用次数已达上限，请稍后再试或升级套餐');
      }
      throw new Error(`Tavily API 请求失败: ${response.status} ${response.statusText}${errorMessage ? ' - ' + errorMessage : ''}`);
    }

    const data = await response.json();

    // Tavily 返回的结构包含 answer（AI 摘要）和 results（搜索结果）
    const results = (data.results || []).map((result: any) => ({
      title: result.title || '',
      snippet: result.content || '',
      url: result.url || '',
      score: result.score || 0, // Tavily 提供相关性评分
    }));

    return JSON.stringify({
      query,
      provider: 'Tavily',
      // Tavily 特有的 AI 生成答案摘要
      answer: data.answer || null,
      results,
      count: results.length,
    }, null, 2);
  } catch (error) {
    throw new Error(`Tavily Search API 搜索失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 网络搜索工具 - 支持 SerpAPI、Brave Search API、Google Custom Search API 和 Tavily
async function executeWebSearch(args: { query?: string }): Promise<string> {
  const query = args.query;
  if (!query) {
    throw new Error('缺少必需参数: query');
  }

  // 获取搜索 API 配置
  const config = getSearchApiConfig();

  // 如果未配置或未启用，返回提示信息
  if (config.provider === 'none' || !config.enabled || !config.apiKey) {
    return JSON.stringify({
      message: '网络搜索功能需要配置搜索 API',
      query: query,
      suggestion: '请前往设置 -> 网络 -> 搜索 API 配置，配置 SerpAPI、Brave Search API 或 Google Custom Search API 以启用此功能',
      mockResults: [
        {
          title: `关于 "${query}" 的搜索结果`,
          snippet: '这是一个模拟的搜索结果。实际使用时需要配置搜索 API。',
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        },
      ],
    }, null, 2);
  }

  // Google Custom Search API 需要额外的 Search Engine ID
  if (config.provider === 'google' && !config.searchEngineId) {
    return JSON.stringify({
      error: 'Google Custom Search API 需要配置 Search Engine ID',
      query,
      suggestion: '请在设置中配置 Custom Search Engine ID',
    }, null, 2);
  }

  // 根据配置的提供商调用相应的 API
  try {
    if (config.provider === 'serpapi') {
      return await searchWithSerpAPI(query, config.apiKey);
    } else if (config.provider === 'brave') {
      return await searchWithBrave(query, config.apiKey);
    } else if (config.provider === 'google') {
      return await searchWithGoogle(query, config.apiKey, config.searchEngineId!);
    } else if (config.provider === 'tavily') {
      return await searchWithTavily(query, config.apiKey);
    } else {
      throw new Error(`不支持的搜索提供商: ${config.provider}`);
    }
  } catch (error) {
    // 返回错误信息，但格式化为 JSON
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      query,
      provider: config.provider,
      suggestion: '请检查 API Key 是否正确，或查看设置中的 API 配置',
    }, null, 2);
  }
}

// Glob 文件工具 - 列出匹配的文件（在 Electron 环境中实现）
async function executeGlobFiles(args: { pattern?: string; directory?: string }): Promise<string> {
  const pattern = args.pattern;
  if (!pattern) {
    throw new Error('缺少必需参数: pattern');
  }

  // 检查是否在 Electron 环境中
  if (typeof window !== 'undefined' && (window as any).electronAPI?.globFiles) {
    try {
      const files = await (window as any).electronAPI.globFiles(pattern, args.directory);
      return JSON.stringify({
        pattern,
        directory: args.directory || '当前目录',
        files: files,
        count: files.length,
      }, null, 2);
    } catch (error) {
      throw new Error(`Glob 匹配失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 浏览器环境中无法执行
  return JSON.stringify({
    error: '文件操作仅在桌面应用中可用',
    pattern,
    suggestion: '请在 Electron 桌面应用中使用此功能',
  }, null, 2);
}

// 读取文件工具
async function executeReadFile(args: { path?: string }): Promise<string> {
  const filePath = args.path;
  if (!filePath) {
    throw new Error('缺少必需参数: path');
  }

  // 检查是否在 Electron 环境中
  if (typeof window !== 'undefined' && (window as any).electronAPI?.readFile) {
    try {
      const content = await (window as any).electronAPI.readFile(filePath);
      return content;
    } catch (error) {
      throw new Error(`读取文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 浏览器环境中无法执行
  return JSON.stringify({
    error: '文件操作仅在桌面应用中可用',
    path: filePath,
    suggestion: '请在 Electron 桌面应用中使用此功能',
  }, null, 2);
}

// 获取当前时间工具
async function executeGetCurrentTime(_args: Record<string, unknown>): Promise<string> {
  const now = new Date();
  return JSON.stringify({
    timestamp: now.toISOString(),
    local: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }, null, 2);
}

// 计算器工具
async function executeCalculator(args: { expression?: string }): Promise<string> {
  const expression = args.expression;
  if (!expression) {
    throw new Error('缺少必需参数: expression');
  }

  try {
    // 安全的数学表达式求值（只允许数字和基本运算符）
    const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
    if (sanitized !== expression.replace(/\s/g, '')) {
      throw new Error('表达式包含不允许的字符');
    }

    // 使用 Function 进行计算（比 eval 更安全一点）
    const result = new Function(`return (${sanitized})`)();

    return JSON.stringify({
      expression,
      result: result,
    }, null, 2);
  } catch (error) {
    throw new Error(`计算失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ==================== macOS 工具 ====================

async function executeMacCalendarCreateEvent(args: {
  title?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
}): Promise<string> {
  const { title, startTime, endTime, location, notes } = args;
  if (!title || !startTime || !endTime) {
    throw new Error('缺少必需参数: title/startTime/endTime');
  }

  const script = `
set eventTitle to "${escapeAppleScriptString(title)}"
set startDate to date "${escapeAppleScriptString(startTime)}"
set endDate to date "${escapeAppleScriptString(endTime)}"
set eventLocation to "${escapeAppleScriptString(location || '')}"
set eventNotes to "${escapeAppleScriptString(notes || '')}"

tell application "Calendar"
  set targetCal to first calendar
  make new event at end of events of targetCal with properties {summary:eventTitle, start date:startDate, end date:endDate, location:eventLocation, description:eventNotes}
end tell

return "created"
`;

  return runAppleScript(script);
}

async function executeMacCalendarListToday(_args: Record<string, unknown>): Promise<string> {
  const script = `
set today to current date
set todayMidnight to today - (time of today)
set tomorrow to todayMidnight + 1 * days
set output to ""

tell application "Calendar"
  repeat with cal in calendars
    set todaysEvents to (every event of cal whose start date >= todayMidnight and start date < tomorrow)
    repeat with ev in todaysEvents
      set eventInfo to summary of ev & " | " & (start date of ev as string) & " - " & (end date of ev as string)
      try
        set loc to location of ev
        if loc is not missing value and loc is not "" then
          set eventInfo to eventInfo & " | " & loc
        end if
      end try
      set output to output & eventInfo & return
    end repeat
  end repeat
end tell

if output is "" then
  return "今天没有日历事件"
else
  return output
end if
`;
  return runAppleScript(script);
}

async function executeMacReminderAdd(args: { title?: string; dueTime?: string; listName?: string; notes?: string }): Promise<string> {
  const { title, dueTime, notes } = args;
  if (!title) {
    throw new Error('缺少必需参数: title');
  }

  // Build a simpler AppleScript that works reliably
  const escapedTitle = escapeAppleScriptString(title);
  const escapedNotes = escapeAppleScriptString(notes || '');

  let script: string;

  if (dueTime) {
    script = `
tell application "Reminders"
  set targetDate to current date
  set year of targetDate to ${new Date(dueTime).getFullYear()}
  set month of targetDate to ${new Date(dueTime).getMonth() + 1}
  set day of targetDate to ${new Date(dueTime).getDate()}
  set hours of targetDate to ${new Date(dueTime).getHours()}
  set minutes of targetDate to ${new Date(dueTime).getMinutes()}
  set seconds of targetDate to 0
  make new reminder with properties {name:"${escapedTitle}", body:"${escapedNotes}", remind me date:targetDate}
end tell
return "created"
`;
  } else {
    script = `
tell application "Reminders"
  make new reminder with properties {name:"${escapedTitle}", body:"${escapedNotes}"}
end tell
return "created"
`;
  }

  return runAppleScript(script);
}

async function executeMacReminderListToday(_args: Record<string, unknown>): Promise<string> {
  const script = `
set today to current date
set todayMidnight to today - (time of today)
set tomorrow to todayMidnight + 1 * days
set output to ""

tell application "Reminders"
  repeat with reminderList in lists
    repeat with r in (every reminder of reminderList whose completed is false)
      try
        set dueDate to remind me date of r
        if dueDate is not missing value and dueDate >= todayMidnight and dueDate < tomorrow then
          set reminderInfo to name of r & " | due: " & (dueDate as string)
          try
            set reminderBody to body of r
            if reminderBody is not missing value and reminderBody is not "" then
              set reminderInfo to reminderInfo & " | " & reminderBody
            end if
          end try
          set output to output & reminderInfo & return
        end if
      end try
    end repeat
  end repeat
end tell

if output is "" then
  return "今天没有提醒事项"
else
  return output
end if
`;
  return runAppleScript(script);
}

// 获取所有提醒列表名称
async function executeMacReminderLists(_args: Record<string, unknown>): Promise<string> {
  const script = `
tell application "Reminders"
  set listNames to name of every list
  set output to ""
  repeat with listName in listNames
    set output to output & listName & return
  end repeat
  return output
end tell
`;
  return runAppleScript(script);
}

// 获取指定列表中所有未完成的提醒
async function executeMacReminderListAll(args: { listName?: string }): Promise<string> {
  const { listName } = args;

  if (!listName) {
    // 如果没有指定列表名，返回所有列表中的所有未完成提醒
    const script = `
tell application "Reminders"
  set output to ""
  repeat with reminderList in lists
    set listTitle to name of reminderList
    set uncompletedReminders to (every reminder of reminderList whose completed is false)
    if (count of uncompletedReminders) > 0 then
      set output to output & "【" & listTitle & "】" & return
      repeat with r in uncompletedReminders
        set reminderInfo to "  - " & name of r
        try
          set dueDate to remind me date of r
          if dueDate is not missing value then
            set reminderInfo to reminderInfo & " | due: " & (dueDate as string)
          end if
        end try
        set output to output & reminderInfo & return
      end repeat
      set output to output & return
    end if
  end repeat
  if output is "" then
    return "没有未完成的提醒事项"
  else
    return output
  end if
end tell
`;
    return runAppleScript(script);
  }

  // 指定了列表名
  const escapedListName = escapeAppleScriptString(listName);
  const script = `
tell application "Reminders"
  try
    set targetList to list "${escapedListName}"
    set uncompletedReminders to (every reminder of targetList whose completed is false)
    set output to ""
    repeat with r in uncompletedReminders
      set reminderInfo to name of r
      try
        set dueDate to remind me date of r
        if dueDate is not missing value then
          set reminderInfo to reminderInfo & " | due: " & (dueDate as string)
        end if
      end try
      try
        set reminderBody to body of r
        if reminderBody is not missing value and reminderBody is not "" then
          set reminderInfo to reminderInfo & " | " & reminderBody
        end if
      end try
      set output to output & reminderInfo & return
    end repeat
    if output is "" then
      return "列表 \"${escapedListName}\" 中没有未完成的提醒"
    else
      return output
    end if
  on error errMsg
    return "错误: " & errMsg & ". 请先使用 mac_reminder_lists 获取有效的列表名称。"
  end try
end tell
`;
  return runAppleScript(script);
}

async function executeMacSetVolume(args: { level?: number }): Promise<string> {
  const { level } = args;
  if (level === undefined || level === null || Number.isNaN(Number(level))) {
    throw new Error('缺少必需参数: level');
  }
  const clamped = Math.max(0, Math.min(100, Number(level)));
  const script = `set volume output volume ${clamped}
return "volume:${clamped}"`;
  return runAppleScript(script);
}

async function executeMacOpenApp(args: { appName?: string }): Promise<string> {
  const { appName } = args;
  if (!appName) {
    throw new Error('缺少必需参数: appName');
  }
  const script = `tell application "${escapeAppleScriptString(appName)}" to activate
return "opened:${escapeAppleScriptString(appName)}"`;
  return runAppleScript(script);
}

async function executeMacRunShell(args: { command?: string }): Promise<string> {
  const { command } = args;
  if (!command) {
    throw new Error('缺少必需参数: command');
  }
  return runShellCommand(command);
}

async function executeMacRunAppleScript(args: { script?: string }): Promise<string> {
  const { script } = args;
  if (!script) {
    throw new Error('缺少必需参数: script');
  }
  return runAppleScript(script);
}

// ==================== 工具注册表 ====================

type ToolExecutor = (args: Record<string, unknown>) => Promise<string>;

const toolExecutors: Record<string, ToolExecutor> = {
  'web_fetch': executeWebFetch,
  'web_search': executeWebSearch,
  'glob_files': executeGlobFiles,
  'read_file': executeReadFile,
  'get_current_time': executeGetCurrentTime,
  'calculator': executeCalculator,
  'mac_calendar_create_event': executeMacCalendarCreateEvent,
  'mac_calendar_list_today': executeMacCalendarListToday,
  'mac_reminder_add': executeMacReminderAdd,
  'mac_reminder_list_today': executeMacReminderListToday,
  'mac_reminder_lists': executeMacReminderLists,
  'mac_reminder_list_all': executeMacReminderListAll,
  'mac_set_volume': executeMacSetVolume,
  'mac_open_app': executeMacOpenApp,
  'mac_run_shell': executeMacRunShell,
  'mac_run_applescript': executeMacRunAppleScript,
};

// ==================== 工具定义生成 ====================

// 生成工具定义（用于 API 请求）
export function generateToolDefinitions(selectedToolIds: string[]): {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}[] {
  const allTools = getTools();
  const selectedTools = allTools.filter(t => selectedToolIds.includes(t.id));

  return selectedTools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.id,
      description: tool.description,
      parameters: getToolParameters(tool.id),
    },
  }));
}

// 获取工具参数定义
function getToolParameters(toolId: string): Record<string, unknown> {
  const parameterDefinitions: Record<string, Record<string, unknown>> = {
    'web_fetch': {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要获取的 URL 地址',
        },
      },
      required: ['url'],
    },
    'web_search': {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
        },
      },
      required: ['query'],
    },
    'glob_files': {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob 匹配模式，如 "*.ts" 或 "src/**/*.tsx"',
        },
        directory: {
          type: 'string',
          description: '搜索的起始目录（可选）',
        },
      },
      required: ['pattern'],
    },
    'read_file': {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径',
        },
      },
      required: ['path'],
    },
    'get_current_time': {
      type: 'object',
      properties: {},
    },
    'calculator': {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: '数学表达式，如 "2 + 3 * 4"',
        },
      },
      required: ['expression'],
    },
    'mac_calendar_create_event': {
      type: 'object',
      properties: {
        title: { type: 'string', description: '事件标题' },
        startTime: { type: 'string', description: '开始时间，如 "December 10, 2025 09:00"' },
        endTime: { type: 'string', description: '结束时间，如 "December 10, 2025 10:00"' },
        location: { type: 'string', description: '地点（可选）' },
        notes: { type: 'string', description: '备注（可选）' },
      },
      required: ['title', 'startTime', 'endTime'],
    },
    'mac_calendar_list_today': {
      type: 'object',
      properties: {},
    },
    'mac_reminder_add': {
      type: 'object',
      properties: {
        title: { type: 'string', description: '提醒标题' },
        dueTime: { type: 'string', description: '提醒时间，如 "December 10, 2025 15:00"（可选）' },
        listName: { type: 'string', description: '列表名称（可选）' },
        notes: { type: 'string', description: '备注（可选）' },
      },
      required: ['title'],
    },
    'mac_reminder_list_today': {
      type: 'object',
      properties: {},
    },
    'mac_reminder_lists': {
      type: 'object',
      properties: {},
      description: '获取所有提醒事项列表的名称，用于了解用户有哪些列表',
    },
    'mac_reminder_list_all': {
      type: 'object',
      properties: {
        listName: { type: 'string', description: '要查询的列表名称（可选，不填则返回所有列表的未完成提醒）' },
      },
    },
    'mac_set_volume': {
      type: 'object',
      properties: {
        level: { type: 'number', description: '音量 0-100' },
      },
      required: ['level'],
    },
    'mac_open_app': {
      type: 'object',
      properties: {
        appName: { type: 'string', description: '要打开的应用名，如 "Safari"' },
      },
      required: ['appName'],
    },
    'mac_run_shell': {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的 shell 命令' },
      },
      required: ['command'],
    },
    'mac_run_applescript': {
      type: 'object',
      properties: {
        script: { type: 'string', description: '要执行的 AppleScript 脚本' },
      },
      required: ['script'],
    },
  };

  return parameterDefinitions[toolId] || { type: 'object', properties: {} };
}

// ==================== 工具执行 ====================

// 执行单个工具调用
export async function executeToolCall(
  toolCall: ToolCall,
  callbacks?: ToolExecutionCallbacks
): Promise<ToolResult> {
  const toolName = toolCall.function.name;

  callbacks?.onStart?.(toolCall);

  try {
    // 解析参数
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolCall.function.arguments || '{}');
    } catch {
      throw new Error('无法解析工具参数');
    }

    // 查找执行器
    const executor = toolExecutors[toolName];
    if (!executor) {
      throw new Error(`未知的工具: ${toolName}`);
    }

    // 构建上下文
    const context: ToolContext = {
      toolCall,
      args,
    };

    // 组合中间件链
    const executeChain = async (index: number): Promise<ToolResult> => {
      if (index < globalMiddlewares.length) {
        const middleware = globalMiddlewares[index];
        return middleware(context, () => executeChain(index + 1));
      } else {
        // 链的末端：执行实际工具
        const result = await executor(args);
        return {
          toolCallId: toolCall.id,
          toolName,
          result,
          success: true,
        };
      }
    };

    // 执行中间件链
    const toolResult = await executeChain(0);

    callbacks?.onComplete?.(toolResult);

    return toolResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const toolResult: ToolResult = {
      toolCallId: toolCall.id,
      toolName,
      result: '',
      success: false,
      error: errorMessage,
    };

    callbacks?.onError?.(toolCall.id, error instanceof Error ? error : new Error(errorMessage));

    return toolResult;
  }
}

// 批量执行工具调用
export async function executeToolCalls(
  toolCalls: ToolCall[],
  callbacks?: ToolExecutionCallbacks
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    const result = await executeToolCall(toolCall, callbacks);
    results.push(result);
  }

  return results;
}

// 获取工具显示名称
export function getToolDisplayName(toolId: string): string {
  const displayNames: Record<string, string> = {
    'web_fetch': '网络获取',
    'web_search': '网络搜索',
    'glob_files': 'Glob 文件',
    'read_file': '读取文件',
    'get_current_time': '获取时间',
    'calculator': '计算器',
    'mac_calendar_create_event': '创建日历事件',
    'mac_calendar_list_today': '查看今日日历',
    'mac_reminder_add': '添加提醒事项',
    'mac_reminder_list_today': '查看今日提醒',
    'mac_set_volume': '设置音量',
    'mac_open_app': '打开应用',
    'mac_run_shell': '运行 Shell',
    'mac_run_applescript': '运行 AppleScript',
  };

  return displayNames[toolId] || toolId;
}
