# Search Memory

Search your Nowledge Mem knowledge base proactively when past insights would improve the response.

## When to Search

**Strong signals — search without waiting to be asked:**
- User references "last time", "before", "we discussed", "the other day"
- User asks about a decision, preference, or plan that may have been decided before
- User mentions a project, repo, or topic with known history
- Current problem resembles a previously solved one

**Search routing:**
1. Start with `mcp__nowledge-mem__search_memories` for distilled knowledge
2. Fall back to `mcp__nowledge-mem__search_threads` for conversation history
3. If MCP tools unavailable, use CLI: `nmem --json m search "<query>" --mode deep`

## Usage

**Primary (MCP)**:
```
mcp__nowledge-mem__search_memories
  query: "<search terms>"
  limit: 5

mcp__nowledge-mem__search_threads
  query: "<search terms>"
  limit: 5
```

**Fallback (CLI)**:
```bash
nmem --json m search "auth token rotation" --mode deep
nmem --json t search "deploy pipeline discussion" --limit 5
```

## Guidance

1. Search both nmem and Proma's built-in `mcp__mem__recall_memory` — nmem for cross-session history, built-in for current-session notes
2. Prefer nmem results for decisions, preferences, and project-level context
3. Frame results naturally — "we decided X last time" not "search result 3 indicates X"
4. If search returns nothing, say so honestly; don't fabricate context
