

interface ToolApprovalModalProps {
    isOpen: boolean;
    toolName: string;
    args: Record<string, unknown>;
    onApprove: () => void;
    onReject: () => void;
}

export function ToolApprovalModal({
    isOpen,
    toolName,
    args,
    onApprove,
    onReject,
}: ToolApprovalModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[500px] overflow-hidden rounded-xl border border-red-500/30 bg-[#1e1e1e] shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-2 border-b border-white/10 bg-red-500/10 px-6 py-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="h-5 w-5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                        敏感操作请求
                    </h3>
                </div>

                {/* Content */}
                <div className="space-y-4 px-6 py-6">
                    <p className="text-sm text-gray-400">
                        Agent 正在尝试执行以下操作，该操作可能具有破坏性或涉及隐私。请确认是否允许执行。
                    </p>

                    <div className="rounded-lg bg-black/30 p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium uppercase text-gray-500">
                                工具名称
                            </span>
                            <span className="font-mono text-sm text-blue-400">
                                {toolName}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-medium uppercase text-gray-500">
                                参数
                            </span>
                            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-black/20 p-2 font-mono text-xs text-green-400">
                                {JSON.stringify(args, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-white/10 bg-white/5 px-6 py-4">
                    <button
                        onClick={onReject}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10"
                    >
                        拒绝 (Reject)
                    </button>
                    <button
                        onClick={onApprove}
                        className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                    >
                        批准执行 (Approve)
                    </button>
                </div>
            </div>
        </div>
    );
}
