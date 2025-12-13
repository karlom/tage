import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Download, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import React, { useState, useRef, useEffect, memo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// 图片组件 - 带错误处理、加载状态和下载功能
const ImageComponent = memo(function ImageComponent({ src, alt }: { src?: string | null; alt?: string | null }) {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 处理图片 URL - 支持 base64 和普通 URL
  const getImageSrc = (imageSrc: string | undefined | null): string | undefined => {
    // 处理 null、undefined 和空字符串
    if (!imageSrc || typeof imageSrc !== 'string' || imageSrc.trim() === '') {
      return undefined;
    }

    const trimmedSrc = imageSrc.trim();

    // 如果是 base64 图片，直接返回
    if (trimmedSrc.startsWith('data:image/')) {
      return trimmedSrc;
    }

    // 如果是 HTTP/HTTPS URL，直接返回
    if (trimmedSrc.startsWith('http://') || trimmedSrc.startsWith('https://')) {
      return trimmedSrc;
    }

    // 其他情况（相对路径等）也返回，让浏览器尝试加载
    return trimmedSrc;
  };

  const baseImageSrc = getImageSrc(src);

  // 生成带重试参数的图片 URL
  const getImageSrcWithRetry = (baseSrc: string | undefined, retry: number): string | undefined => {
    if (!baseSrc) return undefined;
    // base64 图片不需要重试参数
    if (baseSrc.startsWith('data:image/')) return baseSrc;
    // 添加重试参数以绕过缓存
    const separator = baseSrc.includes('?') ? '&' : '?';
    return `${baseSrc}${separator}_retry=${retry}&_t=${Date.now()}`;
  };

  const [currentImageSrc, setCurrentImageSrc] = useState<string | undefined>(
    baseImageSrc ? getImageSrcWithRetry(baseImageSrc, retryCount) : undefined
  );

  // 当 retryCount 或 baseImageSrc 变化时，更新图片 src
  useEffect(() => {
    if (baseImageSrc) {
      const newSrc = getImageSrcWithRetry(baseImageSrc, retryCount);
      setCurrentImageSrc(newSrc);
      setImageState('loading');
    } else {
      setCurrentImageSrc(undefined);
      setImageState('error');
    }
  }, [retryCount, baseImageSrc]);

  const handleImageLoad = () => {
    setImageState('loaded');
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.warn('Image load error:', e.currentTarget.src);
    setImageState('error');
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  // 下载图片
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!baseImageSrc || isDownloading) return;

    setIsDownloading(true);

    try {
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      let fileName = `image-${timestamp}`;

      // 如果是 base64 图片
      if (baseImageSrc.startsWith('data:image/')) {
        const mimeMatch = baseImageSrc.match(/data:image\/(\w+);/);
        const ext = mimeMatch ? mimeMatch[1] : 'png';
        fileName = `${fileName}.${ext}`;

        // 创建下载链接
        const link = document.createElement('a');
        link.href = baseImageSrc;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // URL 图片 - 尝试 fetch 然后下载
        try {
          const response = await fetch(baseImageSrc);
          const blob = await response.blob();

          // 从 content-type 获取扩展名
          const contentType = blob.type;
          const ext = contentType.split('/')[1] || 'png';
          fileName = `${fileName}.${ext}`;

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (fetchError) {
          // 如果 fetch 失败（可能是 CORS），尝试直接打开
          console.warn('Fetch failed, opening in new tab:', fetchError);
          window.open(baseImageSrc, '_blank');
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // 如果没有有效的图片源，显示错误提示
  if (!baseImageSrc || !currentImageSrc) {
    return (
      <span className="block my-4 p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
        <span className="flex flex-col items-center gap-2">
          <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">图片 URL 无效</span>
          </span>
          {src && (
            <span className="text-xs text-gray-400 dark:text-gray-500 break-all max-w-full px-2 text-center">
              {typeof src === 'string' && src.length > 0
                ? (src.length > 100 ? `${src.substring(0, 100)}...` : src)
                : '未提供图片 URL'}
            </span>
          )}
        </span>
      </span>
    );
  }

  if (imageState === 'error') {
    return (
      <span className="block my-4 p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
        <span className="flex flex-col items-center gap-3">
          <span className="flex items-center gap-2 text-red-500 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">图片加载失败</span>
          </span>
          {baseImageSrc && (
            <span className="text-xs text-gray-500 dark:text-gray-400 break-all max-w-full px-2 text-center">
              {baseImageSrc.length > 100 ? `${baseImageSrc.substring(0, 100)}...` : baseImageSrc}
            </span>
          )}
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>重试</span>
          </button>
          {baseImageSrc.startsWith('http://') || baseImageSrc.startsWith('https://') ? (
            <a
              href={baseImageSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              在新窗口打开
            </a>
          ) : null}
        </span>
      </span>
    );
  }

  return (
    <div className="my-4 relative inline-block group">
      {imageState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-zinc-800 rounded-lg min-h-[200px] z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">加载图片中...</span>
          </div>
        </div>
      )}
      {currentImageSrc && (
        <img
          ref={imgRef}
          src={currentImageSrc}
          alt={alt || '图片'}
          className={`max-w-full h-auto rounded-lg transition-opacity duration-300 ${
            imageState === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy"
        />
      )}
      {/* 下载按钮 - 使用 CSS group-hover 显示 */}
      {imageState === 'loaded' && (
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="absolute bottom-3 right-3 p-2.5 bg-black/70 hover:bg-black/90 text-white rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100 backdrop-blur-sm shadow-lg cursor-pointer"
          title="下载图片"
        >
          {isDownloading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  );
});

// 代码块组件
const CodeBlock = memo(function CodeBlock({ 
  language, 
  children 
}: { 
  language: string; 
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([children], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${language || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700">
      {/* 代码块头部 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
          {language || 'text'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            title="下载"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            title={copied ? '已复制' : '复制'}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      
      {/* 代码内容 */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          padding: '1rem',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
        showLineNumbers={children.split('\n').length > 3}
        wrapLines
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
});

export default memo(function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(uri) => {
          const safe = uri || '';
          if (safe.startsWith('data:image/')) return safe;
          if (safe.startsWith('http://') || safe.startsWith('https://') || safe.startsWith('/')) return safe;
          return '';
        }}
        components={{
          // 标题
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-gray-200 dark:border-zinc-700">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-5 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-3 mb-2">{children}</h4>
          ),
          
          // 段落 - 特殊处理：如果只包含图片，使用 div 而不是 p
          p: ({ children }) => {
            // 检查是否只包含图片（通过检查 children 的类型）
            const childrenArray = React.Children.toArray(children);
            const hasOnlyImage = childrenArray.length > 0 && childrenArray.every(
              (child: any) => {
                // 检查是否是 ImageComponent 或 img 元素
                if (React.isValidElement(child)) {
                  const childType = child.type;
                  // 检查是否是函数组件 ImageComponent 或原生 img
                  if (typeof childType === 'function' && childType.name === 'ImageComponent') {
                    return true;
                  }
                  if (childType === 'img' || (child.props && typeof child.props === 'object' && 'src' in child.props && child.props.src)) {
                    return true;
                  }
                }
                return false;
              }
            );
            
            // 如果只包含图片，使用 div 以避免 DOM 嵌套警告
            if (hasOnlyImage) {
              return <div className="my-3">{children}</div>;
            }
            
            return <p className="my-3 leading-7">{children}</p>;
          },
          
          // 列表
          ul: ({ children }) => (
            <ul className="my-3 ml-6 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-6 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-7">{children}</li>
          ),
          
          // 引用
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 border-l-4 border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-400 italic">
              {children}
            </blockquote>
          ),
          
          // 代码
          code: ({ className, children, node, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            // 检查是否在 pre 标签内（代码块）
            const isCodeBlock = node?.position && String(children).includes('\n');
            
            if (!isCodeBlock && !match) {
              // 行内代码
              return (
                <code
                  className="px-1.5 py-0.5 mx-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-pink-600 dark:text-pink-400 font-mono text-sm"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            // 代码块
            return (
              <CodeBlock language={match?.[1] || ''}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          },
          
          // 预格式化 - 直接返回子元素，让 code 组件处理
          pre: ({ children }) => <>{children}</>,
          
          // 链接
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          ),
          
          // 图片
          img: ({ src, alt }) => <ImageComponent src={src} alt={alt} />,
          
          // 表格
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 dark:bg-zinc-800">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-gray-200 dark:border-zinc-700">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
              {children}
            </td>
          ),
          
          // 水平线
          hr: () => (
            <hr className="my-6 border-gray-200 dark:border-zinc-700" />
          ),
          
          // 强调
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          
          // 删除线
          del: ({ children }) => (
            <del className="line-through text-gray-500">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
