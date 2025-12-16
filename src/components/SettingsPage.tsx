import GeneralSettings from './settings/GeneralSettings';
import ProvidersSettings from './settings/ProvidersSettings';
import ChatSettings from './settings/ChatSettings';
import MemorySettings from './settings/MemorySettings';
import UISettings from './settings/UISettings';
import NetworkSettings from './settings/NetworkSettings';
import ToolsSettings from './settings/ToolsSettings';
import ShortcutsSettings from './settings/ShortcutsSettings';
import QuickCommandsSettings from './settings/QuickCommandsSettings';
import AboutSettings from './settings/AboutSettings';

export type SettingsSection =
  | 'general'
  | 'providers'
  | 'chat'
  | 'memory'
  | 'ui'
  | 'network'
  | 'tools'
  | 'shortcuts'
  | 'quick_commands'
  | 'about';

interface SettingsPageProps {
  section: SettingsSection;
}

const sectionTitles: Record<SettingsSection, string> = {
  general: '通用',
  providers: '提供商',
  chat: '聊天',
  memory: '记忆',
  ui: '用户界面',
  network: '网络',
  tools: '系统工具',
  shortcuts: '快捷键',
  quick_commands: '快捷提示',
  about: '关于',
};

export default function SettingsPage({ section }: SettingsPageProps) {
  const renderSettings = () => {
    switch (section) {
      case 'general':
        return <GeneralSettings />;
      case 'providers':
        return <ProvidersSettings />;
      case 'chat':
        return <ChatSettings />;
      case 'memory':
        return <MemorySettings />;
      case 'ui':
        return <UISettings />;
      case 'network':
        return <NetworkSettings />;
      case 'tools':
        return <ToolsSettings />;
      case 'shortcuts':
        return <ShortcutsSettings />;
      case 'quick_commands':
        return <QuickCommandsSettings />;
      case 'about':
        return <AboutSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className="h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{sectionTitles[section]}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          配置 {sectionTitles[section]} 相关设置
        </p>
      </div>
      {renderSettings()}
    </div>
  );
}
