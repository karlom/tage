# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tage AI is an Electron-based AI chat desktop client that supports multiple AI providers (DeepSeek, OpenAI, Anthropic, Google Gemini, OpenRouter). It features tool calling, memory system with embeddings, and macOS system integrations.

## Development Commands

```bash
# Install dependencies
pnpm install

# Development (web only)
pnpm dev

# Development with Electron
pnpm electron:dev

# Build for production
pnpm build                # Build web assets
pnpm build:electron       # Build Electron main/preload
pnpm electron:build       # Full production build with packaging
```

## Architecture

### Process Model (Electron)

- **Main Process** (`electron/main.ts`): Window management, IPC handlers, file system access, AppleScript/shell execution, electron-store persistence
- **Preload** (`electron/preload.ts`): Exposes `window.electronAPI` to renderer with secure IPC bridge
- **Renderer** (`src/`): React application with Vite bundling

### Key Directories

```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI primitives (Button, Card, Input, etc.)
│   └── settings/       # Settings page sections
├── services/           # Business logic
│   ├── deepseek.ts     # AI API client (streaming, tool calls, multi-provider)
│   ├── storage.ts      # Persistence layer (electron-store + localStorage fallback)
│   ├── tools.ts        # Tool execution engine (web, macOS, file operations)
│   ├── embedding.ts    # Vector embedding service
│   └── persona.ts      # AI persona management
└── hooks/              # React hooks (useTheme, useKeyboardShortcuts)
```

### Data Flow

1. **Storage**: Uses `electron-store` in Electron, falls back to `localStorage` in browser. All reads are synchronous from memory cache; writes are batched and async.

2. **AI Chat**: `src/services/deepseek.ts` handles all AI providers through OpenAI-compatible API. Supports:
   - SSE streaming with usage tracking
   - Multi-turn tool calling (max 5 iterations)
   - Reasoning models (DeepSeek Reasoner, o1)
   - Vision (multimodal messages)

3. **Tools**: `src/services/tools.ts` implements function calling. Categories:
   - Network: web_fetch, web_search (SerpAPI/Brave/Google)
   - Workspace: glob_files, read_file
   - Utility: calculator, get_current_time
   - macOS: calendar, reminders, volume, shell, AppleScript

### TypeScript Configuration

- `tsconfig.json`: React app (bundler mode, `@/*` path alias to `./src/*`)
- `tsconfig.node.json`: Electron main process
- `tsconfig.preload.json`: Electron preload script

### Build Output

- `app-dist/`: Vite build output (web assets)
- `dist-electron/`: Compiled Electron code
- `release/`: Packaged application (via electron-builder)

## Code Patterns

### Storage Access

```typescript
// Always initialize storage before reading
await initializeStorage();

// Sync reads from memory cache
const providers = getProviders();

// Writes are batched automatically
saveProviders(updatedProviders);
```

### IPC Communication

```typescript
// Renderer -> Main (in services)
const result = await window.electronAPI.runAppleScript(script);

// Check for Electron environment
if (typeof window !== 'undefined' && window.electronAPI) {
  // Desktop-only code
}
```

### API Proxies (Development)

Vite config includes proxies to avoid CORS during development:
- `/api/deepseek` → DeepSeek API
- `/api/openai` → OpenAI API
- `/api/anthropic` → Anthropic API
- `/api/openrouter` → OpenRouter API
- `/api/brave` → Brave Search API
