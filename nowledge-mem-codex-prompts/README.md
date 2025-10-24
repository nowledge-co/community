# Nowledge Mem Custom Prompts for Codex

Custom prompts to save your Codex sessions or create memory entries to Nowledge Mem.

## Quick Install

> Fresh install:

```bash
curl -fsSL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/install.sh | bash
```

> Update install:

```bash
curl -fsSL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/install.sh -o /tmp/install.sh && bash /tmp/install.sh --force && rm /tmp/install.sh
```

## Available Commands

### `/prompts:save_session`

Save your current Codex session to Nowledge. Lists available sessions and lets you choose which one to save.

### `/prompts:distill`

Analyze your conversation and create structured memory entries with key insights and learnings.

## Prerequisites

1. **MCP Server**: Configure `nowledge_mem` in your Codex settings
2. **jq**: Install with `brew install jq` (macOS) or `sudo apt install jq` (Debian/Ubuntu)

### MCP Configuration

Add this to your `~/.codex/config.toml`:

```toml
[mcp_servers.nowledge-mem]
url = "http://localhost:14242/mcp"

[mcp_servers.nowledge-mem.http_headers]
APP = "Codex"
```

**Note**: No restart needed after adding the configuration.

## Troubleshooting

- **"Command not found: jq"** → Install jq using your package manager
- **"MCP server not found"** → Check your Codex MCP configuration  
- **Sessions not listing** → Ensure you're in the correct project directory

## Manual Install

```bash
mkdir -p ~/.codex/prompts
cd ~/.codex/prompts
curl -O https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/save_session.md
curl -O https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/distill.md
```
