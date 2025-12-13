import { useEffect, useState, useCallback } from 'react';
import { getUISettings, type ThemeMode } from '@/services/storage';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => getUISettings().theme);

  // 应用主题到 document
  const applyTheme = useCallback((themeMode: ThemeMode) => {
    const root = document.documentElement;

    if (themeMode === 'system') {
      // 检测系统主题
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else if (themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  // 初始化和监听设置变化
  useEffect(() => {
    // 初始应用主题
    applyTheme(theme);

    // 监听 UI 设置更新
    const handleSettingsUpdate = () => {
      const newTheme = getUISettings().theme;
      setTheme(newTheme);
      applyTheme(newTheme);
    };
    window.addEventListener('ui-settings-updated', handleSettingsUpdate);

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      const currentSettings = getUISettings();
      if (currentSettings.theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      window.removeEventListener('ui-settings-updated', handleSettingsUpdate);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme, applyTheme]);

  return { theme };
}
