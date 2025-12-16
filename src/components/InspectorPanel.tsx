import { useEffect, useState, useRef } from 'react';
import { getActivityLogs, type ActivityLogEntry } from '@/services/activityLog';

interface InspectorPanelProps {
    sessionId?: string;
    isOpen: boolean;
    onClose: () => void;
}

export function InspectorPanel({ sessionId, isOpen, onClose }: InspectorPanelProps) {
    const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!sessionId || !isOpen) return;

        // 初始加载
        setLogs(getActivityLogs(sessionId));

        // 监听更新
        const handleUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<{ sessionId: string }>;
            if (customEvent.detail.sessionId === sessionId) {
                setLogs(getActivityLogs(sessionId));
            }
        };

        window.addEventListener('activity-logs-updated', handleUpdate);
        return () => window.removeEventListener('activity-logs-updated', handleUpdate);
    }, [sessionId, isOpen]);

    // 自动滚动到底部
    useEffect(() => {
        if (isOpen) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed right-0 top-10 bottom-0 z-40 w-80 border-l border-white/10 bg-[#1e1e1e] shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
                <h3 className="flex items-center gap-2 font-medium text-white">
                    <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                    思维链检查器 (Inspector)
                </h3>
                <button
                    onClick={onClose}
                    className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                    >
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                </button>
            </div>

            <div className="h-[calc(100%-50px)] overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                <div className="space-y-4">
                    {logs.length === 0 && (
                        <div className="py-8 text-center text-xs text-gray-500">
                            暂无活动日志...
                        </div>
                    )}

                    {logs.map((log) => (
                        <div key={log.id} className="group relative border-l-2 border-white/10 pl-4 transition-colors hover:border-blue-500/50">
                            <div className="absolute -left-[5px] top-0 h-2.5 w-2.5 rounded-full bg-[#1e1e1e] border-2 border-white/10 group-hover:border-blue-500"></div>

                            <div className="mb-1 flex items-center justify-between">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${log.type === 'tool_call' ? 'text-blue-400' :
                                    log.type === 'tool_result' ? 'text-green-400' :
                                        log.type === 'error' ? 'text-red-400' :
                                            'text-purple-400'
                                    }`}>
                                    {log.type.replace('_', ' ')}
                                </span>
                                <span className="font-mono text-[10px] text-gray-600">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                            </div>

                            <div className="rounded border border-white/5 bg-black/20 p-2 font-mono text-xs text-gray-300">
                                {typeof log.content === 'object' ? (
                                    <pre className="whitespace-pre-wrap break-all">
                                        {JSON.stringify(log.content, null, 2)}
                                    </pre>
                                ) : (
                                    <p className="whitespace-pre-wrap">{String(log.content)}</p>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
}
