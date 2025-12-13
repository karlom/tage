import { X, FileText, Image as ImageIcon, File } from 'lucide-react';

interface AttachmentPreviewProps {
  attachments: FileAttachment[];
  onRemove: (id: string) => void;
  compact?: boolean;
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 获取文件图标
function getFileIcon(type: string, mimeType: string) {
  if (type === 'image') {
    return <ImageIcon className="w-4 h-4" />;
  }
  if (mimeType === 'application/pdf') {
    return <FileText className="w-4 h-4 text-red-500" />;
  }
  if (mimeType.startsWith('text/')) {
    return <FileText className="w-4 h-4 text-blue-500" />;
  }
  return <File className="w-4 h-4" />;
}

export default function AttachmentPreview({
  attachments,
  onRemove,
  compact = false,
}: AttachmentPreviewProps) {
  if (attachments.length === 0) {
    return null;
  }

  if (compact) {
    // 紧凑模式 - 用于输入框上方显示
    return (
      <div className="flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-zinc-800 rounded-t-lg border-b border-gray-200 dark:border-zinc-700">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-700 text-sm"
          >
            {attachment.type === 'image' ? (
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="w-6 h-6 object-cover rounded"
              />
            ) : (
              getFileIcon(attachment.type, attachment.mimeType)
            )}
            <span className="max-w-[100px] truncate text-gray-700 dark:text-gray-300">
              {attachment.name}
            </span>
            <button
              onClick={() => onRemove(attachment.id)}
              className="p-0.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
            >
              <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        ))}
      </div>
    );
  }

  // 完整预览模式
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="relative group bg-gray-50 dark:bg-zinc-800 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700"
        >
          {/* 删除按钮 */}
          <button
            onClick={() => onRemove(attachment.id)}
            className="absolute top-1 right-1 z-10 p-1 bg-black/50 hover:bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3 text-white" />
          </button>

          {/* 预览内容 */}
          {attachment.type === 'image' ? (
            <div className="aspect-square">
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-square flex flex-col items-center justify-center p-4">
              <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-zinc-700 rounded-lg mb-2">
                {getFileIcon(attachment.type, attachment.mimeType)}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center truncate w-full">
                {attachment.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
              </span>
            </div>
          )}

          {/* 文件信息 */}
          <div className="p-2 border-t border-gray-200 dark:border-zinc-700">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
              {attachment.name}
            </p>
            <p className="text-xs text-gray-400">
              {formatFileSize(attachment.size)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// 附件列表组件（用于消息中显示）
interface MessageAttachmentsProps {
  attachments: FileAttachment[];
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700"
        >
          {attachment.type === 'image' ? (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              className="max-w-[200px] max-h-[150px] object-contain cursor-pointer hover:opacity-90"
              onClick={() => {
                // 点击图片打开大图
                window.open(attachment.dataUrl, '_blank');
              }}
            />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-zinc-800">
              {getFileIcon(attachment.type, attachment.mimeType)}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {attachment.name}
                </p>
                <p className="text-xs text-gray-400">
                  {formatFileSize(attachment.size)}
                </p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
