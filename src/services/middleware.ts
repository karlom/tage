import { ToolContext, ToolResult, Middleware, useToolMiddleware } from './tools';
import { getTools } from './storage';

// 审批请求事件数据
export interface ApprovalRequestEventDetail {
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    resolve: (value: boolean) => void;
}

// 初始化审批中间件
export function initApprovalMiddleware() {
    const approvalMiddleware: Middleware = async (context: ToolContext, next: () => Promise<ToolResult>) => {
        const { toolCall, args } = context;
        const toolId = toolCall.function.name;

        // 获取工具配置，检查是否需要审批
        const tools = getTools();
        const toolConfig = tools.find(t => t.id === toolId);

        if (toolConfig?.requiresApproval) {

            // 创建一个 Promise 等待用户响应
            const approved = await new Promise<boolean>((resolve) => {
                // 触发自定义事件，通知 UI 显示弹窗
                const event = new CustomEvent<ApprovalRequestEventDetail>('tool-approval-request', {
                    detail: {
                        id: toolCall.id,
                        toolName: toolConfig.name || toolId,
                        args: args,
                        resolve: resolve,
                    },
                });
                window.dispatchEvent(event);
            });

            if (!approved) {
                console.warn(`Tool ${toolId} was rejected by user.`);
                // 返回一个模拟的“用户拒绝”结果，而不是抛出错误，这样 Agent 可以知道是被拒绝了
                return {
                    toolCallId: toolCall.id,
                    toolName: toolId,
                    result: 'User denied the permission to execute this tool.',
                    success: false,
                    error: 'UserRejected',
                };
            }
        }

        // 继续执行下一个中间件或实际工具
        return next();
    };

    // 注册中间件
    useToolMiddleware(approvalMiddleware);
}
