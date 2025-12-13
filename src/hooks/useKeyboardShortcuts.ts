import { useEffect, useCallback } from 'react';

// 预设快捷键定义
export const PRESET_SHORTCUTS = {
  newChat: { key: 'n', modifiers: ['meta', 'ctrl'], label: '新建聊天' },
  search: { key: 'k', modifiers: ['meta', 'ctrl'], label: '搜索' },
  settings: { key: ',', modifiers: ['meta', 'ctrl'], label: '打开设置' },
  toggleSidebar: { key: 'b', modifiers: ['meta', 'ctrl'], label: '切换侧边栏' },
  sendMessage: { key: 'Enter', modifiers: ['meta', 'ctrl'], label: '发送消息' },
} as const;

export type ShortcutAction = keyof typeof PRESET_SHORTCUTS;

export interface ShortcutHandlers {
  onNewChat?: () => void;
  onSearch?: () => void;
  onSettings?: () => void;
  onToggleSidebar?: () => void;
  onSendMessage?: () => void;
}

// 检查修饰键
function checkModifiers(event: KeyboardEvent): boolean {
  // 在 Mac 上使用 Meta (Cmd)，在其他系统使用 Ctrl
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? event.metaKey : event.ctrlKey;
}

// 格式化快捷键显示
export function formatShortcut(action: ShortcutAction): string {
  const shortcut = PRESET_SHORTCUTS[action];
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';
  const key = shortcut.key === ',' ? ',' : shortcut.key.toUpperCase();
  return `${modKey}+${key}`;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 检查是否按下了修饰键
      if (!checkModifiers(event)) {
        return;
      }

      // 忽略在输入框中的某些快捷键（除了 sendMessage）
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      const key = event.key.toLowerCase();

      switch (key) {
        case 'n':
          if (!isInput) {
            event.preventDefault();
            handlers.onNewChat?.();
          }
          break;

        case 'k':
          event.preventDefault();
          handlers.onSearch?.();
          break;

        case ',':
          event.preventDefault();
          handlers.onSettings?.();
          break;

        case 'b':
          if (!isInput) {
            event.preventDefault();
            handlers.onToggleSidebar?.();
          }
          break;

        case 'enter':
          // 在输入框中，Cmd/Ctrl+Enter 发送消息
          if (isInput) {
            event.preventDefault();
            handlers.onSendMessage?.();
          }
          break;
      }
    },
    [handlers]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// 获取所有快捷键列表（用于设置页面显示）
export function getAllShortcuts(): Array<{
  action: ShortcutAction;
  label: string;
  shortcut: string;
}> {
  return (Object.entries(PRESET_SHORTCUTS) as [ShortcutAction, typeof PRESET_SHORTCUTS[ShortcutAction]][]).map(
    ([action, config]) => ({
      action,
      label: config.label,
      shortcut: formatShortcut(action),
    })
  );
}
