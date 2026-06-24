---
name: read-working-memory
description: Load the Nowledge Mem Working Memory briefing at Proma session start, after a break, or when recent context would help the current task.
---

# Read Working Memory

Read Context Bundle for full Proma startup context when available: owner identity, AI Identity, active scope, active rules, and Working Memory. Read Working Memory alone when you only need current priorities.

Proma's lifecycle hook also writes startup context into the workspace `CLAUDE.md` inside a `nowledge-mem:start` / `nowledge-mem:end` block. Treat that block as the automatic startup layer; call MCP or CLI when you need fresh or more specific retrieval during the session.

## When to Use

**Session start**: beginning a new Proma conversation, returning after a break, or when recent context would help.

**During session**: user asks about current work, references recent decisions, or says "what was I working on?"

**Skip if**: already loaded this session, user wants a fresh start, or the task is isolated and trivial.

## Usage

**Primary (MCP, full startup context)**:
```
mcp__nowledge-mem__read_context_bundle
```

**Lightweight MCP**:
```
mcp__nowledge-mem__read_working_memory
```

**CLI Context Bundle fallback**:
```bash
nmem --json context --source-app proma
```

**Working Memory fallback**:
```bash
nmem wm read
# or with JSON output:
nmem --json wm read
```

Add `--space "<space name>"` for space-aware lanes. Multi-agent orchestrators can set `NMEM_AGENT_ID="<agent-slug>"` before launching Proma. Add `NMEM_SPACE` only when that whole run should override the identity's default space. Use `NMEM_HOST_AGENT_ID` only for advanced external aliases.

## Content

The briefing includes: active focus areas ranked by activity, flagged priorities, unresolved flags, recent knowledge-base changes, and deep links to specific memories. Use `nowledgemem://` links to reference specific memories when relevant.

## Guidance

1. Read Context Bundle or Working Memory once at session start — don't re-read every turn
2. Reference context naturally — "you were working on X" not "your working memory shows X"
3. If Context Bundle was already loaded and includes Working Memory, do not read Working Memory again
4. Share only pertinent parts; don't dump the entire briefing
5. Cross-tool continuity: insights from Codex, Claude Code, or other tools also appear here

## Troubleshooting

If MCP tools are unavailable, verify `~/.proma/agent-workspaces/default/mcp.json` has the `nowledge-mem` server configured with key `"servers"`. For CLI fallback, install via `pip install nmem-cli` or use the Nowledge Mem desktop app.
