import { Keyboard } from 'lucide-react';
import { getAllShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function ShortcutsSettings() {
  const shortcuts = getAllShortcuts();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">快捷键</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          以下是预设的快捷键，可以帮助你更快地使用应用。
        </p>
        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg"
            >
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {shortcut.label}
                </span>
              </div>
              <div className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded text-sm font-mono">
                <Keyboard className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300">
                  {shortcut.shortcut}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            提示：在 Mac 上使用 ⌘ (Command) 键，在 Windows/Linux 上使用 Ctrl 键。
          </p>
        </div>
      </div>
    </div>
  );
}
