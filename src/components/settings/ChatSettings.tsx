import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  getChatSettings,
  updateChatSettings,
  type ChatSettings as ChatSettingsType,
} from '@/services/storage';

export default function ChatSettings() {
  const [settings, setSettings] = useState<ChatSettingsType>(getChatSettings);

  // 监听设置更新事件
  useEffect(() => {
    const handleUpdate = () => {
      setSettings(getChatSettings());
    };
    window.addEventListener('chat-settings-updated', handleUpdate);
    return () => window.removeEventListener('chat-settings-updated', handleUpdate);
  }, []);

  const handleChange = <K extends keyof ChatSettingsType>(
    key: K,
    value: ChatSettingsType[K]
  ) => {
    const updated = updateChatSettings({ [key]: value });
    setSettings(updated);
  };

  const getTemperatureLabel = (value: number) => {
    if (value < 0.5) return '保守';
    if (value < 1.0) return '平衡';
    return '创意';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">聊天设置</h3>
        <div className="space-y-6">
          {/* 参数控制 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              参数控制
            </h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">Temperature</Label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {settings.temperature.toFixed(1)} ({getTemperatureLabel(settings.temperature)})
                </span>
              </div>
              <Slider
                id="temperature"
                min={0}
                max={2}
                step={0.1}
                value={settings.temperature}
                onValueChange={(value) => handleChange('temperature', value)}
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>0.0 (保守)</span>
                <span>1.0 (平衡)</span>
                <span>2.0 (创意)</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min={1}
                max={32000}
                value={settings.maxTokens}
                onChange={(e) => handleChange('maxTokens', parseInt(e.target.value) || 2048)}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                默认: 2048
              </p>
            </div>
          </div>

          {/* 体验设置 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              体验设置
            </h4>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableStreaming">流式响应</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  启用后消息将实时流式显示
                </p>
              </div>
              <Switch
                id="enableStreaming"
                checked={settings.enableStreaming}
                onChange={(e) => handleChange('enableStreaming', e.target.checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="showTokenUsage">显示 Token 使用量</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  在消息中显示 Token 消耗统计
                </p>
              </div>
              <Switch
                id="showTokenUsage"
                checked={settings.showTokenUsage}
                onChange={(e) => handleChange('showTokenUsage', e.target.checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableMarkdown">Markdown 渲染</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  启用 Markdown 格式渲染
                </p>
              </div>
              <Switch
                id="enableMarkdown"
                checked={settings.enableMarkdown}
                onChange={(e) => handleChange('enableMarkdown', e.target.checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableSoundEffects">音效</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  生成时播放音效
                </p>
              </div>
              <Switch
                id="enableSoundEffects"
                checked={settings.enableSoundEffects}
                onChange={(e) => handleChange('enableSoundEffects', e.target.checked)}
              />
            </div>
          </div>

          {/* 历史记录 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              历史记录
            </h4>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoSave">自动保存</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  自动保存聊天历史记录
                </p>
              </div>
              <Switch
                id="autoSave"
                checked={settings.autoSave}
                onChange={(e) => handleChange('autoSave', e.target.checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="historyRetentionDays">保留天数</Label>
              <Input
                id="historyRetentionDays"
                type="number"
                min={1}
                max={365}
                value={settings.historyRetentionDays}
                onChange={(e) =>
                  handleChange('historyRetentionDays', parseInt(e.target.value) || 30)
                }
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                默认: 30 天
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
