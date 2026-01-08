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

1. **nmem CLI**: Use `uvx nmem` (recommended) or install with `pip install nmem`
2. **jq**: Install with `brew install jq` (macOS) or `sudo apt install jq` (Debian/Ubuntu)

### nmem CLI Setup

**Option 1: uvx (Recommended - No Installation Required)**

Use `uvx` to run `nmem` without installing it:

```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run nmem directly (downloads automatically on first use)
uvx nmem --version
```

**Benefits:**
- No manual installation or updates needed
- Isolated from system Python
- Always uses the latest version
- Works on macOS, Linux, and Windows

**Option 2: pip/pipx (Traditional Installation)**

```bash
# Using pip
pip install nmem

# Or using pipx for isolated installation
pipx install nmem
```

Verify installation:

```bash
nmem --version
# or
uvx nmem --version
```

**Note**: 
- On Windows/Linux with Nowledge Mem Desktop app installed, `nmem` is bundled
- On macOS or when using Mem as a remote server, use `uvx` or install manually
- The CLI connects to your Nowledge Mem instance at `http://localhost:14242` by default

## Troubleshooting

- **"Command not found: uvx"** → Install uv with `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **"Command not found: nmem"** → Use `uvx nmem` or install with `pip install nmem`
- **"Command not found: jq"** → Install jq using your package manager
- **"Cannot connect to server"** → Ensure Nowledge Mem is running at `http://localhost:14242`
- **Sessions not listing** → Ensure you're in the correct project directory

## Manual Install

```bash
mkdir -p ~/.codex/prompts
cd ~/.codex/prompts
curl -O https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/save_session.md
curl -O https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/distill.md
```
