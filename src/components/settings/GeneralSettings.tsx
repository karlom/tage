import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import {
  getGeneralSettings,
  updateGeneralSettings,
  getAvailableModels,
  type GeneralSettings as GeneralSettingsType,
} from '@/services/storage';

export default function GeneralSettings() {
  const [settings, setSettings] = useState<GeneralSettingsType>(getGeneralSettings);
  const [availableModels, setAvailableModels] = useState<
    { providerId: string; providerName: string; models: string[] }[]
  >([]);

  // 加载可用模型列表
  useEffect(() => {
    setAvailableModels(getAvailableModels());

    // 监听提供商更新
    const handleProvidersUpdate = () => {
      setAvailableModels(getAvailableModels());
    };
    window.addEventListener('providers-updated', handleProvidersUpdate);
    return () => window.removeEventListener('providers-updated', handleProvidersUpdate);
  }, []);

  // 监听设置更新事件
  useEffect(() => {
    const handleUpdate = () => {
      setSettings(getGeneralSettings());
    };
    window.addEventListener('general-settings-updated', handleUpdate);
    return () => window.removeEventListener('general-settings-updated', handleUpdate);
  }, []);

  const handleChange = <K extends keyof GeneralSettingsType>(
    key: K,
    value: GeneralSettingsType[K]
  ) => {
    const updated = updateGeneralSettings({ [key]: value });
    setSettings(updated);

    // 处理开机自启设置
    if (key === 'launchAtLogin' && window.electronAPI?.setAutoLaunch) {
      window.electronAPI.setAutoLaunch(value as boolean).catch((err) => {
        console.error('Failed to set auto launch:', err);
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">通用设置</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="toolModel">工具模型</Label>
            <Select
              id="toolModel"
              value={settings.toolModel}
              onChange={(e) => handleChange('toolModel', e.target.value)}
            >
              <option value="">选择工具模型</option>
              {availableModels.map((provider) => (
                <optgroup key={provider.providerId} label={provider.providerName}>
                  {provider.models.map((model) => (
                    <option key={model} value={`${provider.providerId}:${model}`}>
                      {model}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              用于后台任务（如总结标题、重写查询）
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">语言</Label>
            <Select
              id="language"
              value={settings.language}
              onChange={(e) => handleChange('language', e.target.value as 'zh' | 'en')}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="launchAtLogin">开机自启</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                应用启动时自动登录
              </p>
            </div>
            <Switch
              id="launchAtLogin"
              checked={settings.launchAtLogin}
              onChange={(e) => handleChange('launchAtLogin', e.target.checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="minimizeToTray">启动时最小化到托盘</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                启动后自动最小化到系统托盘
              </p>
            </div>
            <Switch
              id="minimizeToTray"
              checked={settings.minimizeToTray}
              onChange={(e) => handleChange('minimizeToTray', e.target.checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="developerMode">开发者模式</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                启用后显示 Inspector 等开发工具
              </p>
            </div>
            <Switch
              id="developerMode"
              checked={settings.developerMode}
              onChange={(e) => handleChange('developerMode', e.target.checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
