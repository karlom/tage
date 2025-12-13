import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  getUISettings,
  updateUISettings,
  type UISettings as UISettingsType,
  type ThemeMode,
} from '@/services/storage';

export default function UISettings() {
  const [settings, setSettings] = useState<UISettingsType>(getUISettings);

  // 监听设置更新事件
  useEffect(() => {
    const handleUpdate = () => {
      setSettings(getUISettings());
    };
    window.addEventListener('ui-settings-updated', handleUpdate);
    return () => window.removeEventListener('ui-settings-updated', handleUpdate);
  }, []);

  const handleChange = <K extends keyof UISettingsType>(
    key: K,
    value: UISettingsType[K]
  ) => {
    const updated = updateUISettings({ [key]: value });
    setSettings(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">用户界面</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">主题</Label>
            <Select
              id="theme"
              value={settings.theme}
              onChange={(e) => handleChange('theme', e.target.value as ThemeMode)}
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="compactMode">紧凑模式</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                使用更紧凑的界面布局
              </p>
            </div>
            <Switch
              id="compactMode"
              checked={settings.compactMode}
              onChange={(e) => handleChange('compactMode', e.target.checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showSidebar">显示侧边栏</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                显示左侧导航栏
              </p>
            </div>
            <Switch
              id="showSidebar"
              checked={settings.showSidebar}
              onChange={(e) => handleChange('showSidebar', e.target.checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
