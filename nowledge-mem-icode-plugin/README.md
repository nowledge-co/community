# Nowledge Mem for iCode

> iCode (Chrys) agents start from current context, retrieve past work proactively, and save what is worth keeping — sharing one memory graph with Claude Code, Codex, Cursor, and every other Nowledge-connected tool.

iCode has no plugin marketplace. This package is a small installer that wires the three extension surfaces iCode does expose:

| Surface | What iCode gets |
|---------|-----------------|
| Agent-profile MCP block (`tools.mcp`) | The `nowledge-mem` HTTP MCP server with progressive disclosure: `memory_search`, `memory_add`, `memory_update`, and `read_context_bundle` visible at start; the rest of the tool set loadable on demand |
| `user_prompt_submit` hook | The Nowledge Mem Context Bundle injected as a system reminder on the first prompt of each session, plus a short recall/save reminder on later prompts |
| `~/.agents/skills` | The shared Nowledge skills: `read-working-memory`, `search-memory`, `distill-memory`, `save-handoff`, `check-integration`, `status` |

## Install

Requires `nmem` configured on this machine (`nmem doctor` passes), plus Python 3 with PyYAML for automated merging (without PyYAML the installer prints the exact blocks to paste manually).

```bash
bash -lc 'tmp="$(mktemp -d)" && git clone --depth 1 https://github.com/nowledge-co/community.git "$tmp/community" && python3 "$tmp/community/nowledge-mem-icode-plugin/scripts/install.py"'
```

Then **restart iCode** — agent profiles and hooks load at startup only.

Options: `--agent <Name>` (default `Code`) chooses the agent profile that gets the MCP server; `--force` overwrites existing skill directories; `--remove` uninstalls everything the installer created; `--dry-run` prints the manual blocks without touching config.

## Verify

1. `/agents` > the agent's MCP tab: a `nowledge-mem` card whose test reports the server and its tools.
2. Submit the first prompt in a fresh session: a `[Nowledge Mem]` context reminder joins the turn.

## What it does not do (honest limits)

- **No automatic full-thread capture.** iCode stores sessions under `~/.chrys/sessions/<short-id>/`, and no nmem transcript parser is registered for that format yet. Use the `save-handoff` skill for resumable session summaries, and `memory_add` for durable facts. When a parser lands upstream, this package will adopt it.
- **No slash commands.** iCode has no plugin command surface; the skills above cover the same actions.

## Remote or authenticated Mem

The installer generates the MCP block from `~/.nowledge-mem/config.json` (or `NMEM_API_URL`/`NMEM_API_KEY`). For remote deployments, cross-check with:

```bash
nmem config mcp show
```

and paste the generated headers into the `nowledge-mem` server block in `~/.chrys/agents/<Agent>.yaml` if they differ.

## Customize without forking

- **Behavior**: put repo-specific guidance in the project's `AGENTS.md` — iCode loads it as agent memory by default. Personal defaults belong in the agent profile's `instructions`.
- **Hook intensity**: `NMEM_ICODE_RECALL=first|every|off` controls the per-prompt reminder; `NMEM_ICODE_CONTEXT=off` disables the context injection. Disable the hook entirely by setting `enabled: false` on the `nowledge-mem-icode-context` entry in `~/.chrys/hooks/hooks.yaml`.
- Never edit files inside a marketplace clone; re-run the installer after updates instead.

## Uninstall

```bash
python3 scripts/install.py --remove
```

Uses the manifest written at `~/.chrys/nowledge-mem-icode-install.json`; timestamps backups (`*.nmem-bak`) of every file it modified are left in place.

## Development

```bash
uv run --with pytest --with pyyaml pytest nowledge-mem-icode-plugin/tests -q
```

from the community repo root.
