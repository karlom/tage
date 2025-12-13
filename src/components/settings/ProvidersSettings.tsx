import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash2,
  Search,
  Eye,
  EyeOff,
  Download,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  getProviders,
  saveProviders,
  type Provider,
  type ModelCapabilities,
} from '@/services/storage';
import { updateProviderModels } from '@/services/deepseek';

// 提供商图标组件
const ProviderIcon = ({ id }: { id: string }) => {
  const iconClass = 'w-5 h-5';
  
  switch (id) {
    case 'deepseek':
      return <span className={`${iconClass} flex items-center justify-center text-blue-500`}>🔮</span>;
    case 'openai':
      return <span className={`${iconClass} flex items-center justify-center`}>⚡</span>;
    case 'anthropic':
      return <span className={`${iconClass} flex items-center justify-center text-orange-500`}>A</span>;
    case 'google':
      return <span className={`${iconClass} flex items-center justify-center text-blue-500`}>✦</span>;
    default:
      return <span className={`${iconClass} flex items-center justify-center text-purple-500`}>✧</span>;
  }
};

// 新增提供商弹窗组件
interface AddProviderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (provider: Omit<Provider, 'id' | 'enabled'>) => void;
}

function AddProviderDialog({ isOpen, onClose, onAdd }: AddProviderDialogProps) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('请输入提供商名称');
      return;
    }
    if (!baseUrl.trim()) {
      setError('请输入 Base URL');
      return;
    }
    
    onAdd({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      models: [],
    });
    
    // 重置表单
    setName('');
    setBaseUrl('');
    setApiKey('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setName('');
    setBaseUrl('');
    setApiKey('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-semibold mb-6">Add Custom Provider</h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-name">Provider Name</Label>
            <Input
              id="provider-name"
              placeholder="My Custom Provider"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              placeholder="https://api.example.com/v1"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setError('');
              }}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="your-api-key"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError('');
              }}
            />
          </div>
          
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-teal-600 hover:bg-teal-700 text-white">
            Add Provider
          </Button>
        </div>
      </div>
    </div>
  );
}


export default function ProvidersSettings() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 从存储加载配置
  useEffect(() => {
    const loadedProviders = getProviders();
    setProviders(loadedProviders);
    if (loadedProviders.length > 0 && !selectedProvider) {
      setSelectedProvider(loadedProviders[0].id);
    }
  }, []);

  const selected = providers.find((p) => p.id === selectedProvider);

  // 过滤提供商
  const filteredProviders = providers.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleProvider = (id: string) => {
    const newProviders = providers.map((p) =>
      p.id === id ? { ...p, enabled: !p.enabled } : p
    );
    setProviders(newProviders);
    saveProviders(newProviders);
  };

  const updateProvider = (id: string, updates: Partial<Provider>) => {
    const newProviders = providers.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    setProviders(newProviders);
    saveProviders(newProviders);
  };

  const addProvider = (providerData: Omit<Provider, 'id' | 'enabled'>) => {
    const newProvider: Provider = {
      id: `custom-${Date.now()}`,
      enabled: true,
      ...providerData,
    };
    const newProviders = [...providers, newProvider];
    setProviders(newProviders);
    setSelectedProvider(newProvider.id);
    saveProviders(newProviders);
  };

  const deleteProvider = (id: string) => {
    // 不允许删除内置提供商
    if (!id.startsWith('custom-')) {
      return;
    }
    const newProviders = providers.filter((p) => p.id !== id);
    setProviders(newProviders);
    if (selectedProvider === id) {
      setSelectedProvider(newProviders[0]?.id || null);
    }
    saveProviders(newProviders);
  };

  // 从 API 获取模型列表
  const fetchModels = async () => {
    if (!selected || !selected.apiKey) {
      setFetchError('请先配置 API Key');
      return;
    }

    setFetchingModels(true);
    setFetchError(null);

    try {
      const result = await updateProviderModels(selected.id);
      
      if (!result.success) {
        setFetchError(result.error || '获取模型列表失败');
      } else {
        // 重新加载提供商列表以获取更新后的数据
        const updatedProviders = getProviders();
        setProviders(updatedProviders);
      }
    } catch (error) {
      setFetchError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setFetchingModels(false);
    }
  };

  // API Key 变更时自动获取模型列表
  const handleApiKeyChange = async (apiKey: string) => {
    updateProvider(selected!.id, { apiKey });
    
    // 如果输入了有效的 API Key，自动获取模型列表
    if (apiKey && apiKey.length > 10) {
      // 延迟执行，等待状态更新
      setTimeout(async () => {
        setFetchingModels(true);
        setFetchError(null);
        try {
          const result = await updateProviderModels(selected!.id);
          if (!result.success) {
            console.log('Auto-fetch models failed:', result.error);
          } else {
            const updatedProviders = getProviders();
            setProviders(updatedProviders);
          }
        } catch (error) {
          console.error('Auto-fetch models error:', error);
        } finally {
          setFetchingModels(false);
        }
      }, 500);
    }
  };

  // 渲染模型能力标签
  const renderCapabilityBadges = (capabilities?: ModelCapabilities) => {
    if (!capabilities) return null;
    
    return (
      <div className="flex items-center gap-1 ml-2">
        {capabilities.reasoning && (
          <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded" title="推理能力">
            推理
          </span>
        )}
        {capabilities.functionCalling && (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded" title="工具调用">
            工具
          </span>
        )}
        {capabilities.vision && (
          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded" title="视觉识别">
            视觉
          </span>
        )}
      </div>
    );
  };

  const addModel = () => {
    if (!selected) return;
    updateProvider(selected.id, {
      models: [...selected.models, { id: '', enabled: false }],
    });
  };

  const updateModel = (index: number, value: string) => {
    if (!selected) return;
    const newModels = [...selected.models];
    newModels[index] = { ...newModels[index], id: value };
    updateProvider(selected.id, { models: newModels });
  };

  const deleteModel = (index: number) => {
    if (!selected) return;
    const newModels = selected.models.filter((_, i) => i !== index);
    updateProvider(selected.id, { models: newModels });
  };

  const toggleModelEnabled = (index: number, enabled: boolean) => {
    if (!selected) return;
    const newModels = [...selected.models];
    newModels[index] = { ...newModels[index], enabled };
    updateProvider(selected.id, { models: newModels });
  };

  const toggleAllModels = (enabled: boolean) => {
    if (!selected) return;
    const newModels = selected.models.map((m) => ({ ...m, enabled }));
    updateProvider(selected.id, { models: newModels });
  };

  const isCustomProvider = selected?.id.startsWith('custom-');

  return (
    <div className="h-full flex flex-col">
      {/* 标题和搜索栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索提供商..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          Add Custom Provider
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* 左侧提供商列表 */}
        <div className="w-64 flex-shrink-0 overflow-y-auto space-y-1">
          {filteredProviders.map((provider) => (
            <div
              key={provider.id}
              onClick={() => {
                setSelectedProvider(provider.id);
                setFetchError(null);
                setShowApiKey(false);
              }}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                selectedProvider === provider.id
                  ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800'
                  : 'hover:bg-gray-50 dark:hover:bg-zinc-800 border border-transparent'
              }`}
            >
              <ProviderIcon id={provider.id} />
              <span className="flex-1 font-medium truncate">{provider.name}</span>
              {provider.id.startsWith('custom-') && (
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-700 rounded text-gray-500 dark:text-gray-400">
                  CUSTOM
                </span>
              )}
              <div
                className={`w-2 h-2 rounded-full ${
                  provider.enabled && provider.apiKey
                    ? 'bg-blue-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            </div>
          ))}
        </div>

        {/* 右侧详情 */}
        {selected && (
          <div className="flex-1 overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6">
              {/* 提供商头部 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold">{selected.name}</h3>
                  {isCustomProvider && (
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-zinc-700 rounded text-gray-500 dark:text-gray-400">
                      CUSTOM
                    </span>
                  )}
                  {selected.enabled && selected.apiKey && (
                    <span className="text-xs px-2 py-1 bg-teal-100 dark:bg-teal-900 rounded text-teal-600 dark:text-teal-400">
                      Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {isCustomProvider && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteProvider(selected.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  )}
                  <Switch
                    checked={selected.enabled}
                    onChange={(e) => {
                      if (e.target.checked !== selected.enabled) {
                        toggleProvider(selected.id);
                      }
                    }}
                  />
                </div>
              </div>

              {/* URL 显示 */}
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {selected.baseUrl || 'No URL configured'}
              </div>

              <div className="space-y-6">
                {/* 提供商名称（仅自定义提供商） */}
                {isCustomProvider && (
                  <div className="space-y-2">
                    <Label>Provider Name</Label>
                    <Input
                      value={selected.name}
                      onChange={(e) => updateProvider(selected.id, { name: e.target.value })}
                      placeholder="My Custom Provider"
                    />
                  </div>
                )}

                {/* Base URL */}
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input
                    value={selected.baseUrl || ''}
                    onChange={(e) => updateProvider(selected.id, { baseUrl: e.target.value })}
                    placeholder="https://api.example.com/v1/chat/completions"
                  />
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={selected.apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="Enter your API key"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    输入 API Key 后将自动获取模型列表
                  </p>
                </div>

                {/* 模型列表 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Models</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchModels}
                      disabled={fetchingModels || !selected.apiKey}
                      className="gap-2"
                    >
                      {fetchingModels ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Fetch
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {selected.models.map((model, index) => (
                      <div 
                        key={index} 
                        className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                          model.enabled 
                            ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800' 
                            : 'bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={model.enabled}
                          onChange={(e) => toggleModelEnabled(index, e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                        <div className="flex-1 flex items-center">
                          <Input
                            placeholder="Model ID (e.g., gpt-4)"
                            value={model.id}
                            onChange={(e) => updateModel(index, e.target.value)}
                            className={`flex-1 ${!model.enabled ? 'opacity-60' : ''}`}
                          />
                          {renderCapabilityBadges(model.capabilities)}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteModel(index)}
                          className="text-gray-400 hover:text-red-500 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {selected.models.length > 0 && (
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
                      <span>
                        已启用 {selected.models.filter(m => m.enabled).length} / {selected.models.length} 个模型
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleAllModels(true)}
                          className="text-teal-600 hover:text-teal-700 hover:underline"
                        >
                          全部启用
                        </button>
                        <span>|</span>
                        <button
                          onClick={() => toggleAllModels(false)}
                          className="text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          全部禁用
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>Add models manually or use Fetch to load from API</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={addModel}
                      className="gap-1 text-gray-600 dark:text-gray-400"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </Button>
                  </div>

                  {/* 错误信息 */}
                  {fetchError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div className="text-sm break-all">{fetchError}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 新增提供商弹窗 */}
      <AddProviderDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={addProvider}
      />
    </div>
  );
}
