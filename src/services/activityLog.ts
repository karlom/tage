import { storageGet, storageSet } from './storage';

export interface ActivityLogEntry {
    id: string;
    sessionId: string;
    timestamp: number;
    type: 'thought' | 'tool_call' | 'tool_result' | 'error';
    content: unknown;
    metadata?: Record<string, unknown>;
}

const STORAGE_KEY_LOGS = 'tageai_activity_logs';
const MAX_LOGS_PER_SESSION = 50;

/**
 * 获取指定会话的活动日志
 */
export function getActivityLogs(sessionId: string): ActivityLogEntry[] {
    try {
        const allLogs = storageGet<Record<string, ActivityLogEntry[]>>(STORAGE_KEY_LOGS, {});
        return allLogs[sessionId] || [];
    } catch (e) {
        console.error('Failed to get activity logs:', e);
        return [];
    }
}

/**
 * 添加一条活动日志
 */
export function addActivityLog(
    sessionId: string,
    type: ActivityLogEntry['type'],
    content: unknown,
    metadata?: Record<string, unknown>
): void {
    try {
        const allLogs = storageGet<Record<string, ActivityLogEntry[]>>(STORAGE_KEY_LOGS, {});
        const sessionLogs = allLogs[sessionId] || [];

        const newEntry: ActivityLogEntry = {
            id: crypto.randomUUID(),
            sessionId,
            timestamp: Date.now(),
            type,
            content,
            metadata,
        };

        // 保持日志数量在限制范围内
        const updatedSessionLogs = [...sessionLogs, newEntry].slice(-MAX_LOGS_PER_SESSION);

        allLogs[sessionId] = updatedSessionLogs;
        storageSet(STORAGE_KEY_LOGS, allLogs);

        // 触发更新事件
        window.dispatchEvent(new CustomEvent('activity-logs-updated', { detail: { sessionId } }));
    } catch (e) {
        console.error('Failed to add activity log:', e);
    }
}

/**
 * 清除会话日志
 */
export function clearActivityLogs(sessionId: string): void {
    try {
        const allLogs = storageGet<Record<string, ActivityLogEntry[]>>(STORAGE_KEY_LOGS, {});
        delete allLogs[sessionId];
        storageSet(STORAGE_KEY_LOGS, allLogs);
        window.dispatchEvent(new CustomEvent('activity-logs-updated', { detail: { sessionId } }));
    } catch (e) {
        console.error('Failed to clear activity logs:', e);
    }
}
