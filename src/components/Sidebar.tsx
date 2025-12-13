import React, { memo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Settings, MoreHorizontal, ArrowLeft, X } from 'lucide-react';
import type { SettingsSection } from './SettingsPage';

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
}

interface SidebarProps {
  mode?: 'settings' | 'chat';
  selectedSection?: SettingsSection;
  onSectionChange?: (section: SettingsSection) => void;
  chatSessions?: ChatSession[];
  selectedChatId?: string;
  onChatSelect?: (id: string) => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  onBackToChat?: () => void;
  onDeleteChat?: (id: string) => void;
}

const settingsMenuItems: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: '通用' },
  { id: 'providers', label: '提供商' },
  { id: 'chat', label: '聊天' },
  { id: 'memory', label: '记忆' },
  { id: 'ui', label: '用户界面' },
  { id: 'network', label: '网络' },
  { id: 'tools', label: '系统工具' },
  { id: 'shortcuts', label: '快捷键' },
  { id: 'about', label: '关于' },
];

// 会话项组件 - memo 化以避免不必要的重渲染
interface SessionItemProps {
  session: ChatSession;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const SessionItem = memo(function SessionItem({ session, isSelected, onSelect, onDelete }: SessionItemProps) {
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(session.id);
  }, [onDelete, session.id]);

  const handleSelect = useCallback(() => {
    onSelect(session.id);
  }, [onSelect, session.id]);

  return (
    <div
      onClick={handleSelect}
      className={`group flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
      }`}
    >
      <span className="truncate flex-1">
        {session.title}
      </span>
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
});

export default memo(function Sidebar({
  mode = 'chat',
  selectedSection = 'general',
  onSectionChange,
  chatSessions = [],
  selectedChatId,
  onChatSelect,
  onNewChat,
  onOpenSettings,
  onBackToChat,
  onDeleteChat,
}: SidebarProps) {
  return (
    <div className="w-[260px] h-full bg-gray-50 dark:bg-zinc-900 flex flex-col border-r border-gray-200 dark:border-zinc-800">
      {/* 顶部留空区域（为原生交通灯按钮留出空间） */}
      <div className="h-10 flex-shrink-0" />
      <Card className="m-2 flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-4 flex-1 flex flex-col overflow-hidden">
          {mode === 'settings' ? (
            <>
              {/* 返回按钮 */}
              <button
                onClick={onBackToChat}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors mb-3"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>返回聊天</span>
              </button>
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Settings className="w-4 h-4" />
                <span>设置</span>
              </div>
              <div className="space-y-1 flex-1 overflow-y-auto">
                {settingsMenuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSectionChange?.(item.id)}
                    className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors ${
                      selectedSection === item.id
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 space-y-1">
                <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded cursor-pointer">
                  导入设置
                </div>
                <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded cursor-pointer">
                  导出设置
                </div>
                <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded cursor-pointer">
                  重置设置
                </div>
              </div>
            </>
          ) : (
            <>
              {/* New Chat 按钮 */}
              <div
                onClick={onNewChat}
                className="px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg cursor-pointer transition-colors mb-3"
              >
                New Chat
              </div>

              {/* 聊天历史列表 */}
              <div className="flex-1 overflow-y-auto space-y-1">
                {chatSessions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                    暂无历史会话
                  </div>
                ) : (
                  chatSessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isSelected={selectedChatId === session.id}
                      onSelect={onChatSelect || (() => {})}
                      onDelete={onDeleteChat || (() => {})}
                    />
                  ))
                )}
              </div>

              {/* 底部设置按钮 */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
                <button
                  onClick={onOpenSettings}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

