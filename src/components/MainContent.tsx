import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MainContentProps {
  children?: React.ReactNode;
  title?: string;
  fullHeight?: boolean;
}

export default function MainContent({
  children,
  title,
  fullHeight = false,
}: MainContentProps) {
  if (fullHeight) {
    // 聊天界面使用全高度布局
    return (
      <div className="flex-1 h-full bg-white dark:bg-zinc-950 flex flex-col overflow-hidden">
        {/* 顶部留空区域（拖拽由 App.tsx 统一处理） */}
        <div className="h-10 flex-shrink-0" />
        {children}
      </div>
    );
  }

  return (
    <div className="flex-1 h-full bg-white dark:bg-zinc-950 flex flex-col overflow-hidden">
      {/* 顶部留空区域（拖拽由 App.tsx 统一处理） */}
      <div className="h-10 flex-shrink-0" />
      <div className="flex-1 overflow-auto">
        <Card className="m-2 min-h-[calc(100%-1rem)]">
          {title && (
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
          )}
          <CardContent className={title ? '' : 'p-6'}>
            {children || (
              <div className="text-gray-500 dark:text-gray-400">
                这里是主内容区域，可以放置设置面板或聊天窗口
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

