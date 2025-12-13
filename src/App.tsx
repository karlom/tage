import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import MainContent from '@/components/MainContent';
import SettingsPage from '@/components/SettingsPage';
import ChatPage from '@/components/ChatPage';
import SearchModal from '@/components/SearchModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { SettingsSection } from '@/components/SettingsPage';
import {
  getChatSessions,
  deleteChatSession as deleteSession,
  initializeStorage,
  type ChatSession,
} from '@/services/storage';
import { useTheme } from '@/hooks/useTheme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

type AppMode = 'chat' | 'settings';

function App() {
  const [mode, setMode] = useState<AppMode>('chat');
  const [selectedSection, setSelectedSection] =
    useState<SettingsSection>('general');
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // 初始化主题
  useTheme();

  // 刷新会话列表
  const refreshSessions = useCallback(() => {
    const sessions = getChatSessions();
    setChatSessions(sessions);
  }, []);

  const handleNewChat = useCallback(() => {
    setSelectedChatId(undefined);
    setMode('chat');
  }, []);

  const handleOpenSettings = useCallback(() => {
    setMode('settings');
  }, []);

  const handleSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleBackToChat = useCallback(() => {
    setMode('chat');
  }, []);

  const handleDeleteChat = useCallback(
    (id: string) => {
      deleteSession(id);
      refreshSessions();
      if (selectedChatId === id) {
        setSelectedChatId(undefined);
      }
    },
    [selectedChatId, refreshSessions]
  );

  const handleChatSelect = useCallback((id: string) => {
    setSelectedChatId(id);
    setMode('chat');
  }, []);

  const handleSessionCreated = useCallback(
    (sessionId: string) => {
      setSelectedChatId(sessionId);
      refreshSessions();
    },
    [refreshSessions]
  );

  // 初始化快捷键
  useKeyboardShortcuts({
    onNewChat: handleNewChat,
    onSettings: handleOpenSettings,
    onSearch: handleSearch,
  });

  // 初始化存储并加载聊天会话
  useEffect(() => {
    const init = async () => {
      await initializeStorage();
      setIsStorageReady(true);
      const sessions = getChatSessions();
      setChatSessions(sessions);
    };
    init();
  }, []);

  return (
    <ErrorBoundary>
      {!isStorageReady ? (
        <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-zinc-950">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      ) : (
        <div className="h-screen w-screen flex overflow-hidden relative">
          {/* 顶部拖拽区域 - 覆盖整个顶部 */}
          <div
            className="fixed top-0 left-0 right-0 h-10 z-10"
            style={{
              WebkitAppRegion: 'drag',
              WebkitUserSelect: 'none',
            } as React.CSSProperties}
          />
          <Sidebar
            mode={mode}
            selectedSection={selectedSection}
            onSectionChange={setSelectedSection}
            chatSessions={chatSessions.map((s) => ({
              id: s.id,
              title: s.title,
              updatedAt: s.updatedAt,
            }))}
            selectedChatId={selectedChatId}
            onChatSelect={handleChatSelect}
            onNewChat={handleNewChat}
            onOpenSettings={handleOpenSettings}
            onBackToChat={handleBackToChat}
            onDeleteChat={handleDeleteChat}
          />
          {mode === 'settings' ? (
            <MainContent>
              <SettingsPage section={selectedSection} />
            </MainContent>
          ) : (
            <MainContent fullHeight>
              <ChatPage
                sessionId={selectedChatId}
                onSessionCreated={handleSessionCreated}
              />
            </MainContent>
          )}
          {/* 搜索模态框 */}
          <SearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSelectSession={(id) => {
              handleChatSelect(id);
              setSearchOpen(false);
            }}
            onSelectMemory={() => {
              // 跳转到记忆设置页
              setSelectedSection('memory');
              setMode('settings');
              setSearchOpen(false);
            }}
          />
        </div>
      )}
    </ErrorBoundary>
  );
}

export default App;
