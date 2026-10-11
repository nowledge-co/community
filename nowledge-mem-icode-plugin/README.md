# Nowledge Mem for iCode

iCode (Chrys) can search and write Nowledge Mem through MCP, load current context on the first prompt, and save a handoff summary through shared skills. This is a Git-distributed installer, not a marketplace plugin.

iCode has no plugin marketplace. This package is a small installer that wires the three extension surfaces iCode does expose:

| Surface | What iCode gets |
|---------|-----------------|
| Agent-profile MCP block (`tools.mcp`) | The `nowledge-mem` HTTP MCP server with progressive disclosure: `memory_search`, `memory_add`, `memory_update`, and `read_context_bundle` visible at start; the rest of the tool set loadable on demand |
| `user_prompt_submit` hook | The Nowledge Mem Context Bundle injected as a system reminder on the first prompt of each session, plus a short recall/save reminder on later prompts |
| `~/.agents/skills` | The shared Nowledge skills: `read-working-memory`, `search-memory`, `distill-memory`, `save-handoff`, `check-integration`, `status` |

## Install

Install [iCode](https://github.com/openJiuwen-ai/iCode) (Python distribution: `icode-tui`), Git, and [uv](https://docs.astral.sh/uv/). Configure `nmem` for your chosen workspace and run `nmem doctor`.

In iCode, open `/agents`, select **Code**, and save the profile once. The installer requires a saved profile; it will not replace the built-in agent with an incomplete profile. Then run on macOS/Linux:

```bash
bash -lc 'tmp="$(mktemp -d)" && git clone --depth 1 https://github.com/nowledge-co/community.git "$tmp/community" && uv run --no-project --with pyyaml python "$tmp/community/nowledge-mem-icode-plugin/scripts/install.py"'
```

On Windows PowerShell, clone into a new directory and run:

```powershell
git clone --depth 1 https://github.com/nowledge-co/community.git nowledge-community
uv run --no-project --with pyyaml python nowledge-community/nowledge-mem-icode-plugin/scripts/install.py
```

Then **restart iCode**. uv supplies PyYAML without a global install. Without PyYAML, only a preview is printed and no files change.

Options: `--agent <Name>` selects another saved profile; `--force` explicitly replaces conflicting assets/configuration with backups; `--remove` removes unchanged managed assets; `--dry-run` prints redacted blocks without any writes. Custom paths use `--config-dir` and `--skills-root`. On Windows, iCode config lives under `%APPDATA%/chrys`.

## Verify

1. `/agents` > the agent's MCP tab: a `nowledge-mem` card whose test reports the server and its tools.
2. Submit the first prompt in a fresh session: a `[Nowledge Mem]` context reminder joins the turn.
3. Ask iCode to search for a known memory. A reminder alone does not prove the backend is connected.

## What it does not do (honest limits)

- **No automatic full-thread capture.** iCode stores sessions under `~/.chrys/sessions/<short-id>/`, and no nmem transcript parser is registered for that format yet. Use the `save-handoff` skill for resumable session summaries, and `memory_add` for durable facts. When a parser lands upstream, this package will adopt it.
- **No slash commands.** iCode has no plugin command surface; the skills above cover the same actions.

## Remote or authenticated Mem

The installer uses the same `apiUrl` and `apiKey` as the CLI (`~/.nowledge-mem/config.json`, or `NMEM_CLI_CONFIG_DIR/config.json`). Configure the CLI for your chosen Cloud workspace or your App's Nowledge Link / Access Anywhere address before installing. Remote endpoints require HTTPS and their matching API key. `NMEM_API_URL` and `NMEM_API_KEY` can override configuration together; a changed URL cannot silently reuse another endpoint's key. Cross-check with:

```bash
nmem config mcp show
```

The generated profile uses `exact-v1`, the external-agent tool set, and slim schemas. The key is written to the profile and installation receipt, never printed. Keep these files and their `*.nmem-bak` backups private. Re-run the installer after changing endpoints so MCP and the CLI agree. The hook inherits CLI configuration/environment; it does not read the MCP block.

## Customize without forking

- **Behavior**: put repo-specific guidance in the project's `AGENTS.md` — iCode loads it as agent memory by default. Personal defaults belong in the agent profile's `instructions`.
- **Hook intensity**: `NMEM_ICODE_RECALL=first|every|off` controls the per-prompt reminder; `NMEM_ICODE_CONTEXT=off` disables the context injection. Disable the hook entirely by setting `enabled: false` on the `nowledge-mem-icode-context` entry in `~/.chrys/hooks/hooks.yaml`.
- The hook tries Context Bundle then Working Memory within eight seconds total; errors do not block the prompt. `NMEM_ICODE_TIMEOUT_SECONDS` is clamped to 1–8 seconds. Warm up `nmem` separately if initial downloads exceed that budget.
- Later reminders guide search/save; they do not automatically perform a search. Repeat the installer to update. Edited MCP/hook entries are preserved by refusing an update unless you explicitly use `--force`.

## Uninstall

```bash
uv run --no-project --with pyyaml python nowledge-mem-icode-plugin/scripts/install.py --remove
```

Run from a community checkout. Removal uses ownership hashes in `nowledge-mem-icode-install.json`: unchanged managed assets are removed, prior entries/assets are restored, and user-edited or foreign skills are kept. Backups remain. Remove the old installation before selecting another profile or skills root. Restart iCode afterwards.

## Development

```bash
uv run --with pytest --with pyyaml pytest nowledge-mem-icode-plugin/tests -q
```

from the community repo root.
