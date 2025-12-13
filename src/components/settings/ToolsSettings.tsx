import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  getToolsByCategory,
  setAllToolsEnabled,
  toggleToolEnabled,
  type Tool,
} from '@/services/storage';

interface ToolGroup {
  category: {
    id: string;
    name: string;
    icon?: string;
    expanded?: boolean;
  };
  tools: Tool[];
}

export default function ToolsSettings() {
  const [groups, setGroups] = useState<ToolGroup[]>(getToolsByCategory());
  const [allEnabled, setAllEnabled] = useState<boolean>(true);

  const refresh = () => {
    const next = getToolsByCategory();
    setGroups(next);
    setAllEnabled(next.every((g) => g.tools.every((t) => t.enabled)));
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('tools-updated', handler);
    return () => window.removeEventListener('tools-updated', handler);
  }, []);

  const handleToggleAll = (checked: boolean) => {
    setAllToolsEnabled(checked);
    refresh();
  };

  const handleToggle = (toolId: string) => {
    toggleToolEnabled(toolId);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">系统工具</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            控制 macOS 本机工具（AppleScript、Shell、日历、提醒等）的可用性。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="enableAll">全部启用</Label>
          <Switch id="enableAll" checked={allEnabled} onChange={(e) => handleToggleAll(e.target.checked)} />
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <Card key={group.category.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{group.category.name}</div>
                <div className="text-xs text-gray-400">
                  {group.tools.filter((t) => t.enabled).length}/{group.tools.length} 已启用
                </div>
              </div>
              <div className="space-y-2">
                {group.tools.map((tool) => (
                  <div key={tool.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-gray-50 dark:bg-zinc-900/40">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">{tool.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{tool.description}</div>
                    </div>
                    <Switch checked={tool.enabled} onChange={() => handleToggle(tool.id)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

