import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Plus,
  Search,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Brain,
  ChevronDown,
  Edit2,
  Check,
  X,
  Pin,
  PinOff,
  Eye,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  getMemorySettings,
  saveMemorySettings,
  addMemory,
  deleteMemory,
  updateMemory,
  clearAllMemories,
  searchMemories,
  getActiveProviders,
  toggleMemoryPinned,
  getMemoriesWithImportance,
  getMemoryStatsEnhanced,
  performSmartCleanup,
  getCleanupPreviewCount,
  type MemorySettings as MemorySettingsType,
  type Memory,
  type DecayRate,
} from '@/services/storage';
import { EMBEDDING_PROVIDERS } from '@/services/embedding';

// 自定义 Checkbox 组件
function Checkbox({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
        checked
          ? 'bg-teal-500 border-teal-500'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-800'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

// 下拉选择组件
function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-left text-sm hover:border-gray-300 dark:hover:border-zinc-600 transition-colors"
      >
        <span className={selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}>
          {selectedOption?.label || placeholder || '请选择'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 ${
                  option.value === value ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' : ''
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 重要性进度条组件
function ImportanceBar({ value, threshold }: { value: number; threshold: number }) {
  const getColor = () => {
    if (value >= 70) return 'bg-green-500';
    if (value >= threshold) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className={`text-xs font-medium min-w-[32px] text-right ${
        value < threshold ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
      }`}>
        {value.toFixed(0)}
      </span>
    </div>
  );
}

// 记忆项组件（增强版）
function MemoryItem({
  memory,
  currentImportance,
  threshold,
  onDelete,
  onUpdate,
  onTogglePin,
}: {
  memory: Memory;
  currentImportance: number;
  threshold: number;
  onDelete: () => void;
  onUpdate: (content: string) => void;
  onTogglePin: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(memory.content);

  const handleSave = () => {
    if (editContent.trim()) {
      onUpdate(editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditContent(memory.content);
    setIsEditing(false);
  };

  const isAtRisk = !memory.pinned && currentImportance < threshold;

  return (
    <div className={`p-3 rounded-lg border transition-colors ${
      memory.pinned 
        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' 
        : isAtRisk
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700'
    }`}>
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1" />
              取消
            </Button>
            <Button size="sm" onClick={handleSave} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Check className="w-4 h-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* 顶部信息栏 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* 来源标签 */}
              <span className={`px-1.5 py-0.5 rounded text-xs flex-shrink-0 ${
                memory.source === 'auto' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              }`}>
                {memory.source === 'auto' ? '自动' : '手动'}
              </span>
              {/* 固定标签 */}
              {memory.pinned && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Pin className="w-3 h-3" />
                  已固定
                </span>
              )}
              {/* 即将遗忘警告 */}
              {isAtRisk && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  即将遗忘
                </span>
              )}
              {/* 访问次数 */}
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {memory.accessCount}
              </span>
            </div>
            {/* 操作按钮 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={onTogglePin}
                className={`p-1.5 rounded-lg transition-colors ${
                  memory.pinned 
                    ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30' 
                    : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                }`}
                title={memory.pinned ? '取消固定' : '固定（不会被遗忘）'}
              >
                {memory.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* 内容 */}
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
            {memory.content}
          </p>
          
          {/* 底部信息 */}
          <div className="flex items-center justify-between gap-4 pt-1">
            {/* 重要性进度条 */}
            <div className="flex-1 max-w-[200px]">
              <ImportanceBar value={currentImportance} threshold={threshold} />
            </div>
            {/* 时间 */}
            <span className="text-xs text-gray-400 flex-shrink-0">
              {new Date(memory.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// 设置卡片组件
function SettingsCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5 ${className}`}>
      {children}
    </div>
  );
}

// 增强的记忆类型（包含当前重要性）
type MemoryWithImportance = Memory & { currentImportance: number };

export default function MemorySettings() {
  const [settings, setSettings] = useState<MemorySettingsType>(getMemorySettings());
  const [memories, setMemories] = useState<MemoryWithImportance[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    auto: 0,
    manual: 0,
    pinned: 0,
    avgImportance: 0,
    belowThreshold: 0,
    threshold: 20,
  });
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasEmbeddingProvider, setHasEmbeddingProvider] = useState(false);
  const [cleanupPreviewCount, setCleanupPreviewCount] = useState(0);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  // 加载数据
  useEffect(() => {
    loadData();
    checkEmbeddingProvider();
    
    const handleUpdate = () => loadData();
    const handleSettingsUpdate = () => {
      setSettings(getMemorySettings());
      loadData();
    };
    
    window.addEventListener('memories-updated', handleUpdate);
    window.addEventListener('memory-settings-updated', handleSettingsUpdate);
    window.addEventListener('providers-updated', checkEmbeddingProvider);
    
    return () => {
      window.removeEventListener('memories-updated', handleUpdate);
      window.removeEventListener('memory-settings-updated', handleSettingsUpdate);
      window.removeEventListener('providers-updated', checkEmbeddingProvider);
    };
  }, []);

  // 当设置变化时重新加载数据
  useEffect(() => {
    loadData();
  }, [settings.decayRate, settings.importanceThreshold, settings.maxMemoryCount]);

  const loadData = () => {
    const currentSettings = getMemorySettings();
    setMemories(getMemoriesWithImportance(currentSettings.decayRate));
    setStats(getMemoryStatsEnhanced(currentSettings.decayRate));
    setCleanupPreviewCount(getCleanupPreviewCount());
  };

  const checkEmbeddingProvider = () => {
    const activeProviders = getActiveProviders();
    // 检查是否有 OpenAI 或支持 embedding 的提供商
    const hasProvider = activeProviders.some((p) => 
      p.id === 'openai' || p.baseUrl?.includes('openai') || p.id.startsWith('custom-')
    );
    setHasEmbeddingProvider(hasProvider);
  };

  // 更新设置
  const updateSettings = (updates: Partial<MemorySettingsType>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveMemorySettings(newSettings);
  };

  // 添加记忆
  const handleAddMemory = () => {
    if (!newMemoryContent.trim()) return;
    addMemory(newMemoryContent.trim(), 'manual');
    setNewMemoryContent('');
    loadData();
  };

  // 删除记忆
  const handleDeleteMemory = (id: string) => {
    deleteMemory(id);
    loadData();
  };

  // 更新记忆
  const handleUpdateMemory = (id: string, content: string) => {
    updateMemory(id, content);
    loadData();
  };

  // 清空所有记忆
  const handleClearAll = () => {
    if (window.confirm('确定要清空所有记忆吗？此操作不可撤销。')) {
      clearAllMemories();
      loadData();
    }
  };

  // 搜索记忆
  const handleSearch = () => {
    setIsSearching(true);
    const results = searchMemories(searchQuery);
    // 为搜索结果添加重要性分数
    const resultsWithImportance = results.map((m) => {
      const found = memories.find((mem) => mem.id === m.id);
      return {
        ...m,
        currentImportance: found?.currentImportance ?? 50,
      };
    });
    setMemories(resultsWithImportance);
    setIsSearching(false);
  };

  // 刷新记忆列表
  const handleRefresh = () => {
    setSearchQuery('');
    loadData();
  };

  // 切换记忆固定状态
  const handleTogglePin = (id: string) => {
    toggleMemoryPinned(id);
    loadData();
  };

  // 执行智能清理
  const handleSmartCleanup = () => {
    if (cleanupPreviewCount === 0) return;
    
    if (!window.confirm(`确定要清理 ${cleanupPreviewCount} 条低重要性记忆吗？`)) {
      return;
    }
    
    setIsCleaningUp(true);
    setCleanupResult(null);
    
    try {
      const result = performSmartCleanup();
      setCleanupResult(result.reason);
      loadData();
      
      // 3秒后清除结果提示
      setTimeout(() => setCleanupResult(null), 3000);
    } catch (error) {
      setCleanupResult('清理失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsCleaningUp(false);
    }
  };

  // 获取可用的工具模型选项
  const getToolModelOptions = () => {
    const options: { value: string; label: string }[] = [
      { value: '', label: '使用默认工具模型' },
    ];
    
    const activeProviders = getActiveProviders();
    activeProviders.forEach((provider) => {
      provider.models
        .filter((m) => m.enabled)
        .forEach((model) => {
          options.push({
            value: `${provider.id}:${model.id}`,
            label: `${model.id} (${provider.name})`,
          });
        });
    });
    
    return options;
  };

  // 获取嵌入模型选项
  const getEmbeddingModelOptions = () => {
    const options: { value: string; label: string }[] = [
      { value: '', label: '使用默认（OpenAI text-embedding-3-small）' },
    ];

    EMBEDDING_PROVIDERS.forEach((provider) => {
      options.push({
        value: `${provider.id}:${provider.model}`,
        label: `${provider.name} · ${provider.model}`,
      });
    });

    return options;
  };

  return (
    <div className="space-y-6 pb-6">
      {/* 记忆功能 */}
      <SettingsCard>
        <h3 className="text-lg font-semibold mb-4">记忆功能</h3>
        <div className="flex items-start gap-3">
          <Checkbox
            checked={settings.enabled}
            onChange={(checked) => updateSettings({ enabled: checked })}
          />
          <div className="flex-1">
            <Label htmlFor="enableMemory" className="font-medium cursor-pointer">
              启用记忆
            </Label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              启用后，AI 将记住您对话中的重要信息，并使用这些信息提供更个性化的回复。
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* 记忆检索 */}
      <SettingsCard>
        <h3 className="text-lg font-semibold mb-4">记忆检索</h3>
        <div className="space-y-5">
          {/* 自动检索记忆 */}
          <div className="flex items-start gap-3">
            <Checkbox
              checked={settings.autoRetrieve}
              onChange={(checked) => updateSettings({ autoRetrieve: checked })}
              disabled={!settings.enabled}
            />
            <div className="flex-1">
              <Label htmlFor="autoRetrieve" className="font-medium cursor-pointer">
                自动检索记忆
              </Label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                在每次对话前自动搜索并注入相关记忆以提供上下文。
              </p>
            </div>
          </div>

          {/* 查询重写 */}
          {settings.autoRetrieve && (
            <div className="flex items-start gap-3 ml-8">
              <Checkbox
                checked={settings.queryRewriting}
                onChange={(checked) => updateSettings({ queryRewriting: checked })}
                disabled={!settings.enabled}
              />
              <div className="flex-1">
                <Label htmlFor="queryRewriting" className="font-medium cursor-pointer">
                  查询重写
                </Label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  使用工具模型优化你的消息再进行记忆搜索。这会将对话式查询转换为语义搜索词，以获得更好的匹配效果。
                </p>
              </div>
            </div>
          )}

          {/* 最大检索记忆数 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>最大检索记忆数: {settings.maxRetrieveCount}</Label>
            </div>
            <Slider
              min={1}
              max={20}
              step={1}
              value={settings.maxRetrieveCount}
              onValueChange={(value) => updateSettings({ maxRetrieveCount: value })}
              disabled={!settings.enabled}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              注入对话上下文的相关记忆最大数量（1-20）。
            </p>
          </div>

          {/* 相似度阈值 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>相似度阈值: {settings.similarityThreshold}%</Label>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={settings.similarityThreshold}
              onValueChange={(value) => updateSettings({ similarityThreshold: value })}
              disabled={!settings.enabled}
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>宽松 (0%)</span>
              <span>严格 (100%)</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              检索记忆所需的最低相似度分数。值越高，匹配越严格。
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* 记忆总结 */}
      <SettingsCard>
        <h3 className="text-lg font-semibold mb-4">记忆总结</h3>
        <div className="flex items-start gap-3">
          <Checkbox
            checked={settings.autoSummarize}
            onChange={(checked) => updateSettings({ autoSummarize: checked })}
            disabled={!settings.enabled}
          />
          <div className="flex-1">
            <Label htmlFor="autoSummarize" className="font-medium cursor-pointer">
              自动总结对话
            </Label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              自动从对话中提取并存储重要信息作为新记忆。
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* 记忆工具模型 */}
      <SettingsCard>
        <h3 className="text-lg font-semibold mb-4">记忆工具模型</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          为记忆操作指定专用工具模型。留空则使用通用工具模型。
        </p>
        <Select
          value={settings.toolModel}
          onChange={(value) => updateSettings({ toolModel: value })}
          options={getToolModelOptions()}
          placeholder="使用默认工具模型"
        />
      </SettingsCard>

      {/* 嵌入模型 */}
      <SettingsCard>
        <h3 className="text-lg font-semibold mb-4">嵌入模型</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          用于语义搜索的嵌入模型。留空则使用默认值（text-embedding-3-small）。
        </p>
        <Select
          value={settings.embeddingModel}
          onChange={(value) => updateSettings({ embeddingModel: value })}
          options={getEmbeddingModelOptions()}
          placeholder="text-embedding-3-small (默认)"
        />
      </SettingsCard>

      {/* 统计 */}
      <SettingsCard>
        <h3 className="text-lg font-semibold mb-4">统计</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">记忆总数</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.auto}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">自动生成</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
            <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.manual}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">手动添加</div>
          </div>
          <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pinned}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">已固定</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.avgImportance}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">平均重要性</div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-xl font-bold text-red-600 dark:text-red-400">{stats.belowThreshold}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">即将遗忘</div>
          </div>
        </div>
      </SettingsCard>

      {/* 智能遗忘设置 */}
      <SettingsCard>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold">智能遗忘</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          模拟人类记忆的遗忘机制，自动清理不重要的记忆，保持记忆库的清晰和相关性。
        </p>
        
        <div className="space-y-5">
          {/* 启用智能遗忘 */}
          <div className="flex items-start gap-3">
            <Checkbox
              checked={settings.forgettingEnabled}
              onChange={(checked) => updateSettings({ forgettingEnabled: checked })}
            />
            <div className="flex-1">
              <Label htmlFor="forgettingEnabled" className="font-medium cursor-pointer">
                启用智能遗忘
              </Label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                开启后，系统会根据重要性评分自动清理记忆。
              </p>
            </div>
          </div>

          {settings.forgettingEnabled && (
            <>
              {/* 最大记忆数量 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>最大记忆数量: {settings.maxMemoryCount}</Label>
                </div>
                <Slider
                  min={10}
                  max={500}
                  step={10}
                  value={settings.maxMemoryCount}
                  onValueChange={(value) => updateSettings({ maxMemoryCount: value })}
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  记忆数量超过此限制时，将清理最低重要性的记忆。
                </p>
              </div>

              {/* 重要性阈值 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>重要性阈值: {settings.importanceThreshold}</Label>
                </div>
                <Slider
                  min={0}
                  max={50}
                  step={5}
                  value={settings.importanceThreshold}
                  onValueChange={(value) => updateSettings({ importanceThreshold: value })}
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  重要性分数低于此阈值的记忆将被自动清理（固定的记忆除外）。
                </p>
              </div>

              {/* 衰减速率 */}
              <div className="space-y-2">
                <Label>衰减速率</Label>
                <Select
                  value={settings.decayRate}
                  onChange={(value) => updateSettings({ decayRate: value as DecayRate })}
                  options={[
                    { value: 'slow', label: '慢速 - 每天衰减 0.5%' },
                    { value: 'normal', label: '正常 - 每天衰减 2%' },
                    { value: 'fast', label: '快速 - 每天衰减 5%' },
                  ]}
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  记忆重要性随时间下降的速度。被访问的记忆会刷新重要性。
                </p>
              </div>

              {/* 清理频率 */}
              <div className="space-y-2">
                <Label>清理频率</Label>
                <Select
                  value={settings.cleanupFrequency}
                  onChange={(value) => updateSettings({ cleanupFrequency: value as 'after_chat' | 'daily' | 'manual' })}
                  options={[
                    { value: 'after_chat', label: '每次对话后' },
                    { value: 'daily', label: '每天一次' },
                    { value: 'manual', label: '仅手动清理' },
                  ]}
                />
              </div>

              {/* 立即清理按钮 */}
              <div className="pt-2 border-t border-gray-200 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      待清理记忆: {cleanupPreviewCount} 条
                    </p>
                    {cleanupResult && (
                      <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                        {cleanupResult}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSmartCleanup}
                    disabled={cleanupPreviewCount === 0 || isCleaningUp}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {isCleaningUp ? '清理中...' : '立即清理'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SettingsCard>

      {/* 添加记忆 */}
      <SettingsCard>
        <h3 className="text-lg font-semibold mb-4">添加记忆</h3>
        <textarea
          value={newMemoryContent}
          onChange={(e) => setNewMemoryContent(e.target.value)}
          placeholder="输入您希望 AI 记住的内容..."
          className="w-full px-3 py-3 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[100px]"
          rows={4}
        />
        <Button
          onClick={handleAddMemory}
          disabled={!newMemoryContent.trim()}
          className="w-full mt-3 bg-teal-600/20 hover:bg-teal-600/30 text-teal-600 dark:text-teal-400 border border-teal-600/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加记忆
        </Button>
      </SettingsCard>

      {/* 搜索记忆 */}
      <SettingsCard>
        <h3 className="text-lg font-semibold mb-4">搜索记忆</h3>
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="按语义相似度搜索..."
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4"
          >
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </SettingsCard>

      {/* 记忆列表 */}
      <SettingsCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">记忆列表</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={memories.length === 0}
              className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              清空全部
            </Button>
          </div>
        </div>

        {memories.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              暂无记忆。记忆会从您的对话中自动创建，或者您可以手动添加。
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {memories.map((memory) => (
              <MemoryItem
                key={memory.id}
                memory={memory}
                currentImportance={memory.currentImportance}
                threshold={settings.importanceThreshold}
                onDelete={() => handleDeleteMemory(memory.id)}
                onUpdate={(content) => handleUpdateMemory(memory.id, content)}
                onTogglePin={() => handleTogglePin(memory.id)}
              />
            ))}
          </div>
        )}
      </SettingsCard>

      {/* 使用要求警告 */}
      {!hasEmbeddingProvider && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-700 dark:text-amber-400">使用要求</h4>
              <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                记忆功能需要配置一个带有 API Key 的 OpenAI 提供商来生成嵌入向量。请确保您已设置至少一个 OpenAI 提供商。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
