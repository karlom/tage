# Tage AI

A modern, feature-rich AI chat desktop client built with Electron, React, and TypeScript. Supports multiple AI providers with tool calling, memory system, and deep macOS integration.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-28-47848F.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)

English | [中文](./README.zh-CN.md)

## Features

- **Multi-Provider Support** - Seamlessly switch between DeepSeek, OpenAI, Anthropic, Google Gemini, and OpenRouter
- **Tool Calling** - Built-in function calling with web search, file operations, calculator, and more
- **macOS Integration** - Native AppleScript support for Calendar, Reminders, volume control, and shell commands
- **Memory System** - Vector embeddings for context-aware conversations (RAG)
- **Streaming Responses** - Real-time SSE streaming with token usage tracking
- **Reasoning Models** - Support for DeepSeek Reasoner and OpenAI o1 models
- **Vision Support** - Multimodal conversations with image understanding
- **Modern UI** - Clean, native-feeling interface with dark mode support

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Electron 28 |
| Frontend | React 18, TypeScript 5 |
| Build | Vite 5 |
| Styling | Tailwind CSS 3, Shadcn/UI |
| Icons | Lucide React |
| Storage | electron-store |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/karlom/tage.git
cd tage

# Install dependencies
pnpm install
```

### Development

```bash
# Start development server (web only)
pnpm dev

# Start with Electron (recommended)
pnpm electron:dev
```

### Build

```bash
# Build web assets
pnpm build

# Build Electron main/preload
pnpm build:electron

# Full production build with packaging
pnpm electron:build
```

## Project Structure

```
tage/
├── electron/               # Electron main process
│   ├── main.ts            # Window management, IPC handlers
│   └── preload.ts         # Secure IPC bridge (window.electronAPI)
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # Reusable UI primitives
│   │   ├── settings/     # Settings page sections
│   │   ├── ChatPage.tsx  # Main chat interface
│   │   └── Sidebar.tsx   # Navigation sidebar
│   ├── services/
│   │   ├── deepseek.ts   # AI API client (multi-provider)
│   │   ├── storage.ts    # Persistence layer
│   │   ├── tools.ts      # Tool execution engine
│   │   ├── embedding.ts  # Vector embedding service
│   │   └── persona.ts    # AI persona management
│   └── hooks/            # React hooks
├── public/               # Static assets
└── app-dist/             # Build output
```

## Configuration

### AI Providers

Configure your API keys in Settings > Providers:

| Provider | Models | Features |
|----------|--------|----------|
| DeepSeek | deepseek-chat, deepseek-reasoner | Reasoning, Tool calling |
| OpenAI | gpt-4o, gpt-4-turbo, o1 | Vision, Tool calling |
| Anthropic | claude-3.5-sonnet, claude-3-opus | Vision, Tool calling |
| Google | gemini-1.5-pro, gemini-1.5-flash | Vision, Long context |
| OpenRouter | Various | Aggregated access |

### Built-in Tools

| Category | Tools |
|----------|-------|
| Network | `web_fetch`, `web_search` (SerpAPI/Brave/Google) |
| Workspace | `glob_files`, `read_file` |
| Utility | `calculator`, `get_current_time` |
| macOS | `calendar`, `reminders`, `volume`, `shell`, `applescript` |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ + N` | New chat |
| `⌘ + K` | Search chats |
| `⌘ + ,` | Open settings |
| `⌘ + Enter` | Send message |

## Screenshots

*Coming soon*

## Roadmap

- [ ] Windows/Linux support
- [ ] Plugin system
- [ ] Local model support (Ollama)
- [ ] Export/Import conversations
- [ ] Multi-language UI

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn/UI](https://ui.shadcn.com/)
- [Lucide Icons](https://lucide.dev/)
