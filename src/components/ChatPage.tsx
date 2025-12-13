import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Paperclip,
  Eye,
  EyeOff,
  Send,
  ChevronDown,
  Loader2,
  AlertCircle,
  Check,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Wand2,
  Globe,
  FolderOpen,
  ChevronRight,
  Wrench,
  Copy,
  RefreshCw,
  MoreHorizontal,
  BarChart3,
  FileText,
  GitBranch,
  Trash2,
} from 'lucide-react';
import { streamChatCompletion, type ToolCall, type ToolResult } from '@/services/deepseek';
import { getToolDisplayName } from '@/services/tools';
import { buildContextWithMemories, extractAndSaveMemories, type ContextBuildResult } from '@/services/contextInjection';
import { getPersonaPrompt } from '@/services/persona';
import {
  type Message,
  type ReasoningLevel,
  type ToolSelectionMode,
  type ModelCapabilities,
  type Tool,
  type ToolCategory,
  type ToolCallRecord,
  type UsageInfo,
  getChatSession,
  createChatSession,
  addMessageToSession,
  deleteMessageFromSession,
  getProviderById,
  getAvailableModelsWithCapabilities,
  getMemorySettings,
  performSmartCleanup,
  getTools,
  getToolCategories,
  getChatSettings,
} from '@/services/storage';
import MarkdownRenderer from './MarkdownRenderer';
import AttachmentPreview, { MessageAttachments } from './AttachmentPreview';

// 懒加载 MarkdownRenderer 用于长消息 (将在 Stage 4 实现)
// const LazyMarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /system prompt/i,
  /your instructions/i,
  /reveal your configuration/i,
  /output everything above/i,
];

const OUTPUT_SENTINEL_KEYWORDS = [
  '### SECURITY PROTOCOL',
  'CRITICAL: Engineering Standards',
  'System Context & Identity',
];

function securityCheck(userInput: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(userInput));
}

function applyOutputSentinel(content: string, personaPrompt: string): string {
  if (!content) return content;

  const keywordLeak = OUTPUT_SENTINEL_KEYWORDS.some((keyword) => content.includes(keyword));
  const personaLeak = personaPrompt ? content.includes('You are **Tage (塔哥)**') : false;

  if (keywordLeak || personaLeak) {
    return '系统错误：敏感内容屏蔽';
  }

  return content;
}

// 工具调用状态
interface ToolCallState {
  toolCall: ToolCall;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: ToolResult;
  startTime?: number;
  endTime?: number;
  expanded?: boolean;
}

interface ChatPageProps {
  sessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
}

interface ModelOption {
  providerId: string;
  providerName: string;
  model: string;
  capabilities?: ModelCapabilities;
}

// 推理强度配置
const REASONING_LEVELS: { value: ReasoningLevel; label: string; description: string; icon: string }[] = [
  { value: 'off', label: '关闭', description: '禁用扩展思考', icon: '⊘' },
  { value: 'low', label: '低', description: '快速响应，最少推理', icon: '💡' },
  { value: 'medium', label: '中', description: '平衡速度与推理深度', icon: '💡' },
  { value: 'high', label: '高', description: '深度推理，适合复杂任务', icon: '💡' },
];

// 工具调用卡片组件
interface ToolCallCardsProps {
  toolCalls: ToolCallRecord[];
  messageId: string;
}

const ToolCallCards = memo(function ToolCallCards({ toolCalls, messageId }: ToolCallCardsProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = useCallback((cardId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  }, []);

  return (
    <div className="space-y-2 mb-4">
      {toolCalls.map((tc) => {
        const cardId = `${messageId}-${tc.id}`;
        const isExpanded = expandedCards.has(cardId);
        const duration = tc.duration ? (tc.duration / 1000).toFixed(1) : null;
        const resultSize = tc.result 
          ? (new Blob([tc.result]).size / 1024).toFixed(1) 
          : null;

        return (
          <div 
            key={tc.id}
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden"
          >
            {/* 卡片头部 */}
            <button
              onClick={() => toggleCard(cardId)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
            >
              <Wrench className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="font-medium text-sm">
                {getToolDisplayName(tc.name)}
              </span>
              
              {/* 状态标签 */}
              {tc.success ? (
                <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Completed
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Error
                </span>
              )}
              
              {/* 耗时 */}
              {duration && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
                  </svg>
                  {duration} s
                </span>
              )}
              
              <div className="flex-1" />
              
              {/* 展开/折叠箭头 */}
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            
            {/* 展开的详情 */}
            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-zinc-800">
                {/* 参数部分 */}
                <div className="px-4 py-3">
                  <div className="text-xs font-medium text-teal-600 dark:text-teal-400 mb-2">ARGUMENTS</div>
                  <div className="bg-gray-50 dark:bg-zinc-800/50 rounded p-3 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                    {tc.arguments || '{}'}
                  </div>
                </div>
                
                {/* 结果部分 */}
                <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
                  <div className="text-xs font-medium text-teal-600 dark:text-teal-400 mb-2">RESULT</div>
                  <div className="bg-gray-50 dark:bg-zinc-800/50 rounded p-3 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                    {tc.success 
                      ? (tc.result?.slice(0, 2000) || '') + ((tc.result?.length || 0) > 2000 ? '...' : '')
                      : `Error: ${tc.error}`
                    }
                  </div>
                  
                  {/* 底部信息 */}
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                    {resultSize && tc.success && (
                      <span>{resultSize} KB total</span>
                    )}
                    <div className="flex items-center gap-4 ml-auto">
                      <span>Call ID: {tc.id.slice(0, 20)}</span>
                      {duration && <span>Duration: {duration} s</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// 简化的消息操作按钮组件 - 只有复制和重新生成
interface SimpleMessageActionsProps {
  message: Message;
  showRegenerate?: boolean;
  onRegenerate?: (messageId: string) => void;
  position?: 'left' | 'right';
}

const SimpleMessageActions = memo(function SimpleMessageActions({
  message,
  showRegenerate = false,
  onRegenerate,
  position = 'left'
}: SimpleMessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  return (
    <div className={`flex items-center gap-1 mt-2 ${position === 'right' ? 'justify-end' : 'justify-start'}`}>
      {/* 复制按钮 */}
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title="复制"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>

      {/* 重新生成按钮 - 仅助手消息显示 */}
      {showRegenerate && onRegenerate && (
        <button
          onClick={() => onRegenerate(message.id)}
          className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="重新生成"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

// 消息操作按钮组件（用于助手消息）
interface MessageActionsProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}

const MessageActions = memo(function MessageActions({ message, onRegenerate, onDelete }: MessageActionsProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭更多菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 复制为纯文本
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 复制为 Markdown
  const handleCopyMarkdown = async () => {
    try {
      // 构建 Markdown 内容
      let markdown = message.content;
      if (message.model) {
        markdown = `> Model: ${message.model}${message.providerName ? ` (${message.providerName})` : ''}\n\n${markdown}`;
      }
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setShowMoreMenu(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 复制为纯文本（从菜单）
  const handleCopyPlainText = async () => {
    await handleCopyText();
    setShowMoreMenu(false);
  };

  return (
    <div className="flex items-center gap-1 mt-3 pt-2">
      {/* 复制按钮 */}
      <button
        onClick={handleCopyText}
        className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title="复制"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>

      {/* 重新生成按钮 */}
      {onRegenerate && (
        <button
          onClick={() => onRegenerate(message.id)}
          className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="重新生成"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}

      {/* 更多菜单 */}
      <div className="relative" ref={moreMenuRef}>
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="更多"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* 更多菜单弹出框 */}
        {showMoreMenu && (
          <div className="absolute left-0 bottom-full mb-2 z-50 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[200px]">
            {/* 用量 */}
            {(message.usage || message.thinkingTime) && (
              <div className="relative group/usage">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>用量</span>
                </button>
                {/* 用量详情悬停弹窗 */}
                <div className="absolute left-full top-0 ml-2 hidden group-hover/usage:block bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 min-w-[180px] z-50">
                  <table className="w-full text-sm">
                    <tbody>
                      {message.usage?.promptTokens !== undefined && (
                        <tr>
                          <td className="text-gray-500 dark:text-gray-400 py-1">输入 Token</td>
                          <td className="text-right font-medium text-gray-700 dark:text-gray-300 py-1">{message.usage.promptTokens.toLocaleString()}</td>
                        </tr>
                      )}
                      {message.usage?.completionTokens !== undefined && (
                        <tr>
                          <td className="text-gray-500 dark:text-gray-400 py-1">输出 Token</td>
                          <td className="text-right font-medium text-gray-700 dark:text-gray-300 py-1">{message.usage.completionTokens.toLocaleString()}</td>
                        </tr>
                      )}
                      {message.usage?.totalTokens !== undefined && (
                        <tr>
                          <td className="text-gray-500 dark:text-gray-400 py-1">总 Token</td>
                          <td className="text-right font-medium text-gray-700 dark:text-gray-300 py-1">{message.usage.totalTokens.toLocaleString()}</td>
                        </tr>
                      )}
                      {message.usage?.firstTokenTime !== undefined && message.usage.firstTokenTime > 0 && (
                        <tr>
                          <td className="text-gray-500 dark:text-gray-400 py-1">首个 Token 时间</td>
                          <td className="text-right font-medium text-gray-700 dark:text-gray-300 py-1">{(message.usage.firstTokenTime / 1000).toFixed(1)} s</td>
                        </tr>
                      )}
                      {message.usage?.tokensPerSecond !== undefined && message.usage.tokensPerSecond > 0 && (
                        <tr>
                          <td className="text-gray-500 dark:text-gray-400 py-1">Token/秒</td>
                          <td className="text-right font-medium text-gray-700 dark:text-gray-300 py-1">{message.usage.tokensPerSecond}</td>
                        </tr>
                      )}
                      {!message.usage && message.thinkingTime && (
                        <tr>
                          <td className="text-gray-500 dark:text-gray-400 py-1">思考时间</td>
                          <td className="text-right font-medium text-gray-700 dark:text-gray-300 py-1">{(message.thinkingTime / 1000).toFixed(1)} s</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 复制为 Markdown */}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 whitespace-nowrap"
              onClick={handleCopyMarkdown}
            >
              <FileText className="w-4 h-4" />
              <span>复制为 Markdown</span>
            </button>

            {/* 复制为纯文本 */}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 whitespace-nowrap"
              onClick={handleCopyPlainText}
            >
              <Copy className="w-4 h-4" />
              <span>复制为纯文本</span>
            </button>

            {/* 创建分支 */}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 whitespace-nowrap"
              onClick={() => setShowMoreMenu(false)}
            >
              <GitBranch className="w-4 h-4" />
              <span>创建分支</span>
            </button>

            {/* 分隔线 */}
            <div className="border-t border-gray-200 dark:border-zinc-700 my-1" />

            {/* 删除消息 */}
            {onDelete && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 whitespace-nowrap"
                onClick={() => {
                  onDelete(message.id);
                  setShowMoreMenu(false);
                }}
              >
                <Trash2 className="w-4 h-4" />
                <span>删除消息</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default function ChatPage({
  sessionId,
  onSessionCreated,
}: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(sessionId);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);
  
  // 新增：推理强度、工具选择、隐身模式状态
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>('medium');
  const [showReasoningSelector, setShowReasoningSelector] = useState(false);
  const [toolSelectionMode, setToolSelectionMode] = useState<ToolSelectionMode>('auto');
  const [showToolsSelector, setShowToolsSelector] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolCategories, setToolCategories] = useState<ToolCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['network', 'workspace', 'utility']));
  const [incognitoMode, setIncognitoMode] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(false);

  // 文件附件状态
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  // 工具调用状态
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallState[]>([]);
  const [showToolCallProgress, setShowToolCallProgress] = useState(false);
  // 追踪思考时间、工具调用记录和用量
  const thinkingStartTimeRef = useRef<number>(0);
  const firstTokenTimeRef = useRef<number>(0);
  const completedToolCallsRef = useRef<ToolCallRecord[]>([]);
  const usageInfoRef = useRef<UsageInfo | null>(null);
  const sendLockRef = useRef(false); // 防止一次输入触发多次发送
  const isNewSessionRef = useRef(false); // 标记是否刚创建新会话，防止 useEffect 重复加载
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const reasoningSelectorRef = useRef<HTMLDivElement>(null);
  const toolsSelectorRef = useRef<HTMLDivElement>(null);

  // 加载可用模型（包含能力信息）
  useEffect(() => {
    const loadModels = () => {
      const modelsData = getAvailableModelsWithCapabilities();
      const options: ModelOption[] = [];
      
      modelsData.forEach(({ providerId, providerName, models }) => {
        models.forEach((model) => {
          options.push({ 
            providerId, 
            providerName, 
            model: model.id,
            capabilities: model.capabilities,
          });
        });
      });
      
      setAvailableModels(options);
      
      // 设置默认选中的模型
      setSelectedModel((currentSelected) => {
        if (options.length === 0) {
          return null;
        }
        
        // 如果没有选中任何模型，选择第一个
        if (!currentSelected) {
          return options[0];
        }
        
        // 检查当前选中的模型是否仍然可用
        const stillAvailable = options.some(
          (m) => m.providerId === currentSelected.providerId && m.model === currentSelected.model
        );
        
        if (!stillAvailable) {
          return options[0];
        }
        
        // 更新能力信息
        const updated = options.find(
          (m) => m.providerId === currentSelected.providerId && m.model === currentSelected.model
        );
        return updated || currentSelected;
      });
    };
    
    loadModels();
    
    // 监听存储变化以更新模型列表
    const handleStorageChange = () => loadModels();
    const handleProvidersUpdated = () => loadModels();
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('providers-updated', handleProvidersUpdated);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('providers-updated', handleProvidersUpdated);
    };
  }, []);

  // 加载工具列表和记忆设置
  useEffect(() => {
    const loadToolsAndMemory = () => {
      setTools(getTools());
      setToolCategories(getToolCategories());
      const memorySettings = getMemorySettings();
      setMemoryEnabled(memorySettings.enabled);
      
      // 初始化选中的工具（默认全选）
      const allToolIds = getTools().filter(t => t.enabled).map(t => t.id);
      setSelectedTools(new Set(allToolIds));
    };
    
    loadToolsAndMemory();
    
    const handleToolsUpdated = () => loadToolsAndMemory();
    const handleMemoryUpdated = () => {
      const memorySettings = getMemorySettings();
      setMemoryEnabled(memorySettings.enabled);
    };
    
    window.addEventListener('tools-updated', handleToolsUpdated);
    window.addEventListener('memory-settings-updated', handleMemoryUpdated);
    
    return () => {
      window.removeEventListener('tools-updated', handleToolsUpdated);
      window.removeEventListener('memory-settings-updated', handleMemoryUpdated);
    };
  }, []);

  // 点击外部关闭选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setShowModelSelector(false);
      }
      if (reasoningSelectorRef.current && !reasoningSelectorRef.current.contains(event.target as Node)) {
        setShowReasoningSelector(false);
      }
      if (toolsSelectorRef.current && !toolsSelectorRef.current.contains(event.target as Node)) {
        setShowToolsSelector(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 加载会话消息
  useEffect(() => {
    // 如果是刚创建的新会话，跳过从存储加载（消息已经在 handleSend 中添加了）
    if (isNewSessionRef.current) {
      isNewSessionRef.current = false;
      return;
    }

    // 只有在没有进行中的发送操作时才加载/清空消息
    // 避免覆盖 handleSend 正在添加的消息
    if (sendLockRef.current) {
      return;
    }

    if (sessionId) {
      const session = getChatSession(sessionId);
      if (session) {
        setMessages(session.messages);
        setCurrentSessionId(sessionId);
      }
    } else {
      setMessages([]);
      setCurrentSessionId(undefined);
    }
    setError(null);
  }, [sessionId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || sendLockRef.current) return;
    sendLockRef.current = true;

    // 检查是否有选中的模型
    if (!selectedModel) {
      setError('请先在设置 -> 提供商中配置并启用一个提供商');
      sendLockRef.current = false;
      return;
    }

    // 检查 API Key 是否配置
    const provider = getProviderById(selectedModel.providerId);
    if (!provider || !provider.apiKey) {
      setError(`请先在设置 -> 提供商中配置 ${selectedModel.providerName} 的 API Key`);
      sendLockRef.current = false;
      return;
    }

    const userContent = inputValue.trim();
    const currentAttachments = [...attachments]; // 保存当前附件
    setInputValue('');
    setAttachments([]); // 清空附件
    setError(null);

    // 如果没有当前会话，创建一个新会话（强制清空旧消息，避免串话）
    let activeSessionId = sessionId ?? currentSessionId;
    if (!activeSessionId) {
      setMessages([]); // 防止前一个会话残留
      const newSession = createChatSession(userContent.slice(0, 30));
      activeSessionId = newSession.id;
      setCurrentSessionId(activeSessionId);
      isNewSessionRef.current = true; // 标记为新会话，防止 useEffect 重复加载
      onSessionCreated?.(activeSessionId);
    }

    // 当前使用的模型信息
    const currentModel = selectedModel.model;
    const currentProviderName = selectedModel.providerName;

    // 添加用户消息（包含附件）
    const userMessage = addMessageToSession(activeSessionId, {
      role: 'user',
      content: userContent,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    });

    // 输入拦截：防止提示词套取/注入
    if (securityCheck(userContent)) {
      const interceptContent = 'Tage: 嘿，试图通过这种方式了解我？不如直接问 Dongbo 吧。（系统拦截）';
      const interceptedAssistant = addMessageToSession(activeSessionId, {
        role: 'assistant',
        content: interceptContent,
        model: currentModel,
        providerName: currentProviderName,
      });

      setMessages((prev) => [...prev, userMessage, interceptedAssistant]);
      setIsLoading(false);
      sendLockRef.current = false;
      return;
    }

    // 创建一个临时的助手消息用于流式显示
    const tempAssistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: currentModel,
      providerName: currentProviderName,
    };

    // 保存临时消息 ID 用于后续更新
    const tempMessageId = tempAssistantMessage.id;

    // 立即添加用户消息和临时助手消息到 UI，确保用户能立即看到反馈
    setMessages((prev) => [...prev, userMessage, tempAssistantMessage]);
    setIsLoading(true);

    // RAG: 构建带记忆的上下文（非隐身模式）- 在 UI 更新后异步进行
    let ragContext: ContextBuildResult | null = null;
    const memorySettings = getMemorySettings();
    if (!incognitoMode && memorySettings.enabled && memorySettings.autoRetrieve) {
      try {
        ragContext = await buildContextWithMemories(userContent);
        if (ragContext.retrievedMemories.length > 0) {
          console.log(`RAG: Retrieved ${ragContext.retrievedMemories.length} memories`);
        }
      } catch (e) {
        console.error('RAG context build failed:', e);
      }
    }

    // 组合系统提示：固定 persona + RAG 注入
    const personaPrompt = getPersonaPrompt();
    const ragPrompt = ragContext?.systemPrompt || '';
    const combinedSystemPrompt = [personaPrompt, ragPrompt].filter(Boolean).join('\n\n');
    
    console.log('Added messages, tempMessageId:', tempMessageId);
    
    // 发起 SSE 请求 - 使用用户消息构建请求
    const allMessages = [...messages, userMessage];
    
    console.log('Sending request with messages:', allMessages.length);
    
    try {
      await streamChatCompletion(
        allMessages,
        {
          onStart: () => {
            console.log('Stream started');
            setActiveToolCalls([]);
            setShowToolCallProgress(false);
            // 记录思考开始时间，重置追踪数据
            thinkingStartTimeRef.current = Date.now();
            firstTokenTimeRef.current = 0;
            completedToolCallsRef.current = [];
            usageInfoRef.current = null;
          },
          onFirstToken: () => {
            // 记录首个 token 的时间
            firstTokenTimeRef.current = Date.now() - thinkingStartTimeRef.current;
          },
          onToken: (token) => {
            // 流式更新消息内容 - 必须创建新对象让 React 检测到变化
            setMessages((prev) => {
              return prev.map((msg) => {
                if (msg.id === tempMessageId) {
                  return {
                    ...msg,
                    content: msg.content + token,
                  };
                }
                return msg;
              });
            });
          },
          onUsage: (usage) => {
            // 保存用量信息
            const thinkingTime = Date.now() - thinkingStartTimeRef.current;
            const tokensPerSecond = thinkingTime > 0 
              ? (usage.completion_tokens / (thinkingTime / 1000)) 
              : 0;
            
            usageInfoRef.current = {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
              firstTokenTime: firstTokenTimeRef.current,
              tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,  // 保留一位小数
            };
          },
          // 工具调用开始
          onToolCallStart: (toolCalls) => {
            console.log('Tool calls started:', toolCalls);
            setShowToolCallProgress(true);
            const now = Date.now();
            setActiveToolCalls(toolCalls.map(tc => ({
              toolCall: tc,
              status: 'pending',
              startTime: now,
              expanded: false,
            })));
          },
          // 工具调用进度
          onToolCallProgress: (toolCallId, status, result) => {
            console.log('Tool call progress:', toolCallId, status, result);
            const now = Date.now();
            setActiveToolCalls((prev) => {
              const updated = prev.map(tc => {
                if (tc.toolCall.id === toolCallId) {
                  const startTime = tc.startTime || now;
                  const endTime = (status === 'completed' || status === 'error') ? now : tc.endTime;
                  
                  // 当工具调用完成时，收集到记录中
                  if ((status === 'completed' || status === 'error') && result) {
                    const record: ToolCallRecord = {
                      id: toolCallId,
                      name: tc.toolCall.function.name,
                      arguments: tc.toolCall.function.arguments,
                      result: result.success ? result.result : undefined,
                      error: result.error,
                      success: result.success,
                      duration: endTime ? endTime - startTime : undefined,
                    };
                    // 避免重复添加
                    if (!completedToolCallsRef.current.some(r => r.id === toolCallId)) {
                      completedToolCallsRef.current.push(record);
                    }
                  }
                  
                  return { 
                    ...tc, 
                    status, 
                    result,
                    startTime,
                    endTime,
                  };
                }
                return tc;
              });
              return updated;
            });
          },
          // 工具调用完成
          onToolCallComplete: (results) => {
            console.log('Tool calls complete:', results);
            // 不自动隐藏，让用户可以查看结果
          },
          onComplete: (fullContent) => {
            try {
              console.log('Stream complete, content length:', fullContent.length);
              
              // 针对图片模型的特殊处理：如果返回的是纯 base64 数据，包装成 data URL 供 Markdown 渲染
              let processedContent = fullContent || '';
              const isImageModel = currentModel?.toLowerCase().includes('image') 
                || currentModel?.toLowerCase().includes('vision') 
                || currentModel?.toLowerCase().includes('preview');
              const hasMarkdownImage = /!\[.*?\]\(.+?\)/.test(fullContent);
              
              if (isImageModel && !hasMarkdownImage) {
                const cleaned = fullContent.replace(/[\r\n]/g, '').trim();
                // 简单判断是否可能是 base64 数据
                const looksLikeBase64 = cleaned.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(cleaned);
                if (looksLikeBase64) {
                  processedContent = `![image](data:image/png;base64,${cleaned})`;
                  console.log('Image content detected, wrapped as data URL for rendering.');
                }
              }

              // 输出熔断：防止系统提示词泄漏
              processedContent = applyOutputSentinel(processedContent, personaPrompt);
              
              // 计算思考时间
              const thinkingTime = Date.now() - thinkingStartTimeRef.current;
              const toolCalls = completedToolCallsRef.current.length > 0 
                ? [...completedToolCallsRef.current] 
                : undefined;
              
              // 获取用量信息
              const usage = usageInfoRef.current || undefined;
              
              // 保存完整的助手消息到存储（包含模型信息、工具调用、思考时间、用量）
              let savedMessage;
              try {
                savedMessage = addMessageToSession(activeSessionId!, {
                  role: 'assistant',
                  content: processedContent,
                  model: currentModel,
                  providerName: currentProviderName,
                  toolCalls,
                  thinkingTime,
                  usage,
                });
              } catch (e) {
                console.error('Failed to save message to session:', e);
                // 如果保存失败，创建一个临时消息对象
                savedMessage = {
                  id: tempMessageId,
                  role: 'assistant' as const,
                  content: processedContent,
                  timestamp: Date.now(),
                  model: currentModel,
                  providerName: currentProviderName,
                  toolCalls,
                  thinkingTime,
                  usage,
                };
              }
              
              // 用保存的消息替换临时消息
              setMessages((prev) => {
                try {
                  console.log('onComplete - prev messages:', prev.length, 'looking for:', tempMessageId);
                  
                  const found = prev.some(msg => msg.id === tempMessageId);
                  console.log('Found temp message:', found);
                  
                  if (!found) {
                    // 如果没找到临时消息，直接添加保存的消息
                    console.log('Temp message not found, adding saved message directly');
                    return [...prev, savedMessage];
                  }
                  
                  return prev.map((msg) => {
                    if (msg.id === tempMessageId) {
                      return savedMessage;
                    }
                    return msg;
                  });
                } catch (e) {
                  console.error('Error updating messages:', e);
                  // 如果更新失败，至少确保添加了保存的消息
                  return [...prev, savedMessage];
                }
              });
              
              setIsLoading(false);
              setActiveToolCalls([]);
              // 清除引用
              completedToolCallsRef.current = [];
              thinkingStartTimeRef.current = 0;
              firstTokenTimeRef.current = 0;
              usageInfoRef.current = null;

              // RAG: 自动提取记忆（非隐身模式）
              if (!incognitoMode) {
                try {
                  const memorySettings = getMemorySettings();
                  if (memorySettings.enabled && memorySettings.autoSummarize) {
                    extractAndSaveMemories([userMessage, savedMessage]).then((extractedMemories) => {
                      if (extractedMemories.length > 0) {
                        console.log(`RAG: Extracted ${extractedMemories.length} memories`);
                      }
                    }).catch((e) => {
                      console.error('Memory extraction failed:', e);
                    });
                  }
                } catch (e) {
                  console.error('Memory extraction setup failed:', e);
                }
              }

              // 对话完成后触发智能遗忘清理（隐身模式下跳过）
              if (!incognitoMode) {
                try {
                  const memorySettings = getMemorySettings();
                  if (memorySettings.enabled && memorySettings.forgettingEnabled && memorySettings.cleanupFrequency === 'after_chat') {
                    const cleanupResult = performSmartCleanup();
                    if (cleanupResult.deletedCount > 0) {
                      console.log('Memory cleanup:', cleanupResult.reason);
                    }
                  }
                } catch (e) {
                  console.error('Memory cleanup failed:', e);
                }
              }
            } catch (error) {
              console.error('Error in onComplete callback:', error);
              setError(error instanceof Error ? error.message : '处理完成消息时发生错误');
              setIsLoading(false);
              setActiveToolCalls([]);
              // 移除临时的助手消息
              setMessages((prev) => prev.filter((m) => m.id !== tempMessageId));
            }
          },
          onError: (err) => {
            console.error('Stream error:', err);
            setError(err.message);
            // 移除临时的助手消息
            setMessages((prev) => prev.filter((m) => m.id !== tempMessageId));
            setIsLoading(false);
            setActiveToolCalls([]);
            setShowToolCallProgress(false);
          },
        },
        {
          model: currentModel,
          providerId: selectedModel.providerId,
          // 从聊天设置获取 temperature 和 max_tokens
          temperature: getChatSettings().temperature,
          max_tokens: getChatSettings().maxTokens,
          // 推理强度（仅当模型支持时）
          reasoningLevel: hasReasoningCapability ? reasoningLevel : undefined,
          // 工具选择（仅当模型支持时）
          toolSelectionMode: hasFunctionCallingCapability ? toolSelectionMode : undefined,
          selectedTools: hasFunctionCallingCapability && toolSelectionMode !== 'none'
            ? tools.filter(t => selectedTools.has(t.id))
            : undefined,
          // 隐身模式
          incognitoMode,
          // 固定 persona + RAG 系统提示
          systemPrompt: combinedSystemPrompt,
        }
      );
    } catch (error) {
      // 捕获所有未处理的错误，防止组件崩溃
      console.error('Unexpected error in handleSend:', error);
      setError(error instanceof Error ? error.message : '发送消息时发生未知错误');
      // 移除临时的助手消息
      setMessages((prev) => prev.filter((m) => m.id !== tempMessageId));
      setIsLoading(false);
      setActiveToolCalls([]);
      setShowToolCallProgress(false);
    } finally {
      sendLockRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 选择附件
  const handleSelectAttachments = async () => {
    if (!window.electronAPI?.selectFiles) {
      setError('文件选择功能仅在桌面应用中可用');
      return;
    }
    try {
      const files = await window.electronAPI.selectFiles();
      if (files.length > 0) {
        setAttachments((prev) => [...prev, ...files]);
      }
    } catch (err) {
      console.error('Failed to select files:', err);
      setError('选择文件失败');
    }
  };

  // 移除附件
  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSelectModel = (model: ModelOption) => {
    setSelectedModel(model);
    setShowModelSelector(false);
  };

  // 获取当前模型的能力
  const currentCapabilities = selectedModel?.capabilities;
  const hasReasoningCapability = currentCapabilities?.reasoning === true;
  const hasFunctionCallingCapability = currentCapabilities?.functionCalling === true;

  // 切换工具选择
  const toggleTool = useCallback((toolId: string) => {
    setSelectedTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
    setToolSelectionMode('custom');
  }, []);

  // 切换分类展开状态
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  // 设置工具选择模式
  const handleToolModeChange = useCallback((mode: ToolSelectionMode) => {
    setToolSelectionMode(mode);
    if (mode === 'all') {
      const allToolIds = tools.filter(t => t.enabled).map(t => t.id);
      setSelectedTools(new Set(allToolIds));
    } else if (mode === 'none') {
      setSelectedTools(new Set());
    } else if (mode === 'auto') {
      // 自动模式下也是全选，但由 AI 决定使用哪些
      const allToolIds = tools.filter(t => t.enabled).map(t => t.id);
      setSelectedTools(new Set(allToolIds));
    }
  }, [tools]);

  // 存储待重新生成的内容
  const pendingRegenerateRef = useRef<string | null>(null);

  // 监听 inputValue 变化，如果有待重新生成的内容则触发发送
  useEffect(() => {
    if (pendingRegenerateRef.current && inputValue === pendingRegenerateRef.current) {
      pendingRegenerateRef.current = null;
      // 延迟调用 handleSend 确保状态已更新
      setTimeout(() => {
        handleSend();
      }, 0);
    }
  }, [inputValue]);

  // 重新生成回复
  const handleRegenerate = useCallback((messageId: string) => {
    if (isLoading || !selectedModel) return;

    // 找到要重新生成的消息
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // 找到对应的用户消息（前一条）
    const userMessageIndex = messageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') return;

    const userMessage = messages[userMessageIndex];

    // 删除当前的助手消息（从 UI 和存储中）
    setMessages(prev => prev.filter((_, idx) => idx !== messageIndex));
    if (currentSessionId) {
      deleteMessageFromSession(currentSessionId, messageId);
    }

    // 设置待重新生成内容并更新输入框
    pendingRegenerateRef.current = userMessage.content;
    setInputValue(userMessage.content);
  }, [isLoading, selectedModel, messages, currentSessionId]);

  // 删除消息
  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    // 从存储中删除
    if (currentSessionId) {
      deleteMessageFromSession(currentSessionId, messageId);
    }
  }, [currentSessionId]);

  // 获取分类图标
  const getCategoryIcon = useCallback((categoryId: string) => {
    switch (categoryId) {
      case 'network':
        return <Globe className="w-4 h-4" />;
      case 'workspace':
        return <FolderOpen className="w-4 h-4" />;
      case 'utility':
        return <Wrench className="w-4 h-4" />;
      default:
        return <FolderOpen className="w-4 h-4" />;
    }
  }, []);

  // useMemo: 按提供商分组的模型列表
  const groupedModels = useMemo(() => {
    const providerIds = Array.from(new Set(availableModels.map(m => m.providerId)));
    return providerIds.map(providerId => ({
      providerId,
      providerName: availableModels.find(m => m.providerId === providerId)?.providerName || '',
      models: availableModels.filter(m => m.providerId === providerId)
    }));
  }, [availableModels]);

  // useMemo: 按分类分组的工具列表
  const toolsByCategory = useMemo(() => {
    return toolCategories.map(category => ({
      category,
      tools: tools.filter(t => t.categoryId === category.id),
      selectedCount: tools.filter(t => t.categoryId === category.id && selectedTools.has(t.id)).length
    }));
  }, [toolCategories, tools, selectedTools]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-center py-3 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-zinc-800">
        {messages.length} 条消息
        {isLoading && (
          <span className="ml-2 flex items-center gap-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            生成中...
          </span>
        )}
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <img src="/icon.png" alt="Tage" className="w-16 h-16 mb-4 rounded-full" />
            <p className="text-lg">开始新对话</p>
            <p className="text-sm mt-2">输入消息与 Tage 交流</p>
            {availableModels.length === 0 && (
              <p className="text-sm mt-4 text-orange-500">
                请先在设置中配置并启用提供商
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`group flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`max-w-[85%] ${message.role === 'assistant' ? 'w-full' : ''}`}>
                  <div
                    className={`rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-teal-600 text-white px-4 py-3'
                        : 'bg-gray-50 dark:bg-zinc-800/50 text-gray-900 dark:text-gray-100 px-5 py-4'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <div>
                        <div className="whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                        {/* 用户消息附件 */}
                        {message.attachments && message.attachments.length > 0 && (
                          <MessageAttachments attachments={message.attachments} />
                        )}
                      </div>
                    ) : (
                      <div className="break-words">
                        {/* 思考时间和工具摘要 - 显示在顶部 */}
                        {(message.thinkingTime || message.toolCalls) && (
                          <div className="flex items-center gap-3 mb-3 text-xs text-gray-500 dark:text-gray-400">
                            {message.thinkingTime && (
                              <div className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                  <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
                                </svg>
                                <span>思考了 {(message.thinkingTime / 1000).toFixed(3)} 秒</span>
                                <ChevronDown className="w-3 h-3" />
                              </div>
                            )}
                            {message.toolCalls && message.toolCalls.length > 0 && (
                              <div className="relative group/tools">
                                <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 cursor-pointer hover:underline">
                                  <Wrench className="w-3.5 h-3.5" />
                                  <span>{message.toolCalls.length} 个工具</span>
                                </div>
                                {/* 悬停提示 */}
                                <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/tools:block bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 min-w-[180px]">
                                  <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">自动选择的工具：</div>
                                  <ul className="space-y-1">
                                    {message.toolCalls.map((tc) => (
                                      <li key={tc.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="w-1 h-1 bg-gray-400 rounded-full" />
                                        {getToolDisplayName(tc.name)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 工具调用卡片 */}
                        {message.toolCalls && message.toolCalls.length > 0 && (
                          <ToolCallCards toolCalls={message.toolCalls} messageId={message.id} />
                        )}
                        
                        {/* 显示模型名称 */}
                        {message.model && (
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-zinc-700">
                            <span className="text-xs font-medium px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-md">
                              {message.model}
                            </span>
                            {message.providerName && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                via {message.providerName}
                              </span>
                            )}
                          </div>
                        )}
                        <MarkdownRenderer content={message.content} />
                        {isLoading && message === messages[messages.length - 1] && !message.content && (
                          <div className="flex items-center gap-2 text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>思考中...</span>
                          </div>
                        )}
                        {isLoading && message === messages[messages.length - 1] && message.content && (
                          <span className="inline-block w-2 h-5 bg-teal-500 animate-pulse ml-1 rounded-sm" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* 用户消息操作按钮 - 悬停时显示，在气泡外面右对齐 */}
                  {message.role === 'user' && !isLoading && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                      <SimpleMessageActions
                        message={message}
                        showRegenerate={index === messages.length - 1}
                        onRegenerate={handleRegenerate}
                        position="right"
                      />
                    </div>
                  )}

                  {/* 助手消息操作按钮 - 悬停时显示 */}
                  {message.role === 'assistant' && !isLoading && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MessageActions
                        message={message}
                        onRegenerate={index === messages.length - 1 ? handleRegenerate : undefined}
                        onDelete={handleDeleteMessage}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm">{error}</p>
            <button
              className="text-xs underline mt-1 hover:no-underline"
              onClick={() => setError(null)}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 隐身模式提示 */}
      {incognitoMode && memoryEnabled && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <EyeOff className="w-4 h-4" />
          <span>隐身模式已开启 - 点击禁用记忆功能</span>
        </div>
      )}

      {/* 工具调用进度 - 简化版（仅在加载时显示） */}
      {isLoading && showToolCallProgress && activeToolCalls.length > 0 && (
        <div className="mx-4 mb-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>正在执行工具调用...</span>
            <span className="text-xs text-blue-500">({activeToolCalls.length} 个工具)</span>
          </div>
          <div className="mt-2 space-y-1">
            {activeToolCalls.map((tc) => (
              <div key={tc.toolCall.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                {tc.status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-300" />}
                {tc.status === 'running' && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                {tc.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                {tc.status === 'error' && <XCircle className="w-3 h-3 text-red-500" />}
                <span>{getToolDisplayName(tc.toolCall.function.name)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="p-4 border-t border-gray-100 dark:border-zinc-800">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            {/* 附件预览 */}
            {attachments.length > 0 && (
              <AttachmentPreview
                attachments={attachments}
                onRemove={handleRemoveAttachment}
                compact
              />
            )}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Shift+Enter 换行)"
              rows={1}
              disabled={isLoading}
              className={`w-full px-4 py-3 pr-12 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                attachments.length > 0 ? 'rounded-b-lg' : 'rounded-lg'
              }`}
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
          </div>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between mt-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-1">
            {/* 附件按钮 */}
            <button
              onClick={handleSelectAttachments}
              disabled={isLoading}
              className={`p-2 rounded-lg transition-colors ${
                attachments.length > 0
                  ? 'text-teal-500 hover:text-teal-600 bg-teal-50 dark:bg-teal-950/30'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="添加附件"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* 推理强度选择器 - 仅当模型支持推理时显示 */}
            {hasReasoningCapability && (
              <div className="relative" ref={reasoningSelectorRef}>
                <button
                  onClick={() => setShowReasoningSelector(!showReasoningSelector)}
                  className={`p-2 rounded-lg transition-colors ${
                    reasoningLevel !== 'off'
                      ? 'text-purple-500 hover:text-purple-600 bg-purple-50 dark:bg-purple-950/30'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                  title="推理强度"
                >
                  <Lightbulb className="w-5 h-5" />
                </button>
                
                {/* 推理强度下拉菜单 */}
                {showReasoningSelector && (
                  <div className="absolute bottom-full mb-2 left-0 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50">
                    <div className="p-3 border-b border-gray-100 dark:border-zinc-800">
                      <h4 className="font-medium text-sm">推理</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        调整支持扩展思考的模型的推理强度。
                      </p>
                    </div>
                    <div className="p-2">
                      {REASONING_LEVELS.map((level) => (
                        <button
                          key={level.value}
                          onClick={() => {
                            setReasoningLevel(level.value);
                            setShowReasoningSelector(false);
                          }}
                          className={`w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors ${
                            reasoningLevel === level.value
                              ? 'bg-purple-50 dark:bg-purple-950/30'
                              : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            reasoningLevel === level.value
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300 dark:border-zinc-600'
                          }`}>
                            {reasoningLevel === level.value && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{level.icon}</span>
                              <span className="text-sm font-medium">{level.label}</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {level.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 工具选择器 - 仅当模型支持工具调用时显示 */}
            {hasFunctionCallingCapability && (
              <div className="relative" ref={toolsSelectorRef}>
                <button
                  onClick={() => setShowToolsSelector(!showToolsSelector)}
                  className={`p-2 rounded-lg transition-colors ${
                    toolSelectionMode !== 'none'
                      ? 'text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-950/30'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                  title="工具选择"
                >
                  <Wand2 className="w-5 h-5" />
                </button>
                
                {/* 工具选择下拉菜单 */}
                {showToolsSelector && (
                  <div className="absolute bottom-full mb-2 left-0 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50">
                    <div className="p-3 border-b border-gray-100 dark:border-zinc-800">
                      <h4 className="font-medium text-sm">工具</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        允许 AI 在下一次回复时使用所选工具。
                      </p>
                    </div>
                    
                    {/* 模式选择 */}
                    <div className="p-2 border-b border-gray-100 dark:border-zinc-800">
                      <div className="flex gap-1">
                        {(['auto', 'all', 'none'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => handleToolModeChange(mode)}
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              toolSelectionMode === mode || (toolSelectionMode === 'custom' && mode === 'auto')
                                ? 'bg-teal-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {mode === 'auto' ? '✨ 自动' : mode === 'all' ? '全选' : '全不选'}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">
                        让 AI 根据你的消息自动选择最相关的工具。
                      </p>
                    </div>
                    
                    {/* 工具分类列表 - 使用 memoized 数据 */}
                    <div className="max-h-64 overflow-y-auto">
                      {toolsByCategory.map(({ category, tools: categoryTools, selectedCount }) => {
                        const isExpanded = expandedCategories.has(category.id);

                        return (
                          <div key={category.id}>
                            <button
                              onClick={() => toggleCategory(category.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                              {getCategoryIcon(category.id)}
                              <span className="flex-1 text-left">{category.name}</span>
                              <span className="text-xs text-gray-400">
                                {selectedCount}/{categoryTools.length}
                              </span>
                              <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>

                            {isExpanded && (
                              <div className="pl-4">
                                {categoryTools.map((tool) => (
                                  <label
                                    key={tool.id}
                                    className="flex items-start gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedTools.has(tool.id)}
                                      onChange={() => toggleTool(tool.id)}
                                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {tool.name}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {tool.description}
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 隐身模式 - 仅当记忆功能启用时显示 */}
            {memoryEnabled && (
              <button
                onClick={() => setIncognitoMode(!incognitoMode)}
                className={`p-2 rounded-lg transition-colors ${
                  incognitoMode
                    ? 'text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/30'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
                title={incognitoMode ? '隐身模式已开启 - 点击关闭' : '隐身模式已关闭 - 点击禁用记忆功能'}
              >
                {incognitoMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            )}
          </div>

          {/* 模型选择器 */}
          <div className="relative" ref={modelSelectorRef}>
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <span className="text-blue-500">✦</span>
              <span>{selectedModel?.model || '选择模型'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
            </button>
            
            {/* 模型下拉菜单 */}
            {showModelSelector && (
              <div className="absolute bottom-full mb-2 right-0 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50">
                {availableModels.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                    暂无可用模型
                    <br />
                    <span className="text-xs">请先在设置中配置提供商</span>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {/* 按提供商分组 - 使用 memoized 数据 */}
                    {groupedModels.map(({ providerId, providerName, models: providerModels }) => (
                      <div key={providerId}>
                        <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 sticky top-0">
                          {providerName}
                        </div>
                        {providerModels.map((model) => (
                          <button
                            key={`${model.providerId}-${model.model}`}
                            onClick={() => handleSelectModel(model)}
                            className={`w-full px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-zinc-800 ${
                              selectedModel?.providerId === model.providerId && selectedModel?.model === model.model
                                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <span>{model.model}</span>
                            {selectedModel?.providerId === model.providerId && selectedModel?.model === model.model && (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="p-2 text-gray-400 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
