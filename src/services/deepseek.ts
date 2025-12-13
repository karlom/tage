// AI API 服务 - 支持 SSE 流式调用和工具调用

import {
  getProviderById,
  getProviders,
  saveProviders,
  type Message,
  type ModelConfig,
  type ModelCapabilities,
  type ReasoningLevel,
  type ToolSelectionMode,
  type Tool,
} from './storage';

import {
  type ToolCall,
  type ToolResult,
  executeToolCalls,
  generateToolDefinitions,
} from './tools';

// 重新导出工具相关类型
export type { ToolCall, ToolResult };

// 多模态内容类型
export type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
    >;

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: MessageContent;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// 工具定义（用于 API 调用）
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ChatCompletionOptions {
  model?: string;
  providerId?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  // 推理相关
  reasoningLevel?: ReasoningLevel;
  // 工具相关
  toolSelectionMode?: ToolSelectionMode;
  selectedTools?: Tool[];
  // 隐身模式（不保存记忆）
  incognitoMode?: boolean;
  // RAG 系统提示
  systemPrompt?: string;
}

// 工具调用状态
export interface ToolCallStatus {
  toolCall: ToolCall;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: ToolResult;
}

// 用量信息（从 API 响应获取）
export interface UsageData {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface StreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onFirstToken?: () => void;  // 首个 token 回调
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
  onUsage?: (usage: UsageData) => void;  // 用量信息回调
  // 工具调用相关回调
  onToolCallStart?: (toolCalls: ToolCall[]) => void;
  onToolCallProgress?: (toolCallId: string, status: 'running' | 'completed' | 'error', result?: ToolResult) => void;
  onToolCallComplete?: (results: ToolResult[]) => void;
}

// 格式化文档内容（用于注入到消息中）
function formatDocumentContent(attachment: FileAttachment): string {
  if (attachment.textContent) {
    // 有提取内容，构建上下文
    const maxLength = 8000;  // 限制长度
    const truncated = attachment.textContent.slice(0, maxLength);
    const isTruncated = attachment.textContent.length > maxLength;
    return `[文档: ${attachment.name}]\n${truncated}${isTruncated ? '\n...(内容已截断)' : ''}`;
  }
  return `[附件: ${attachment.name}] (无法读取内容)`;
}

// 将 Message 数组转换为 API 需要的格式
function convertMessages(messages: Message[]): ChatCompletionMessage[] {
  return messages.map((msg) => {
    // 构建消息内容
    let content: MessageContent = msg.content;

    // 如果是用户消息且有图片附件，转换为多模态格式
    if (msg.role === 'user' && msg.attachments && msg.attachments.length > 0) {
      const imageAttachments = msg.attachments.filter((a) => a.type === 'image');
      const documentAttachments = msg.attachments.filter((a) => a.type !== 'image');

      if (imageAttachments.length > 0) {
        // 构建多模态内容数组
        const contentParts: Array<
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
        > = [];

        // 添加文本内容
        let textContent = msg.content;

        // 如果有文档附件，将其提取的文本内容追加到消息中
        if (documentAttachments.length > 0) {
          const docContents = documentAttachments
            .map((a) => formatDocumentContent(a as FileAttachment))
            .join('\n\n');
          textContent = `${textContent}\n\n${docContents}`;
        }

        contentParts.push({ type: 'text', text: textContent });

        // 添加图片
        for (const img of imageAttachments) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: img.dataUrl,
              detail: 'auto',
            },
          });
        }

        content = contentParts;
      } else if (documentAttachments.length > 0) {
        // 只有文档附件，将文档的提取文本内容追加到消息中
        const docContents = documentAttachments
          .map((a) => formatDocumentContent(a as FileAttachment))
          .join('\n\n');
        content = `${msg.content}\n\n${docContents}`;
      }
    }

    const base: ChatCompletionMessage = {
      role: msg.role,
      content,
    };

    // 如果是助手消息且有工具调用，添加 tool_calls
    if (msg.role === 'assistant' && (msg as any).tool_calls) {
      base.tool_calls = (msg as any).tool_calls;
    }

    // 如果是工具结果消息，添加 tool_call_id
    if ((msg as any).tool_call_id) {
      (base as any).role = 'tool';
      base.tool_call_id = (msg as any).tool_call_id;
    }

    return base;
  });
}

// 检测是否在开发环境中运行
const isDev = import.meta.env.DEV;

// 获取 API 端点
function getApiEndpoint(baseUrl: string, providerId: string): string {
  // 移除末尾的斜杠
  let url = baseUrl.replace(/\/+$/, '');
  
  // 如果已经包含 /chat/completions 或 /messages，直接返回原始 URL
  if (url.endsWith('/chat/completions') || url.endsWith('/messages')) {
    return url;
  }
  
  // 自定义提供商 - 直接使用配置的 URL
  if (providerId.startsWith('custom-')) {
    // 如果以 /v1 结尾，添加 /chat/completions
    if (url.endsWith('/v1')) {
      return `${url}/chat/completions`;
    }
    // 否则直接添加 /chat/completions
    return `${url}/chat/completions`;
  }
  
  // 在开发环境中对内置提供商使用代理以避免 CORS 问题
  if (isDev) {
    const proxyMap: Record<string, string> = {
      'deepseek': '/api/deepseek/chat/completions',
      'openai': '/api/openai/v1/chat/completions',
      'anthropic': '/api/anthropic/v1/messages',
      'openrouter': '/api/openrouter/api/v1/chat/completions',
    };
    
    if (proxyMap[providerId]) {
      return proxyMap[providerId];
    }
  }
  
  // DeepSeek API 不需要 /v1 前缀
  if (providerId === 'deepseek' || url.includes('deepseek.com')) {
    url = url.replace(/\/v1$/, '');
    return `${url}/chat/completions`;
  }
  
  // Anthropic 使用 /messages 端点
  if (providerId === 'anthropic' || url.includes('anthropic.com')) {
    if (url.endsWith('/v1')) {
      return `${url}/messages`;
    }
    return `${url}/v1/messages`;
  }
  
  // OpenAI 兼容的 API
  if (url.endsWith('/v1')) {
    return `${url}/chat/completions`;
  }
  
  // 默认添加 /chat/completions
  return `${url}/chat/completions`;
}

// 流式调用 API（支持工具调用）
export async function streamChatCompletion(
  messages: Message[],
  callbacks: StreamCallbacks,
  options: ChatCompletionOptions = {}
): Promise<void> {
  const providerId = options.providerId || 'deepseek';
  const provider = getProviderById(providerId);
  
  console.log('Stream request - providerId:', providerId, 'provider:', provider?.name, 'baseUrl:', provider?.baseUrl);
  
  if (!provider) {
    callbacks.onError?.(new Error(`未找到提供商: ${providerId}`));
    return;
  }
  
  if (!provider.apiKey) {
    callbacks.onError?.(new Error(`请先在设置中配置 ${provider.name} 的 API Key`));
    return;
  }
  
  // 确保 baseUrl 存在
  const baseUrl = provider.baseUrl && provider.baseUrl.trim() !== '' 
    ? provider.baseUrl 
    : 'https://api.deepseek.com';
    
  const apiEndpoint = getApiEndpoint(baseUrl, providerId);
  const firstEnabledModel = provider.models.find((m) => m.enabled)?.id;
  const model = options.model || firstEnabledModel || 'deepseek-chat';
  
  // 生成工具定义
  let toolDefinitions: ToolDefinition[] = [];
  if (options.toolSelectionMode && options.toolSelectionMode !== 'none' && options.selectedTools && options.selectedTools.length > 0) {
    toolDefinitions = generateToolDefinitions(options.selectedTools.map(t => t.id));
  }
  
  // 执行流式请求（可能需要多轮工具调用）
  await executeStreamWithToolCalls(
    messages,
    callbacks,
    {
      apiEndpoint,
      apiKey: provider.apiKey,
      model,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096,
      toolDefinitions,
      reasoningLevel: options.reasoningLevel,
      providerId,
      providerName: provider.name,
      systemPrompt: options.systemPrompt,
    }
  );
}

// 内部函数：执行流式请求并处理工具调用
async function executeStreamWithToolCalls(
  messages: Message[],
  callbacks: StreamCallbacks,
  config: {
    apiEndpoint: string;
    apiKey: string;
    model: string;
    temperature: number;
    max_tokens: number;
    toolDefinitions: ToolDefinition[];
    reasoningLevel?: ReasoningLevel;
    providerId: string;
    providerName: string;
    systemPrompt?: string;
  },
  depth: number = 0
): Promise<void> {
  // 防止无限递归
  const MAX_TOOL_CALL_DEPTH = 5;
  if (depth >= MAX_TOOL_CALL_DEPTH) {
    callbacks.onError?.(new Error('工具调用次数超过限制'));
    return;
  }

  // 构建消息列表
  const apiMessages: ChatCompletionMessage[] = [];

  // 如果有系统提示，添加到最前面
  if (config.systemPrompt) {
    apiMessages.push({ role: 'system', content: config.systemPrompt });
  }

  // 添加用户/助手消息
  apiMessages.push(...convertMessages(messages));

  // 构建请求体
  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages: apiMessages,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    stream: true,
    stream_options: { include_usage: true },  // 请求包含用量信息
  };

  // 添加推理相关参数
  if (config.reasoningLevel && config.reasoningLevel !== 'off') {
    if (config.model.includes('reasoner') || config.model.includes('r1')) {
      requestBody.reasoning_effort = config.reasoningLevel;
    } else if (config.model.includes('o1')) {
      const maxTokensMap = { 'low': 2048, 'medium': 4096, 'high': 8192 };
      requestBody.max_completion_tokens = maxTokensMap[config.reasoningLevel] || 4096;
    }
  }

  // 添加工具定义
  if (config.toolDefinitions.length > 0) {
    requestBody.tools = config.toolDefinitions;
    requestBody.tool_choice = 'auto';
  }

  console.log('API Request:', {
    providerId: config.providerId,
    providerName: config.providerName,
    endpoint: config.apiEndpoint,
    model: config.model,
    messageCount: messages.length,
    toolsCount: config.toolDefinitions.length,
    depth,
  });

  try {
    if (depth === 0) {
      callbacks.onStart?.();
    }
    
    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      let errorMessage = `API 请求失败: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    
    // 累积工具调用
    const toolCallsMap: Map<number, ToolCall> = new Map();
    let hasToolCalls = false;
    
    // 首个 token 追踪
    let firstTokenReceived = false;
    
    // 用量信息
    let usageData: UsageData | null = null;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (!trimmedLine || trimmedLine === 'data: [DONE]') {
          continue;
        }

        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6);
            const data = JSON.parse(jsonStr);
            
            const choice = data.choices?.[0];
            const delta = choice?.delta;
            
            // 处理文本内容
            if (delta?.content) {
              // 追踪首个 token
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                callbacks.onFirstToken?.();
              }
              fullContent += delta.content;
              callbacks.onToken?.(delta.content);
            }
            
            // 处理工具调用
            if (delta?.tool_calls) {
              hasToolCalls = true;
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index ?? 0;
                
                if (!toolCallsMap.has(index)) {
                  toolCallsMap.set(index, {
                    id: toolCallDelta.id || `call_${index}`,
                    type: 'function',
                    function: {
                      name: '',
                      arguments: '',
                    },
                  });
                }
                
                const toolCall = toolCallsMap.get(index)!;
                
                if (toolCallDelta.id) {
                  toolCall.id = toolCallDelta.id;
                }
                if (toolCallDelta.function?.name) {
                  toolCall.function.name += toolCallDelta.function.name;
                }
                if (toolCallDelta.function?.arguments) {
                  toolCall.function.arguments += toolCallDelta.function.arguments;
                }
              }
            }
            
            // 捕获用量信息（通常在最后一个 chunk 中）
            if (data.usage) {
              usageData = {
                prompt_tokens: data.usage.prompt_tokens || 0,
                completion_tokens: data.usage.completion_tokens || 0,
                total_tokens: data.usage.total_tokens || 0,
              };
            }
          } catch (e) {
            console.warn('Failed to parse SSE data:', trimmedLine);
          }
        }
      }
    }
    
    // 调用用量回调
    if (usageData) {
      callbacks.onUsage?.(usageData);
    }

    // 如果有工具调用，执行工具并继续对话
    if (hasToolCalls && toolCallsMap.size > 0) {
      const toolCalls = Array.from(toolCallsMap.values());
      console.log('Tool calls detected:', toolCalls);
      
      // 通知工具调用开始
      callbacks.onToolCallStart?.(toolCalls);
      
      // 执行工具调用
      const toolResults = await executeToolCalls(toolCalls, {
        onStart: (tc) => {
          callbacks.onToolCallProgress?.(tc.id, 'running');
        },
        onComplete: (result) => {
          callbacks.onToolCallProgress?.(result.toolCallId, 'completed', result);
        },
        onError: (tcId, err) => {
          callbacks.onToolCallProgress?.(tcId, 'error', {
            toolCallId: tcId,
            toolName: '',
            result: '',
            success: false,
            error: err.message,
          });
        },
      });
      
      // 通知工具调用完成
      callbacks.onToolCallComplete?.(toolResults);
      
      // 构建新的消息列表，包含助手的工具调用和工具结果
      const assistantMessage: any = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent || '',
        timestamp: Date.now(),
        tool_calls: toolCalls,
      };
      
      const toolResultMessages: any[] = toolResults.map((result) => ({
        id: crypto.randomUUID(),
        role: 'tool',
        content: result.success ? result.result : `错误: ${result.error}`,
        timestamp: Date.now(),
        tool_call_id: result.toolCallId,
      }));
      
      const newMessages = [...messages, assistantMessage, ...toolResultMessages];
      
      // 递归调用，继续对话
      await executeStreamWithToolCalls(newMessages, callbacks, config, depth + 1);
    } else {
      // 没有工具调用，正常完成
      callbacks.onComplete?.(fullContent);
    }
  } catch (error) {
    console.error('Stream error:', error);
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

// 非流式调用（备用）
export async function chatCompletion(
  messages: Message[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  const providerId = options.providerId || 'deepseek';
  const provider = getProviderById(providerId);
  
  if (!provider) {
    throw new Error(`未找到提供商: ${providerId}`);
  }
  
  if (!provider.apiKey) {
    throw new Error(`请先在设置中配置 ${provider.name} 的 API Key`);
  }

  // 确保 baseUrl 存在
  const baseUrl = provider.baseUrl && provider.baseUrl.trim() !== '' 
    ? provider.baseUrl 
    : 'https://api.deepseek.com';
    
  const apiEndpoint = getApiEndpoint(baseUrl, providerId);
  // 获取第一个启用的模型，或使用默认模型
  const firstEnabledModel = provider.models.find((m) => m.enabled)?.id;
  const model = options.model || firstEnabledModel || 'deepseek-chat';
  
  const requestBody = {
    model,
    messages: convertMessages(messages),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 4096,
    stream: false,
  };

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ==================== 模型列表查询 ====================

// API 返回的模型信息接口
interface ApiModelInfo {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  // OpenAI/OpenRouter 特有字段
  capabilities?: {
    vision?: boolean;
    function_calling?: boolean;
  };
  // OpenRouter 特有字段
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  // 其他可能的字段
  [key: string]: unknown;
}

// 获取 models 端点
function getModelsEndpoint(baseUrl: string, providerId: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  
  // 在开发环境中使用代理
  if (isDev) {
    const proxyMap: Record<string, string> = {
      'deepseek': '/api/deepseek/models',
      'openai': '/api/openai/v1/models',
      'openrouter': '/api/openrouter/api/v1/models',
    };
    
    if (proxyMap[providerId]) {
      return proxyMap[providerId];
    }
  }
  
  // DeepSeek
  if (providerId === 'deepseek' || url.includes('deepseek.com')) {
    url = url.replace(/\/v1$/, '');
    return `${url}/models`;
  }
  
  // OpenAI 兼容的 API
  if (url.endsWith('/v1')) {
    return `${url}/models`;
  }
  
  return `${url}/models`;
}

// 根据模型 ID 推断能力
function inferModelCapabilities(modelId: string, apiCapabilities?: ApiModelInfo['capabilities']): ModelCapabilities {
  const id = modelId.toLowerCase();
  const capabilities: ModelCapabilities = {};
  
  // 从 API 返回的能力信息
  if (apiCapabilities) {
    if (apiCapabilities.vision) {
      capabilities.vision = true;
    }
    if (apiCapabilities.function_calling) {
      capabilities.functionCalling = true;
    }
  }
  
  // 推理能力检测
  if (id.includes('reasoner') || id.includes('o1') || id.includes('thinking') || 
      id.includes('2.5-pro') || id.includes('2.5pro') || id.includes('r1')) {
    capabilities.reasoning = true;
  }
  
  // 视觉能力检测
  if (!capabilities.vision && (
    id.includes('vision') || id.includes('4o') || id.includes('gpt-4-turbo') ||
    id.includes('claude-3') || id.includes('gemini') || id.includes('llava') ||
    id.includes('qwen-vl') || id.includes('yi-vision')
  )) {
    capabilities.vision = true;
  }
  
  // 工具调用能力检测
  if (!capabilities.functionCalling) {
    // 推理模型通常不支持工具调用
    const isReasoningModel = id.includes('reasoner') || id.includes('o1-') || 
                             id.includes('o1') || id.includes('r1');
    if (!isReasoningModel) {
      capabilities.functionCalling = true;
    }
  }
  
  return capabilities;
}

// 从提供商 API 获取模型列表
export async function fetchModelsFromProvider(
  providerId: string
): Promise<{ success: boolean; models?: ModelConfig[]; error?: string }> {
  const provider = getProviderById(providerId);
  
  if (!provider) {
    return { success: false, error: `未找到提供商: ${providerId}` };
  }
  
  if (!provider.apiKey) {
    return { success: false, error: `请先配置 ${provider.name} 的 API Key` };
  }
  
  // Anthropic 不支持 /models 端点，使用预定义列表
  if (providerId === 'anthropic') {
    return { 
      success: true, 
      models: [
        { id: 'claude-3-opus-20240229', enabled: true, capabilities: { functionCalling: true, vision: true } },
        { id: 'claude-3-sonnet-20240229', enabled: true, capabilities: { functionCalling: true, vision: true } },
        { id: 'claude-3-haiku-20240307', enabled: true, capabilities: { functionCalling: true, vision: true } },
        { id: 'claude-3-5-sonnet-20241022', enabled: true, capabilities: { functionCalling: true, vision: true } },
      ]
    };
  }
  
  // Google Gemini 也使用预定义列表
  if (providerId === 'google') {
    return {
      success: true,
      models: [
        { id: 'gemini-pro', enabled: true, capabilities: { functionCalling: true } },
        { id: 'gemini-pro-vision', enabled: true, capabilities: { functionCalling: true, vision: true } },
        { id: 'gemini-2.5-pro', enabled: true, capabilities: { functionCalling: true, reasoning: true, vision: true } },
      ]
    };
  }
  
  const baseUrl = provider.baseUrl && provider.baseUrl.trim() !== '' 
    ? provider.baseUrl 
    : 'https://api.deepseek.com';
    
  const modelsEndpoint = getModelsEndpoint(baseUrl, providerId);
  
  try {
    const response = await fetch(modelsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Models API Error:', errorText);
      return { 
        success: false, 
        error: `获取模型列表失败: ${response.status}` 
      };
    }
    
    const data = await response.json();
    const apiModels: ApiModelInfo[] = data.data || data.models || [];
    
    // 过滤并转换模型列表
    const models: ModelConfig[] = apiModels
      .filter((m) => {
        // 过滤掉嵌入模型和其他非聊天模型
        const id = m.id.toLowerCase();
        return !id.includes('embedding') && 
               !id.includes('whisper') && 
               !id.includes('tts') &&
               !id.includes('dall-e') &&
               !id.includes('moderation');
      })
      .map((m) => ({
        id: m.id,
        enabled: true,
        capabilities: inferModelCapabilities(m.id, m.capabilities),
      }));
    
    console.log(`Fetched ${models.length} models from ${provider.name}`);
    
    return { success: true, models };
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '获取模型列表失败' 
    };
  }
}

// 更新提供商的模型列表
export async function updateProviderModels(
  providerId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await fetchModelsFromProvider(providerId);
  
  if (!result.success || !result.models) {
    return { success: false, error: result.error };
  }
  
  // 获取当前提供商列表
  const providers = getProviders();
  const index = providers.findIndex((p) => p.id === providerId);
  
  if (index === -1) {
    return { success: false, error: '提供商不存在' };
  }
  
  // 合并新旧模型列表，保留用户的启用状态
  const existingModels = providers[index].models;
  const existingModelMap = new Map(existingModels.map((m) => [m.id, m]));
  
  const mergedModels = result.models.map((newModel) => {
    const existing = existingModelMap.get(newModel.id);
    if (existing) {
      // 保留用户的启用状态，更新能力信息
      return {
        ...newModel,
        enabled: existing.enabled,
      };
    }
    return newModel;
  });
  
  // 更新提供商
  providers[index] = {
    ...providers[index],
    models: mergedModels,
  };
  
  saveProviders(providers);
  
  return { success: true };
}
