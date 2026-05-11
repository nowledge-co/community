# Read Working Memory

Read your daily Working Memory briefing to understand current context for Proma sessions.

## When to Use

**Session start**: beginning a new Proma conversation, returning after a break, or when recent context would help.

**During session**: user asks about current work, references recent decisions, or says "what was I working on?"

**Skip if**: already loaded this session, user wants a fresh start, or the task is isolated and trivial.

## Usage

**Primary (MCP)**:
```
mcp__nowledge-mem__read_working_memory
```

**Fallback (CLI)**:
```bash
nmem wm read
# or with JSON output:
nmem --json wm read
```

Add `--space "<space name>"` for space-aware lanes.

## Content

The briefing includes: active focus areas ranked by activity, flagged priorities, unresolved flags, recent knowledge-base changes, and deep links to specific memories. Use `nowledgemem://` links to reference specific memories when relevant.

## Guidance

1. Read once at session start — don't re-read every turn
2. Reference context naturally — "you were working on X" not "your working memory shows X"
3. Share only pertinent parts; don't dump the entire briefing
4. Cross-tool continuity: insights from Codex, Claude Code, or other tools also appear here

## Troubleshooting

If MCP tools are unavailable, verify `~/.proma/agent-workspaces/default/mcp.json` has the `nowledge-mem` server configured with key `"servers"`. For CLI fallback, install via `pip install nmem-cli` or use the Nowledge Mem desktop app.
