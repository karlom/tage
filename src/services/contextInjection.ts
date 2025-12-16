// 上下文注入服务 - RAG 相关功能
import {
  getMemorySettings,
  getMemories,
  addMemory,
  getGeneralSettings,
  type Memory,
  type Message,
  recordMemoriesAccess,
} from './storage';
import {
  generateEmbedding,
  cosineSimilarity,
} from './embedding';

// 检索到的记忆结果
export interface RetrievedMemory {
  id: string;
  content: string;
  similarity: number;
  source: 'auto' | 'manual';
}

// 上下文构建结果
export interface ContextBuildResult {
  systemPrompt: string;
  retrievedMemories: RetrievedMemory[];
  originalQuery: string;
  rewrittenQuery?: string;
}

// 根据用户消息构建带记忆的上下文
export async function buildContextWithMemories(
  userMessage: string,
  existingSystemPrompt?: string
): Promise<ContextBuildResult> {
  const settings = getMemorySettings();

  // 如果记忆功能未启用，返回原始提示
  if (!settings.enabled || !settings.autoRetrieve) {
    return {
      systemPrompt: existingSystemPrompt || '',
      retrievedMemories: [],
      originalQuery: userMessage,
    };
  }

  // 查询重写（如果启用）
  let searchQuery = userMessage;
  let rewrittenQuery: string | undefined;

  if (settings.queryRewriting) {
    try {
      rewrittenQuery = await rewriteQuery(userMessage);
      if (rewrittenQuery && rewrittenQuery !== userMessage) {
        searchQuery = rewrittenQuery;
      }
    } catch (error) {
      console.error('Query rewriting failed:', error);
      // 继续使用原始查询
    }
  }

  // 检索相关记忆
  const retrievedMemories = await retrieveRelevantMemories(
    searchQuery,
    settings.maxRetrieveCount,
    settings.similarityThreshold / 100 // 转换为 0-1 范围
  );

  // 记录记忆被访问
  if (retrievedMemories.length > 0) {
    recordMemoriesAccess(retrievedMemories.map((m) => m.id));
  }

  // 构建包含记忆的系统提示
  let systemPrompt = existingSystemPrompt || '';

  if (retrievedMemories.length > 0) {
    const memoryContext = retrievedMemories
      .map((m, i) => `[记忆${i + 1}] ${m.content}`)
      .join('\n');

    const memorySection = `
## 用户相关记忆

以下是关于该用户的重要信息，请在回答时务必参考这些记忆：

${memoryContext}

---
`;

    systemPrompt = memorySection + systemPrompt;
  }

  return {
    systemPrompt,
    retrievedMemories,
    originalQuery: userMessage,
    rewrittenQuery,
  };
}

// 检索相关记忆
async function retrieveRelevantMemories(
  query: string,
  maxCount: number,
  threshold: number
): Promise<RetrievedMemory[]> {
  const memories = getMemories();

  // 如果没有记忆，返回空数组
  if (memories.length === 0) {
    return [];
  }

  // 检查是否有嵌入向量
  const memoriesWithEmbedding = memories.filter((m) => m.embedding && m.embedding.length > 0);

  let results: RetrievedMemory[] = [];

  if (memoriesWithEmbedding.length === 0) {
    // 没有嵌入向量，使用简单的关键词匹配
    results = simpleKeywordSearch(query, memories, maxCount);
  } else {
    // 生成查询嵌入
    const queryEmbedding = await generateEmbedding(query);

    if (!queryEmbedding) {
      // 嵌入生成失败，回退到关键词搜索
      results = simpleKeywordSearch(query, memories, maxCount);
    } else {
      // 计算相似度并排序
      for (const memory of memoriesWithEmbedding) {
        const similarity = cosineSimilarity(queryEmbedding, memory.embedding!);

        if (similarity >= threshold) {
          results.push({
            id: memory.id,
            content: memory.content,
            similarity,
            source: memory.source,
          });
        }
      }

      // 按相似度降序排序
      results.sort((a, b) => b.similarity - a.similarity);
      results = results.slice(0, maxCount);
    }
  }

  // 如果没有找到匹配的记忆，返回最新的几条记忆作为上下文
  // 这确保了AI始终能够访问到用户的关键信息
  if (results.length === 0 && memories.length > 0) {
    // 按创建时间降序排序，返回最新的记忆
    const recentMemories = [...memories]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.min(maxCount, 3)); // 最多返回3条最新记忆

    results = recentMemories.map((m) => ({
      id: m.id,
      content: m.content,
      similarity: 0.5, // 给一个中等的相似度分数
      source: m.source,
    }));
  }

  return results;
}

// 简单关键词搜索（备用方案）
function simpleKeywordSearch(
  query: string,
  memories: Memory[],
  maxCount: number
): RetrievedMemory[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 1);

  if (queryWords.length === 0) {
    return [];
  }

  const results: { memory: Memory; score: number }[] = [];

  for (const memory of memories) {
    const contentLower = memory.content.toLowerCase();
    let score = 0;

    // 计算匹配分数
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        score += 1;
      }
    }

    // 完全匹配加分
    if (contentLower.includes(queryLower)) {
      score += 2;
    }

    if (score > 0) {
      results.push({ memory, score });
    }
  }

  // 按分数排序
  results.sort((a, b) => b.score - a.score);

  // 转换为 RetrievedMemory 格式
  return results.slice(0, maxCount).map((r) => ({
    id: r.memory.id,
    content: r.memory.content,
    similarity: r.score / (queryWords.length + 2), // 归一化分数
    source: r.memory.source,
  }));
}

// 查询重写 - 使用工具模型优化搜索词
async function rewriteQuery(userMessage: string): Promise<string> {
  const memorySettings = getMemorySettings();
  const generalSettings = getGeneralSettings();

  // 优先使用记忆设置中的工具模型，如果没有配置则回退到通用设置
  const toolModelConfig = memorySettings.toolModel || generalSettings.toolModel;

  // 如果没有配置工具模型，使用原始查询
  if (!toolModelConfig) {
    return userMessage;
  }

  // 解析工具模型配置
  const [providerId, modelId] = toolModelConfig.split(':');

  if (!providerId || !modelId) {
    return userMessage;
  }

  try {
    // 动态导入 deepseek 服务以避免循环依赖
    const { chatCompletion } = await import('./deepseek');

    const prompt = `请从以下用户消息中提取核心概念和关键词，用于语义搜索。只返回优化后的搜索词，不要解释。

用户消息：${userMessage}

优化后的搜索词：`;

    const response = await chatCompletion(
      [{ id: '1', role: 'user', content: prompt, timestamp: Date.now() }],
      { model: modelId, providerId, max_tokens: 100 }
    );

    const rewritten = response.trim();

    // 如果重写后的查询为空或太长，使用原始查询
    if (!rewritten || rewritten.length > userMessage.length * 2) {
      return userMessage;
    }

    return rewritten;
  } catch (error) {
    console.error('Query rewriting failed:', error);
    return userMessage;
  }
}

// 从对话中自动提取记忆
export async function extractAndSaveMemories(
  messages: Message[]
): Promise<Memory[]> {
  const settings = getMemorySettings();

  // 如果自动总结未启用，不提取记忆
  if (!settings.enabled || !settings.autoSummarize) {
    return [];
  }

  const generalSettings = getGeneralSettings();

  // 优先使用记忆设置中的工具模型，如果没有配置则回退到通用设置
  const toolModelConfig = settings.toolModel || generalSettings.toolModel;

  // 如果没有配置工具模型，跳过提取
  if (!toolModelConfig) {
    console.warn('Memory extraction skipped: No tool model configured in Memory or General settings');
    return [];
  }

  // 解析工具模型配置
  const [providerId, modelId] = toolModelConfig.split(':');

  if (!providerId || !modelId) {
    return [];
  }

  // 只处理有实际内容的对话
  if (messages.length < 2) {
    return [];
  }

  try {
    // 动态导入 deepseek 服务
    const { chatCompletion } = await import('./deepseek');

    // 格式化消息
    const formattedMessages = messages
      .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.slice(0, 500)}`)
      .join('\n');

    const prompt = `从以下对话中提取值得记住的重要信息（用户偏好、事实、决定、关键结论等）。每条信息一行，简洁明了。如果没有值得记住的信息，返回"无"。

对话内容：
${formattedMessages}

重要信息：`;

    const response = await chatCompletion(
      [{ id: '1', role: 'user', content: prompt, timestamp: Date.now() }],
      { model: modelId, providerId, max_tokens: 500 }
    );

    const extractedInfo = response.trim();

    // 如果没有提取到有价值的信息，返回空
    if (!extractedInfo || extractedInfo === '无' || extractedInfo.length < 5) {
      return [];
    }

    // 解析提取的信息并保存为记忆
    const savedMemories: Memory[] = [];
    const lines = extractedInfo.split('\n').filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 5 && trimmed !== '无';
    });

    for (const line of lines) {
      // 移除行号前缀（如 "1. " 或 "- "）
      const content = line.replace(/^[\d\-\.\)]+\s*/, '').trim();

      if (content.length > 5) {
        const memory = addMemory(content, 'auto');

        // 异步生成嵌入向量
        generateEmbedding(content).then((embedding) => {
          if (embedding) {
            // 更新记忆的嵌入向量（需要扩展 updateMemory 函数）
            updateMemoryEmbedding(memory.id, embedding);
          }
        });

        savedMemories.push(memory);
      }
    }

    return savedMemories;
  } catch (error) {
    console.error('Memory extraction failed:', error);
    return [];
  }
}

// 更新记忆的嵌入向量
function updateMemoryEmbedding(id: string, embedding: number[]): void {
  const memories = getMemories();
  const index = memories.findIndex((m) => m.id === id);

  if (index !== -1) {
    memories[index] = {
      ...memories[index],
      embedding,
      updatedAt: Date.now(),
    };

    // 直接保存（需要从 storage 导入 saveMemories）
    import('./storage').then(({ saveMemories }) => {
      saveMemories(memories);
    });
  }
}

// 为现有记忆生成嵌入向量
export async function generateEmbeddingsForMemories(): Promise<{
  total: number;
  updated: number;
  failed: number;
}> {
  const memories = getMemories();
  let updated = 0;
  let failed = 0;

  for (const memory of memories) {
    // 跳过已有嵌入的记忆
    if (memory.embedding && memory.embedding.length > 0) {
      continue;
    }

    const embedding = await generateEmbedding(memory.content);

    if (embedding) {
      updateMemoryEmbedding(memory.id, embedding);
      updated++;
    } else {
      failed++;
    }

    // 添加延迟以避免 API 限流
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return {
    total: memories.length,
    updated,
    failed,
  };
}
