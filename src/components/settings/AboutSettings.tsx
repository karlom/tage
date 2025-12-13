export default function AboutSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">关于</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Tage AI</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              版本 1.0.0
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-2">简介</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              一个基于 Electron 的现代化桌面 AI 客户端，旨在聚合多种大模型
              API，提供统一、极简且具备高级记忆功能（RAG）的对话体验。
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-2">技术栈</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Electron + React + TypeScript</li>
              <li>• Tailwind CSS + Shadcn/UI</li>
              <li>• Vite</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">许可证</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">MIT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
