import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, MessageSquare, Brain, FileText, ChevronRight } from 'lucide-react';
import {
  type ChatSession,
  type Message,
  type Memory,
  getChatSessions,
  getMemories,
} from '@/services/storage';

interface SessionResult {
  type: 'session';
  session: ChatSession;
  matchedMessages: Message[];
  titleMatch: boolean;
}

interface MemoryResult {
  type: 'memory';
  memory: Memory;
}

type SearchResult = SessionResult | MemoryResult;

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onSelectMemory: (memoryId: string) => void;
}

// 高亮匹配文本
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <span className="bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 rounded px-0.5">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
}

// 搜索函数
function searchAll(query: string): {
  sessions: SessionResult[];
  memories: MemoryResult[];
} {
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return { sessions: [], memories: [] };
  }

  const sessions = getChatSessions();
  const memories = getMemories();

  // 搜索会话标题和消息内容
  const sessionResults: SessionResult[] = sessions
    .map(session => {
      const titleMatch = session.title.toLowerCase().includes(lowerQuery);
      const matchedMessages = session.messages.filter(m =>
        m.content.toLowerCase().includes(lowerQuery)
      );
      return { type: 'session' as const, session, matchedMessages, titleMatch };
    })
    .filter(r => r.titleMatch || r.matchedMessages.length > 0);

  // 搜索记忆
  const memoryResults: MemoryResult[] = memories
    .filter(m => m.content.toLowerCase().includes(lowerQuery))
    .map(memory => ({ type: 'memory' as const, memory }));

  return { sessions: sessionResults, memories: memoryResults };
}

// 标签页类型
type TabType = 'all' | 'sessions' | 'memories';

export default function SearchModal({
  isOpen,
  onClose,
  onSelectSession,
  onSelectMemory,
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // 搜索结果
  const { sessions, memories } = useMemo(() => searchAll(query), [query]);

  // 合并结果用于键盘导航
  const allResults = useMemo(() => {
    if (activeTab === 'sessions') return sessions;
    if (activeTab === 'memories') return memories;
    return [...sessions, ...memories];
  }, [activeTab, sessions, memories]);

  // 当前显示的结果
  const displayedSessions = activeTab === 'memories' ? [] : sessions;
  const displayedMemories = activeTab === 'sessions' ? [] : memories;

  // 总结果数
  const totalCount = sessions.length + memories.length;

  // 自动聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setActiveTab('all');
      // 延迟聚焦以确保模态框已渲染
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeTab]);

  // 滚动到选中项
  useEffect(() => {
    if (resultsRef.current && allResults.length > 0) {
      const selectedElement = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, allResults.length]);

  // 处理选择
  const handleSelect = useCallback((result: SearchResult) => {
    if (result.type === 'session') {
      onSelectSession(result.session.id);
    } else {
      onSelectMemory(result.memory.id);
    }
    onClose();
  }, [onSelectSession, onSelectMemory, onClose]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (allResults[selectedIndex]) {
          handleSelect(allResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        // 切换标签页
        setActiveTab(prev => {
          if (prev === 'all') return 'sessions';
          if (prev === 'sessions') return 'memories';
          return 'all';
        });
        break;
    }
  }, [allResults, selectedIndex, handleSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 搜索输入框 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索对话、消息或记忆..."
            className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-lg"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <kbd className="hidden sm:block px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-zinc-800 rounded">
            ESC
          </kbd>
        </div>

        {/* 标签页 */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'all'
                ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
          >
            全部 {totalCount > 0 && `(${totalCount})`}
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'sessions'
                ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            对话 {sessions.length > 0 && `(${sessions.length})`}
          </button>
          <button
            onClick={() => setActiveTab('memories')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'memories'
                ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Brain className="w-4 h-4" />
            记忆 {memories.length > 0 && `(${memories.length})`}
          </button>
          <div className="flex-1" />
          <span className="text-xs text-gray-400">
            Tab 切换 · ↑↓ 选择 · Enter 确认
          </span>
        </div>

        {/* 搜索结果 */}
        <div
          ref={resultsRef}
          className="max-h-[50vh] overflow-y-auto"
        >
          {!query.trim() ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>输入关键词搜索对话、消息或记忆</p>
              <p className="text-sm mt-2">
                使用 <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded text-xs">⌘K</kbd> 快速打开搜索
              </p>
            </div>
          ) : totalCount === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>没有找到匹配的结果</p>
              <p className="text-sm mt-2">尝试使用不同的关键词</p>
            </div>
          ) : (
            <div className="py-2">
              {/* 会话结果 */}
              {displayedSessions.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    对话
                  </div>
                  {displayedSessions.map((result) => {
                    const globalIndex = allResults.indexOf(result);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <button
                        key={result.session.id}
                        data-index={globalIndex}
                        onClick={() => handleSelect(result)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${
                          isSelected ? 'bg-teal-50 dark:bg-teal-900/30' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <MessageSquare className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {highlightMatch(result.session.title, query)}
                              </span>
                              {result.matchedMessages.length > 0 && (
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                  {result.matchedMessages.length} 条匹配
                                </span>
                              )}
                            </div>
                            {/* 显示匹配的消息预览 */}
                            {result.matchedMessages.length > 0 && (
                              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                                {highlightMatch(
                                  result.matchedMessages[0].content.slice(0, 100),
                                  query
                                )}
                                {result.matchedMessages[0].content.length > 100 && '...'}
                              </div>
                            )}
                            <div className="mt-1 text-xs text-gray-400">
                              {result.session.messages.length} 条消息 · {new Date(result.session.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 记忆结果 */}
              {displayedMemories.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    记忆
                  </div>
                  {displayedMemories.map((result) => {
                    const globalIndex = allResults.indexOf(result);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <button
                        key={result.memory.id}
                        data-index={globalIndex}
                        onClick={() => handleSelect(result)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${
                          isSelected ? 'bg-teal-50 dark:bg-teal-900/30' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Brain className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-900 dark:text-gray-100">
                              {highlightMatch(
                                result.memory.content.length > 150
                                  ? result.memory.content.slice(0, 150) + '...'
                                  : result.memory.content,
                                query
                              )}
                            </div>
                            <div className="mt-1 text-xs text-gray-400 flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded ${
                                result.memory.source === 'auto'
                                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                  : 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                              }`}>
                                {result.memory.source === 'auto' ? '自动' : '手动'}
                              </span>
                              <span>重要性: {result.memory.importance}</span>
                              <span>{new Date(result.memory.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
