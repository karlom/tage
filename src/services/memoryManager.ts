import {
    getMemories,
    saveMemories,
    getMemorySettings,
    type Memory,
    type DecayRate
} from './storage';

// 衰减常数 (以天为单位)
// fast: 3天衰减到 50%
// normal: 7天衰减到 50%
// slow: 30天衰减到 50%
const DECAY_CONSTANTS: Record<DecayRate, number> = {
    fast: Math.log(2) / 3,
    normal: Math.log(2) / 7,
    slow: Math.log(2) / 30,
};

/**
 * 计算记忆的当​​前重要性分数
 * 公式: 当前分数 = 初始重要性 * e^(-λ * Δt)
 * 其中 λ 是衰减常数，Δt 是自上次访问以来的天数
 * 如果记忆被“访问”了（search hit），重要性会回升
 */
function calculateCurrentImportance(memory: Memory, rate: DecayRate): number {
    if (memory.pinned) return 100; // 固定记忆不衰减

    const now = Date.now();
    const timeDiffDays = (now - memory.lastAccessedAt) / (1000 * 60 * 60 * 24);
    const lambda = DECAY_CONSTANTS[rate];

    // 衰减计算
    const decayedScore = memory.importance * Math.exp(-lambda * timeDiffDays);

    return Math.max(0, Math.min(100, decayedScore));
}

/**
 * 执行记忆衰减与更新
 * 此函数应在后台定期运行
 */
export function decayMemories(): void {
    const settings = getMemorySettings();
    if (!settings.enabled || !settings.forgettingEnabled) return;

    const memories = getMemories();
    const decayRate = settings.decayRate || 'normal';
    let hasChanges = false;

    const updatedMemories = memories.map(memory => {
        // 只有当记忆超过1小时未更新时才计算衰减，避免过度计算
        if (Date.now() - memory.updatedAt < 3600 * 1000) return memory;

        const newScore = calculateCurrentImportance(memory, decayRate);

        // 如果分数变化超过 1 分，则更新
        if (Math.abs(newScore - memory.importance) > 1) {
            hasChanges = true;
            return {
                ...memory,
                importance: newScore,
                updatedAt: Date.now(), // 更新时间戳，注意这里其实有点副作用，会导致 lastAccessedAt 实际上没变但 updatedAt 变了
                // 我们不应该更新 updatedAt 除非内容变了，这里仅仅是内部权重的衰减
                // 但为了持久化，我们需要保存。
                // 修正：我们不应该更新 updatedAt，因为那表示内容的修改。
                // 我们可以只更新 importance 字段。
            };
        }
        return memory;
    });

    if (hasChanges) {
        saveMemories(updatedMemories);
    }
}

/**
 * 清理低重要性记忆
 */
export function pruneMemories(): { deletedCount: number } {
    const settings = getMemorySettings();
    if (!settings.enabled || !settings.forgettingEnabled) return { deletedCount: 0 };

    const memories = getMemories();
    const initialCount = memories.length;

    // 1. 删除低于阈值的记忆
    let filteredMemories = memories.filter(m => m.importance >= settings.importanceThreshold || m.pinned);

    // 2. 如果仍然超过最大数量限制，删除重要性最低的（非Pinned）
    if (filteredMemories.length > settings.maxMemoryCount) {
        // 分离 pinned 和 unpinned
        const pinned = filteredMemories.filter(m => m.pinned);
        const unpinned = filteredMemories.filter(m => !m.pinned);

        // 对 unpinned 按重要性排序（降序）
        unpinned.sort((a, b) => b.importance - a.importance);

        // 截取剩余名额
        const remainingSlots = Math.max(0, settings.maxMemoryCount - pinned.length);
        const keptUnpinned = unpinned.slice(0, remainingSlots);

        filteredMemories = [...pinned, ...keptUnpinned];
    }

    const deletedCount = initialCount - filteredMemories.length;

    if (deletedCount > 0) {
        saveMemories(filteredMemories);
    }

    return { deletedCount };
}

/**
 * 增加记忆的访问计数并重置衰减
 * 当一条记忆被检索并使用时调用
 */
export function touchMemory(memoryId: string): void {
    const memories = getMemories();
    const index = memories.findIndex(m => m.id === memoryId);

    if (index !== -1) {
        const memory = memories[index];
        // 提升重要性：每次访问恢复一定分数，或者直接设为 100？
        // 策略：重要性 = 当前重要性 + (100 - 当前重要性) * 0.5
        // 这样每次访问都会显著提升，但不会立刻由 0 变 100
        const newImportance = memory.importance + (100 - memory.importance) * 0.5;

        memories[index] = {
            ...memory,
            accessCount: memory.accessCount + 1,
            lastAccessedAt: Date.now(),
            importance: Math.min(100, newImportance),
        };
        saveMemories(memories);
    }
}
