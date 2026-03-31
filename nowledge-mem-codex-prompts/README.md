# Nowledge Mem for Codex CLI

> **Deprecated**: This custom prompts package has been superseded by the **[Codex Plugin](../nowledge-mem-codex-plugin/)**. The plugin provides the same capabilities as composable Codex skills with proper plugin lifecycle support. See the [migration guide](https://mem.nowledge.co/docs/integrations/codex-cli#migrating-from-custom-prompts) for details.

> Memory-aware custom prompts for Codex CLI, with an optional project `AGENTS.md` companion for stronger default behavior.

Codex does not yet have the same packaged extension surface as Gemini CLI. The stable Codex-native path today is:

- install reusable custom prompts in `~/.codex/prompts`
- optionally merge this package's `AGENTS.md` into your project root
- let `nmem` handle local and remote memory operations directly

That keeps the integration sharp, durable, and easy to reason about.

## Memory Lifecycle

This package follows the same core flow as the richer native integrations:

1. read Working Memory for current priorities
2. route recall across memories and threads
3. save the real session when the user asks
4. distill durable knowledge from the work

## Quick Install

Fresh install:

```bash
curl -fsSL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/install.sh | bash
```

Update install:

```bash
curl -fsSL https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/install.sh -o /tmp/install.sh && bash /tmp/install.sh --force && rm /tmp/install.sh
```

## What You Get

### Custom prompts

- `/prompts:read_working_memory`
- `/prompts:search_memory`
- `/prompts:save_session`
- `/prompts:distill`

### Project guidance

- `AGENTS.md` you can copy or merge into your project root to teach Codex when to read Working Memory, search memory, distill high-value insights, and save real sessions.

## Recommended Setup

### 1. Make sure `nmem` is available

If Nowledge Mem is already running on the same machine through the desktop app, the cleanest setup is **Settings -> Preferences -> Developer Tools -> Install CLI**.

You can also install `nmem` standalone:

```bash
# Option 1: uvx
curl -LsSf https://astral.sh/uv/install.sh | sh
uvx --from nmem-cli nmem --version

# Option 2: pip
pip install nmem-cli
```

Verify it:

```bash
nmem status
```

### 2. Configure remote Mem the durable way when needed

Preferred long-term remote setup:

```json
{
  "apiUrl": "https://mem.example.com",
  "apiKey": "nmem_your_key"
}
```

Save it to:

```text
~/.nowledge-mem/config.json
```

`nmem` resolves connection settings in this order:

1. `--api-url`
2. `NMEM_API_URL` / `NMEM_API_KEY`
3. `~/.nowledge-mem/config.json`
4. defaults

### 3. Optionally merge `AGENTS.md` into your project

If your project already has an `AGENTS.md`, merge the Nowledge section into it instead of overwriting the file.

## Manual Install

Install prompts:

```bash
mkdir -p ~/.codex/prompts
cd ~/.codex/prompts
curl -O https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/read_working_memory.md
curl -O https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/search_memory.md
curl -O https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/save_session.md
curl -O https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/distill.md
```

Then copy or merge the project guidance file:

```bash
curl -O https://raw.githubusercontent.com/nowledge-co/community/main/nowledge-mem-codex-prompts/AGENTS.md
```

## Troubleshooting

- **"Command not found: uvx"** → Install uv with `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **"Command not found: nmem"** → Use `uvx --from nmem-cli nmem ...` or install with `pip install nmem-cli`
- **"Cannot connect to server"** → Check `nmem status` and verify `~/.nowledge-mem/config.json` for remote setups
- **Prompts do not appear in Codex** → Restart Codex CLI after installation
- **Sessions not listing** → Make sure you are saving from the same project directory used in Codex
