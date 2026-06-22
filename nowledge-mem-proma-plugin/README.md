# Nowledge Mem Plugin for Proma

Connects [Proma](https://github.com/proma-ai/proma) to Nowledge Mem so Proma can:

- save Proma agent conversations into Nowledge Mem threads
- load Nowledge Mem context when a Proma workspace starts
- search and write memories through the Nowledge Mem MCP tools
- use the standard Nowledge Mem skills as a manual fallback

Proma is built on the Claude Agent SDK, but it keeps its own configuration under `~/.proma/`. Use the Proma paths below, not the Claude Code paths.

## Prerequisites

- Proma desktop app
- Nowledge Mem desktop app or remote server
- Python 3.9+ available as `python3`
- `nmem` CLI in PATH, or `uvx` available as fallback

Proma v0.13.0 and newer include a Nowledge Mem card in Proma's Memory settings. You can start from that card and let Proma copy the setup prompt into Agent mode. This package remains the source for the hook scripts, standard skills, and the exact `settings.json` contract.

The examples below use Proma's `default` workspace. If you use another workspace, replace `default` with the directory name under `~/.proma/agent-workspaces/`.
If your platform exposes Python only as `python`, replace `python3` with `python` in the hook commands below.

Check Nowledge Mem first:

```bash
nmem status
```

## Install

### 1. Configure MCP

Add Nowledge Mem to your Proma workspace MCP config.

Path:

```text
~/.proma/agent-workspaces/default/mcp.json
```

Local Nowledge Mem:

```json
{
  "servers": {
    "nowledge-mem": {
      "url": "http://127.0.0.1:14242/mcp/",
      "type": "streamableHttp",
      "headers": {
        "APP": "Proma"
      }
    }
  }
}
```

Remote Nowledge Mem:

```json
{
  "servers": {
    "nowledge-mem": {
      "url": "https://mem.example.com/mcp/",
      "type": "streamableHttp",
      "headers": {
        "APP": "Proma",
        "Authorization": "Bearer <your-nmem-api-key>",
        "X-NMEM-API-Key": "<your-nmem-api-key>"
      }
    }
  }
}
```

### 2. Install hook scripts

Copy the bundled hook scripts into Proma's script directory:

```bash
mkdir -p ~/.proma/scripts
cp hooks/save-to-nmem.py ~/.proma/scripts/
cp hooks/read-working-memory.py ~/.proma/scripts/
chmod +x ~/.proma/scripts/save-to-nmem.py ~/.proma/scripts/read-working-memory.py
```

### 3. Enable lifecycle hooks

Merge `hooks/hooks.json` into Proma's Claude SDK hook config:

```text
~/.proma/sdk-config/.claude/settings.json
```

The important pieces are:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$HOME/.proma/scripts/read-working-memory.py\"",
            "timeout": 15000
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$HOME/.proma/scripts/save-to-nmem.py\" --event user-prompt-submit",
            "timeout": 30000
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$HOME/.proma/scripts/save-to-nmem.py\" --event stop",
            "timeout": 30000
          }
        ]
      },
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$HOME/.proma/scripts/read-working-memory.py\" --rewake",
            "timeout": 15000,
            "async": true,
            "asyncRewake": true,
            "rewakeMessage": "Nowledge Mem context refreshed"
          }
        ]
      }
    ]
  }
}
```

The packaged `hooks/hooks.json` uses `$HOME/.proma` for the same reason. Proma sets `CLAUDE_CONFIG_DIR`, but it does not set `PROMA_HOME` for hook commands by default.

### 4. Install skills

Copy the standard Nowledge Mem skills into the Proma workspace:

```bash
mkdir -p ~/.proma/agent-workspaces/default/skills
cp -R skills/read-working-memory ~/.proma/agent-workspaces/default/skills/
cp -R skills/search-memory ~/.proma/agent-workspaces/default/skills/
cp -R skills/distill-memory ~/.proma/agent-workspaces/default/skills/
cp -R skills/save-thread ~/.proma/agent-workspaces/default/skills/
cp -R skills/status ~/.proma/agent-workspaces/default/skills/
```

### 5. Restart Proma

Restart Proma after changing MCP, hooks, or skills.

## What each part does

### Thread sync

`UserPromptSubmit` and `Stop` run `save-to-nmem.py`.

The script reads Proma's current transcript from:

```text
~/.proma/sdk-config/projects/<workspace-hash>/<session-id>.jsonl
```

It saves the conversation as a Nowledge Mem thread with source `proma`, message-level deduplication, and stable IDs. Older Proma builds that still write `~/.proma/agent-sessions/*.jsonl` remain supported as a fallback.

### Startup context

`SessionStart` runs `read-working-memory.py`.

Proma's current Claude Agent SDK does not reliably inject SessionStart stdout into the model context. To keep this path dependable, the script writes a marked Nowledge Mem block into:

```text
~/.proma/agent-workspaces/default/CLAUDE.md
```

If `CLAUDE.md` does not exist yet and `CLAUDE.md.template` exists in the same workspace, the script uses the template as the first base. After that, it preserves the existing `CLAUDE.md` and only adds or replaces this block:

```markdown
<!-- nowledge-mem:start -->
...
<!-- nowledge-mem:end -->
```

Keep your own Proma instructions outside that marked block, or in `CLAUDE.md.template`.

### Live Working Memory refresh

After each assistant turn, the asyncRewake Stop hook runs:

```bash
python3 "$HOME/.proma/scripts/read-working-memory.py" --rewake
```

When Nowledge Mem has useful Working Memory, the hook prints it and exits with code `2`, which lets Proma wake the agent with the latest reminder. Empty or unavailable context exits cleanly without interrupting the session.

### MCP tools

The MCP server gives Proma agent access to Nowledge Mem search, save, status, skills, and KFS tools. This is the intelligent retrieval path; lifecycle hooks are the automatic capture and startup-context path.

## Configuration

| Environment variable | Purpose | Default |
| --- | --- | --- |
| `NMEM_API_URL` | Nowledge Mem server URL | `~/.nowledge-mem/config.json` or `http://127.0.0.1:14242` |
| `NMEM_API_KEY` | Nowledge Mem API key | `~/.nowledge-mem/config.json` |
| `PROMA_HOME` | Proma home directory | `~/.proma` |
| `PROMA_PROJECTS_DIR` | Proma transcript directory | `~/.proma/sdk-config/projects` |
| `PROMA_ALLOWED_WORKSPACES` | Optional comma-separated workspace dir names whose sessions get synced to Nowledge Mem. Leave unset to sync every Proma workspace. Use `*` or `all` for an explicit allow-all value. | unset |
| `PROMA_WORKSPACE_DIR` | Proma workspace directory for `CLAUDE.md` | `~/.proma/agent-workspaces/default` |
| `PROMA_CLAUDE_MD` | Explicit `CLAUDE.md` output path | `<workspace>/CLAUDE.md` |
| `PROMA_CLAUDE_TEMPLATE` | Explicit template path | `<workspace>/CLAUDE.md.template` |

If you keep several Proma workspaces and only want Nowledge Mem to capture some of them, set:

```bash
export PROMA_ALLOWED_WORKSPACES="default,research"
```

The names are the directory names under `~/.proma/agent-workspaces/`.

Logs are written to:

```text
~/.proma/logs/nm-hooks.log
```

## Troubleshooting

**MCP tools do not show up**

- Proma uses `"servers"` as the top-level key in `mcp.json`, not `"mcpServers"`.
- Confirm the endpoint ends with `/mcp/`.
- Restart Proma after changing `mcp.json`.

**Hooks do not run**

- Check `~/.proma/sdk-config/.claude/settings.json`, not `~/.proma/settings.json`.
- Use absolute script paths if your Proma build does not expand environment variables.
- Check `~/.proma/logs/nm-hooks.log`.

**Proma starts but does not see Nowledge Mem context**

- Open `~/.proma/agent-workspaces/default/CLAUDE.md`.
- Confirm it contains a `<!-- nowledge-mem:start -->` block.
- Run `python3 ~/.proma/scripts/read-working-memory.py` manually and check the log.

**Threads are not saved**

- Confirm Proma is writing JSONL files under `~/.proma/sdk-config/projects/`.
- Run:

```bash
echo '{"session_id":"<session-id>"}' | python3 ~/.proma/scripts/save-to-nmem.py
```

- Then check Nowledge Mem for a thread with source `proma`.

## Development

Static tests:

```bash
uv run --with pytest pytest tests/plugin_e2e -q -k proma
```
