import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    getQuickCommands,
    addQuickCommand,
    updateQuickCommand,
    deleteQuickCommand,
    type QuickCommand,
} from '@/services/storage';

export default function QuickCommandsSettings() {
    const [commands, setCommands] = useState<QuickCommand[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCommand, setEditingCommand] = useState<QuickCommand | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [commandToDelete, setCommandToDelete] = useState<QuickCommand | null>(null);

    // 表单状态
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formError, setFormError] = useState('');

    // 加载快捷指令列表
    const loadCommands = () => {
        const loaded = getQuickCommands();
        setCommands(loaded);
    };

    useEffect(() => {
        loadCommands();

        // 监听快捷指令更新事件
        const handleUpdate = () => {
            loadCommands();
        };
        window.addEventListener('quick-commands-updated', handleUpdate);
        return () => window.removeEventListener('quick-commands-updated', handleUpdate);
    }, []);

    // 验证命令名称格式
    const validateCommandName = (name: string): boolean => {
        // 只允许字母、数字、连字符、下划线
        const pattern = /^[a-zA-Z0-9_-]+$/;
        return pattern.test(name);
    };

    // 打开添加对话框
    const handleAdd = () => {
        setEditingCommand(null);
        setFormName('');
        setFormContent('');
        setFormDescription('');
        setFormError('');
        setIsDialogOpen(true);
    };

    // 打开编辑对话框
    const handleEdit = (command: QuickCommand) => {
        setEditingCommand(command);
        setFormName(command.name);
        setFormContent(command.content);
        setFormDescription(command.description || '');
        setFormError('');
        setIsDialogOpen(true);
    };

    // 保存快捷指令
    const handleSave = () => {
        // 验证表单
        if (!formName.trim()) {
            setFormError('命令名称不能为空');
            return;
        }

        if (!validateCommandName(formName)) {
            setFormError('命令名称只能包含字母、数字、连字符和下划线');
            return;
        }

        if (!formContent.trim()) {
            setFormError('命令内容不能为空');
            return;
        }

        try {
            if (editingCommand) {
                // 更新现有命令
                updateQuickCommand(editingCommand.id, {
                    name: formName.trim(),
                    content: formContent.trim(),
                    description: formDescription.trim() || undefined,
                });
            } else {
                // 添加新命令
                addQuickCommand({
                    name: formName.trim(),
                    content: formContent.trim(),
                    description: formDescription.trim() || undefined,
                });
            }
            setIsDialogOpen(false);
            loadCommands();
        } catch (error) {
            setFormError(error instanceof Error ? error.message : '保存失败');
        }
    };

    // 确认删除
    const handleDeleteClick = (command: QuickCommand) => {
        setCommandToDelete(command);
        setDeleteDialogOpen(true);
    };

    // 执行删除
    const handleDeleteConfirm = () => {
        if (commandToDelete) {
            try {
                deleteQuickCommand(commandToDelete.id);
                loadCommands();
            } catch (error) {
                console.error('删除失败:', error);
            }
        }
        setDeleteDialogOpen(false);
        setCommandToDelete(null);
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                    快捷提示
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    创建可以通过斜杠命令 / 触发输入 / 触发的快捷提示
                </p>

                {/* 添加按钮 */}
                <Button
                    onClick={handleAdd}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    添加提示
                </Button>
            </div>

            {/* 快捷指令列表 */}
            <div className="space-y-2">
                {commands.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                        <Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            暂无提示
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            添加您的第一个快捷提示以开始使用
                        </p>
                    </div>
                ) : (
                    commands.map((command) => (
                        <div
                            key={command.id}
                            className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <code className="text-sm font-mono px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                            /{command.name}
                                        </code>
                                        {command.description && (
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                {command.description}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                        {command.content}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <button
                                        onClick={() => handleEdit(command)}
                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 rounded transition-colors"
                                        title="编辑"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(command)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                                        title="删除"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 添加/编辑对话框 */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCommand ? '编辑快捷提示' : '添加快捷提示'}
                        </DialogTitle>
                        <DialogDescription>
                            通过 /prompts:{'{'}name{'}'} 触发，只允许字母、数字、连字符和下划线。
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* 名称 */}
                        <div className="space-y-2">
                            <Label htmlFor="name">名称</Label>
                            <Input
                                id="name"
                                placeholder="例如：commit、review、explain"
                                value={formName}
                                onChange={(e) => {
                                    setFormName(e.target.value);
                                    setFormError('');
                                }}
                                className={formError && !formName.trim() ? 'border-red-500' : ''}
                            />
                        </div>

                        {/* 内容 */}
                        <div className="space-y-2">
                            <Label htmlFor="content">内容</Label>
                            <Textarea
                                id="content"
                                placeholder="输入提示内容..."
                                value={formContent}
                                onChange={(e) => {
                                    setFormContent(e.target.value);
                                    setFormError('');
                                }}
                                rows={6}
                                className={formError && !formContent.trim() ? 'border-red-500' : ''}
                            />
                        </div>

                        {/* 描述（可选） */}
                        <div className="space-y-2">
                            <Label htmlFor="description">描述（可选）</Label>
                            <Input
                                id="description"
                                placeholder="简短描述这个快捷提示的用途"
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                            />
                        </div>

                        {/* 错误提示 */}
                        {formError && (
                            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 p-3 rounded">
                                {formError}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 删除确认对话框 */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除快捷提示 <code className="text-sm font-mono px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">/{commandToDelete?.name}</code> 吗？此操作无法撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
