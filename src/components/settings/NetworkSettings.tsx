import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import {
  getSearchApiConfig,
  saveSearchApiConfig,
  type SearchApiConfig,
  type SearchApiProvider
} from '@/services/storage';

export default function NetworkSettings() {
  const [config, setConfig] = useState<SearchApiConfig>(getSearchApiConfig());
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const currentConfig = getSearchApiConfig();
    setConfig(currentConfig);
  }, []);

  const handleProviderChange = (provider: SearchApiProvider) => {
    const newConfig = { ...config, provider, searchEngineId: provider === 'google' ? config.searchEngineId : undefined };
    setConfig(newConfig);
    saveSearchApiConfig(newConfig);
  };

  const handleApiKeyChange = (apiKey: string) => {
    const newConfig = { ...config, apiKey };
    setConfig(newConfig);
    saveSearchApiConfig(newConfig);
  };

  const handleSearchEngineIdChange = (searchEngineId: string) => {
    const newConfig = { ...config, searchEngineId };
    setConfig(newConfig);
    saveSearchApiConfig(newConfig);
  };

  const handleEnabledChange = (enabled: boolean) => {
    const newConfig = { ...config, enabled };
    setConfig(newConfig);
    saveSearchApiConfig(newConfig);
  };

  const getProviderInfo = (provider: SearchApiProvider) => {
    switch (provider) {
      case 'serpapi':
        return {
          name: 'SerpAPI',
          freeTier: '100 次/月',
          pricing: '$50/月起 (5,000 次)',
          url: 'https://serpapi.com/pricing',
        };
      case 'brave':
        return {
          name: 'Brave Search API',
          freeTier: '2,000 次/月',
          pricing: '付费计划请查看官网',
          url: 'https://brave.com/search/api',
        };
      case 'google':
        return {
          name: 'Google Custom Search API',
          freeTier: '100 次/天 (约 3,000 次/月)',
          pricing: '$5/1,000 次',
          url: 'https://developers.google.com/custom-search/v1/overview',
        };
      case 'tavily':
        return {
          name: 'Tavily Search API',
          freeTier: '1,000 次/月 (推荐⭐)',
          pricing: '$0.008/次 按量付费',
          url: 'https://tavily.com',
        };
      default:
        return null;
    }
  };

  const providerInfo = getProviderInfo(config.provider);

  return (
    <div className="space-y-6">
      {/* 网络设置 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">网络设置</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proxy">代理服务器</Label>
            <Input
              id="proxy"
              placeholder="http://proxy.example.com:8080"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              可选：设置 HTTP/HTTPS 代理服务器
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="verifySSL">验证 SSL 证书</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                验证 HTTPS 连接的 SSL 证书
              </p>
            </div>
            <Switch id="verifySSL" defaultChecked />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout">请求超时时间（秒）</Label>
            <Input
              id="timeout"
              type="number"
              defaultValue={30}
              min={5}
              max={300}
            />
          </div>
        </div>
      </div>

      {/* 搜索 API 配置 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">搜索 API 配置</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="searchProvider">搜索提供商</Label>
            <Select
              id="searchProvider"
              value={config.provider}
              onChange={(e) => handleProviderChange(e.target.value as SearchApiProvider)}
            >
              <option value="none">不使用搜索 API</option>
              <option value="tavily">Tavily Search API (推荐)</option>
              <option value="serpapi">SerpAPI</option>
              <option value="brave">Brave Search API</option>
              <option value="google">Google Custom Search API</option>
            </Select>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              选择用于网络搜索的 API 提供商
            </p>
          </div>

          {config.provider !== 'none' && providerInfo && (
            <>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                      {providerInfo.name} 定价信息
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      免费额度：{providerInfo.freeTier}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      付费：{providerInfo.pricing}
                    </p>
                    <a
                      href={providerInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                    >
                      查看详情
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="searchApiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="searchApiKey"
                    type={showApiKey ? 'text' : 'password'}
                    value={config.apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder={`输入 ${providerInfo.name} API Key`}
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
                  {config.provider === 'tavily' ? (
                    <>
                      在{' '}
                      <a
                        href="https://tavily.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        https://tavily.com
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {' '}注册并获取 API Key（免费 1,000 次/月）
                    </>
                  ) : config.provider === 'serpapi' ? (
                    <>
                      在{' '}
                      <a
                        href="https://serpapi.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        https://serpapi.com/dashboard
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {' '}获取 API Key
                    </>
                  ) : config.provider === 'brave' ? (
                    <>
                      在{' '}
                      <a
                        href="https://brave.com/search/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Brave Search API
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {' '}注册并获取 API Key
                    </>
                  ) : (
                    <>
                      在{' '}
                      <a
                        href="https://developers.google.com/custom-search/v1/overview"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Google Custom Search API
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {' '}获取 API Key 和创建 Custom Search Engine
                    </>
                  )}
                </p>
              </div>

              {/* Google Custom Search API 需要额外的 Search Engine ID */}
              {config.provider === 'google' && (
                <div className="space-y-2">
                  <Label htmlFor="searchEngineId">Custom Search Engine ID</Label>
                  <Input
                    id="searchEngineId"
                    type="text"
                    value={config.searchEngineId || ''}
                    onChange={(e) => handleSearchEngineIdChange(e.target.value)}
                    placeholder="输入 Custom Search Engine ID"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    在{' '}
                    <a
                      href="https://programmablesearchengine.google.com/controlpanel/create"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      Google Programmable Search Engine
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {' '}创建并获取 Search Engine ID
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="searchApiEnabled">启用搜索 API</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    启用后，网络搜索工具将使用配置的 API
                  </p>
                </div>
                <Switch
                  id="searchApiEnabled"
                  checked={config.enabled}
                  onChange={(e) => handleEnabledChange(e.target.checked)}
                />
              </div>
            </>
          )}

          {config.provider === 'none' && (
            <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                当前未配置搜索 API。网络搜索工具将返回提示信息，建议配置搜索 API 以启用完整的搜索功能。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
