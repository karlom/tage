// 嵌入服务 - 支持多提供商的向量嵌入生成
import {
  getMemorySettings,
  getMemories,
  updateMemoryEmbedding,
  type Memory,
  getProviderById,
  getActiveProviders,
} from './storage';

// 嵌入模型提供商配置
export interface EmbeddingProvider {
  id: string;
  name: string;
  apiUrl: string;
  model: string;
  dimensions: number;
}

// 预设的嵌入模型提供商（优先国内服务商）
export const EMBEDDING_PROVIDERS: EmbeddingProvider[] = [
  {
    id: 'siliconflow',
    name: '硅基流动',
    apiUrl: 'https://api.siliconflow.cn/v1/embeddings',
    model: 'BAAI/bge-m3',
    dimensions: 1024,
  },
  {
    id: 'qwen',
    name: '通义千问',
    apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
    model: 'text-embedding-v2',
    dimensions: 1536,
  },
  {
    id: 'doubao',
    name: '豆包',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/embeddings',
    model: 'doubao-embedding',
    dimensions: 1024,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/embeddings',
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
];

// 嵌入配置接口
export interface EmbeddingConfig {
  providerId: string;
  apiKey: string;
  model: string;
  apiUrl?: string;
}

// 获取嵌入配置（从记忆设置中读取）
export function getEmbeddingConfig(): EmbeddingConfig | null {
  const memorySettings = getMemorySettings();
  const rawValue = memorySettings.embeddingModel;

  const DEFAULT_PROVIDER_ID = 'openai';
  const defaultProviderEntry = EMBEDDING_PROVIDERS.find((p) => p.id === DEFAULT_PROVIDER_ID);
  const defaultModel = defaultProviderEntry?.model || 'text-embedding-3-small';

  // 解析值：支持 "providerId:model" 或仅模型名（默认 openai）
  let providerId = DEFAULT_PROVIDER_ID;
  let model = rawValue || defaultModel;

  if (rawValue && rawValue.includes(':')) {
    const parts = rawValue.split(':');
    providerId = parts[0] || DEFAULT_PROVIDER_ID;
    model = parts.slice(1).join(':') || model;
  }

  // 优先使用用户配置的提供商；如果未配置则尝试默认 openai；最后尝试第一个已启用的提供商
  const preferredProvider = getProviderById(providerId);
  const fallbackProvider =
    providerId === DEFAULT_PROVIDER_ID ? null : getProviderById(DEFAULT_PROVIDER_ID);
  const anyActiveProvider = getActiveProviders()[0];
  const resolvedProvider = preferredProvider || fallbackProvider || anyActiveProvider;

  if (!resolvedProvider || !resolvedProvider.apiKey) {
    return null;
  }

  // API URL 优先使用预设表；如果没有则尝试 provider.baseUrl 拼装 /embeddings
  const presetProvider = EMBEDDING_PROVIDERS.find((p) => p.id === resolvedProvider.id);
  const apiUrl =
    presetProvider?.apiUrl ||
    (resolvedProvider.baseUrl
      ? `${resolvedProvider.baseUrl.replace(/\/+$/, '')}/embeddings`
      : undefined);

  if (!apiUrl) {
    console.warn(`No embedding API URL for provider ${resolvedProvider.id}`);
    return null;
  }

  return {
    providerId: resolvedProvider.id,
    apiKey: resolvedProvider.apiKey,
    model,
    apiUrl,
  };
}

// 获取指定提供商的配置
export function getEmbeddingProvider(providerId: string): EmbeddingProvider | null {
  return EMBEDDING_PROVIDERS.find((p) => p.id === providerId) || null;
}

// 调用嵌入 API 生成向量
export async function generateEmbedding(
  text: string,
  config?: EmbeddingConfig
): Promise<number[] | null> {
  const embeddingConfig = config || getEmbeddingConfig();
  if (!embeddingConfig) {
    console.warn('No embedding configuration found');
    return null;
  }

  const provider = getEmbeddingProvider(embeddingConfig.providerId);
  if (!provider) {
    console.warn(`Unknown embedding provider: ${embeddingConfig.providerId}`);
    return null;
  }

  try {
    // 根据不同提供商构建请求
    const response = await callEmbeddingApi(
      provider,
      embeddingConfig.apiKey,
      text,
      embeddingConfig.model,
      embeddingConfig.apiUrl
    );
    return response;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    return null;
  }
}

// 调用嵌入 API
async function callEmbeddingApi(
  provider: EmbeddingProvider,
  apiKey: string,
  text: string,
  modelOverride?: string,
  apiUrlOverride?: string
): Promise<number[]> {
  const apiUrl = apiUrlOverride || provider.apiUrl;
  const model = modelOverride || provider.model;

  // 通义千问使用不同的请求格式
  if (provider.id === 'qwen') {
    return callQwenEmbeddingApi(
      { ...provider, model, apiUrl },
      apiKey,
      text
    );
  }

  // OpenAI 兼容格式（硅基流动、豆包、OpenAI）
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // 提取嵌入向量
  if (data.data && data.data[0] && data.data[0].embedding) {
    return data.data[0].embedding;
  }

  throw new Error('Invalid embedding API response format');
}

// 通义千问嵌入 API（使用不同的请求格式）
async function callQwenEmbeddingApi(
  provider: EmbeddingProvider,
  apiKey: string,
  text: string
): Promise<number[]> {
  const response = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      input: {
        texts: [text],
      },
      parameters: {
        text_type: 'query',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen Embedding API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // 通义千问返回格式
  if (data.output && data.output.embeddings && data.output.embeddings[0]) {
    return data.output.embeddings[0].embedding;
  }

  throw new Error('Invalid Qwen embedding API response format');
}

// 批量生成嵌入向量
export async function generateEmbeddings(
  texts: string[],
  config?: EmbeddingConfig
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];

  for (const text of texts) {
    const embedding = await generateEmbedding(text, config);
    results.push(embedding);
  }

  return results;
}

// 计算余弦相似度
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    console.warn('Vector dimensions do not match');
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// 搜索结果接口
export interface SemanticSearchResult {
  id: string;
  content: string;
  similarity: number;
}

// 语义搜索记忆
export async function searchMemoriesSemantic(
  query: string,
  memories: Array<{ id: string; content: string; embedding?: number[] }>,
  options?: {
    topK?: number;
    threshold?: number;
  }
): Promise<SemanticSearchResult[]> {
  const { topK = 5, threshold = 0.5 } = options || {};

  // 生成查询向量
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    console.warn('Failed to generate query embedding, falling back to empty results');
    return [];
  }

  // 计算相似度并排序
  const results: SemanticSearchResult[] = [];

  for (const memory of memories) {
    if (!memory.embedding) {
      continue;
    }

    const similarity = cosineSimilarity(queryEmbedding, memory.embedding);

    if (similarity >= threshold) {
      results.push({
        id: memory.id,
        content: memory.content,
        similarity,
      });
    }
  }

  // 按相似度降序排序
  results.sort((a, b) => b.similarity - a.similarity);

  // 返回 Top K 结果
  return results.slice(0, topK);
}

// 为记忆生成嵌入（懒加载：如果没有的话）
export async function ensureMemoryEmbeddings(): Promise<Memory[]> {
  const memories = getMemories();
  const needsEmbedding = memories.filter((m) => !m.embedding);

  if (needsEmbedding.length === 0) {
    return memories;
  }

  console.log(`Generating embeddings for ${needsEmbedding.length} memories...`);

  // 批量生成嵌入
  for (const memory of needsEmbedding) {
    try {
      const embedding = await generateEmbedding(memory.content);
      if (embedding) {
        // 更新记忆的嵌入
        updateMemoryEmbedding(memory.id, embedding);
        console.log(`Embedding generated for memory: ${memory.id.slice(0, 8)}...`);
      }
    } catch (error) {
      console.error(`Failed to generate embedding for memory ${memory.id}:`, error);
    }
  }

  // 返回更新后的记忆列表
  return getMemories();
}

// 带懒加载的语义搜索
export async function searchMemoriesWithLazyEmbedding(
  query: string,
  options?: {
    topK?: number;
    threshold?: number;
  }
): Promise<SemanticSearchResult[]> {
  const { topK = 5, threshold = 0.5 } = options || {};

  // 懒加载：确保所有记忆都有嵌入
  await ensureMemoryEmbeddings();

  // 生成查询嵌入
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    console.warn('Failed to generate query embedding, falling back to keyword search');
    // 回退到关键词搜索
    return searchMemoriesKeyword(query, topK);
  }

  // 重新加载（可能已更新嵌入）
  const memories = getMemories();

  // 计算相似度并排序
  const results: SemanticSearchResult[] = [];

  for (const memory of memories) {
    if (!memory.embedding) {
      continue;
    }

    const similarity = cosineSimilarity(queryEmbedding, memory.embedding);

    if (similarity >= threshold) {
      results.push({
        id: memory.id,
        content: memory.content,
        similarity,
      });
    }
  }

  // 按相似度降序排序
  results.sort((a, b) => b.similarity - a.similarity);

  // 返回 Top K 结果
  return results.slice(0, topK);
}

// 关键词搜索（作为语义搜索的回退）
export function searchMemoriesKeyword(
  query: string,
  topK: number = 5
): SemanticSearchResult[] {
  const memories = getMemories();
  const lowerQuery = query.toLowerCase();

  const results: SemanticSearchResult[] = memories
    .filter((m) => m.content.toLowerCase().includes(lowerQuery))
    .map((m) => ({
      id: m.id,
      content: m.content,
      similarity: 0.5, // 关键词匹配给一个默认相似度
    }))
    .slice(0, topK);

  return results;
}
