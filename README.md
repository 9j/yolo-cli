# YOLO CLI

> Interactive AI command-line interface powered by OpenRouter

YOLO CLI is a terminal-based application that enables seamless interaction with multiple AI models through OpenRouter's unified API. Built with TypeScript and Ink framework, it provides a keyboard-driven interface where you can cycle through different AI models and maintain conversation context across sessions.

## Features

- 🤖 **Multiple AI Models**: Access to Claude, GPT-4, Gemini, and more through OpenRouter
- ⌨️ **Model Switching**: Cycle through models with Shift+Tab
- 💬 **Interactive Chat**: Real-time streaming responses
- 📝 **Multi-line Input**: Support for complex queries
- 💾 **Multi-Session Support**: Multiple independent conversations per directory with UUID-based session files
- ⚡ **Slash Commands**: Quick actions with `/clear`, `/new`, `/compact`, `/version`, `/help`, `/exit`
- 🔍 **Smart Autocomplete**: Intelligent completion for commands (`/`) and file paths (`@`)
- 🗜️ **Conversation Compaction**: AI-powered summarization to reduce token usage (20+ message threshold)
- 🔧 **MCP Support**: Automatic Model Context Protocol server loading for extended tool capabilities
- 🚀 **Fast Setup**: 2-minute first-run configuration
- 🎨 **Terminal UI**: Clean, keyboard-driven interface

## Prerequisites

- Node.js 18.0.0 or higher
- OpenRouter API key ([Get one here](https://openrouter.ai/keys))

## Installation

```bash
npm install -g @0vv/yolo-cli
```

Or use npx without installation:

```bash
npx @0vv/yolo-cli
```

## Quick Start

1. Launch YOLO CLI:
   ```bash
   yolo
   ```

   Or if using npx:
   ```bash
   npx @0vv/yolo-cli
   ```

2. Enter your OpenRouter API key when prompted

3. Select models to enable

4. Start chatting!

## Usage

### Interactive Mode

```bash
yolo
```

Type your query and press Enter. The AI response streams in real-time.

### Cycle Through Models

Press **Shift+Tab** to cycle through your enabled models. The current model appears in the status bar.

### One-Off Query

```bash
yolo -q "What is TypeScript?"
```

### Specify Model

```bash
yolo -m anthropic/claude-3-opus -q "Explain quantum computing"
```

### Continue Previous Session

```bash
yolo --continue
```

## Keyboard Shortcuts

### Input Navigation
| Key | Action |
|-----|--------|
| **Enter** | Send message |
| **Shift+Enter** | Insert newline |
| **←/→** | Move cursor left/right |
| **Cmd/Ctrl+←** | Move to start of line |
| **Cmd/Ctrl+→** | Move to end of line |
| **Ctrl+A** | Move to start of line (Unix-style) |
| **Ctrl+E** | Move to end of line (Unix-style) |
| **Backspace** | Delete character before cursor |

### Application Controls
| Key | Action |
|-----|--------|
| **Ctrl+C** | Interrupt streaming request |
| **Ctrl+D** | Exit YOLO CLI |
| **Shift+Tab** | Cycle through AI models |

### Autocomplete
| Key | Action |
|-----|--------|
| **Tab** | Complete command or file path (when typing `/` or `@`) |
| **↑/↓** | Navigate autocomplete suggestions |
| **Esc** | Cancel autocomplete |
| **Enter** | Accept suggestion and execute |

## Slash Commands

YOLO CLI supports slash commands with intelligent autocomplete. Type `/` to see available commands:

| Command | Alias | Description |
|---------|-------|-------------|
| `/model` | `/models` | Select or change AI model |
| `/clear` | `/reset` | Clear conversation history (with confirmation) |
| `/new` | - | Start a new session in current directory |
| `/compact` | - | Summarize long conversations to reduce context |
| `/version` | - | Show YOLO CLI version |
| `/help` | `/h`, `/?` | Show available commands |
| `/exit` | `/quit` | Exit YOLO CLI |

**Command Autocomplete**: Type `/` to trigger intelligent autocomplete. Use arrow keys to navigate, Tab or Enter to complete, and Esc to cancel. Autocomplete filters commands as you type (e.g., `/cl` shows `/clear`).

**File Path Mentions**: Type `@` to trigger file path autocomplete. Start typing a file name or path to see matching files from your current directory. Use arrow keys to navigate, Tab to complete, and Esc to cancel. For short queries (< 3 characters), only top-level files are shown. For longer queries or paths containing `/`, all matching files are displayed.

**Multi-Session Support**: The `/new` command creates additional session files in `.yolo/history-{uuid}.jsonl` format, allowing you to maintain multiple independent conversations in the same directory.

**Conversation Compaction**: When conversations exceed 20 messages, use `/compact` to summarize older messages while preserving recent context. This reduces token usage and keeps conversations within context limits.

## Configuration

Configuration is stored at:
- Linux/macOS: `~/.config/yolo-cli/config.json`
- Windows: `~/.yolo-cli/config.json`

Conversation history is saved in `.yolo/history.jsonl` in each working directory.

### MCP Server Configuration

YOLO CLI supports automatic loading of Model Context Protocol (MCP) servers for extended tool capabilities. Configure MCP servers once and they'll load automatically on startup.

**Global MCP Configuration** (applies to all projects):
- Linux/macOS: `~/.config/yolo-cli/mcp.json`
- Windows: `~/.yolo-cli/mcp.json`

**Project-specific MCP Configuration**:
- `.yolo/mcp.json` in your project directory

Example `mcp.json`:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your_token_here"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"]
    }
  }
}
```

For detailed MCP configuration guide, see [MCP Quickstart](./specs/003-auto-mcp-config/quickstart.md).

## Development

```bash
# Clone repository
git clone https://github.com/your-org/yolo-cli.git
cd yolo-cli

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## Documentation

- **Quickstart Guide**: [YOLO CLI Quickstart](./specs/001-openrouter-cli/quickstart.md)
- **Slash Commands**: [Slash Commands Guide](./specs/004-slash-commands/quickstart.md)
- **MCP Configuration**: [MCP Quickstart](./specs/003-auto-mcp-config/quickstart.md)
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md)

## License

MIT

## Support

- **Documentation**: [Full Docs](./specs/001-openrouter-cli/)
- **Issues**: [GitHub Issues](https://github.com/your-org/yolo-cli/issues)
- **OpenRouter**: [OpenRouter Docs](https://openrouter.ai/docs)
