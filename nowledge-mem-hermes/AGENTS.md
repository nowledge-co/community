# Nowledge Mem for Hermes

**Core behavior: Read Working Memory at session start. Search proactively when past context would help. Save decisions and learnings without being asked.**

You have access to the user's cross-tool knowledge graph through six tools. In plugin mode these have the `nmem_` prefix. In MCP mode they appear as `mcp_nowledge_mem_*`. The guidance below uses plugin-mode names.

**Nowledge Mem vs Hermes built-in memory:** Hermes' built-in memory stores Hermes-specific facts (env details, tool quirks). Nowledge Mem stores cross-tool knowledge: decisions, procedures, and learnings that future sessions in any tool should know about. Use both. When in doubt about where to save, ask: "Would this matter in a Claude Code, Cursor, or Codex session?" If yes, save to Nowledge Mem.

## Working Memory

At session start, load the user's current context. The plugin injects this automatically via the system prompt. If it's empty, note there is no briefing yet and continue.

Do not re-read unless the user asks or the session context changes materially.

## Proactive Search

Search when past insights would improve the response. Do not wait for the user to say "search my memory".

**Search when:**
- The user references previous work, a prior decision, or an earlier conversation
- The task connects to a named project, initiative, or recurring topic
- A question resembles something discussed or resolved before
- The user asks for rationale, preferences, or established procedures
- The user uses recall language: "that approach", "like before", "the thing we decided"

**Skip when:**
- Fundamentally new topic with no prior history
- Generic factual questions answerable from general knowledge
- User explicitly asks for a fresh perspective

```
nmem_search query="your search query"
```

For past conversations specifically:

```
nmem_thread_search query="your search query"
nmem_thread_messages thread_id="<id>" limit=8
```

## Saving Knowledge

Save proactively when the conversation produces a decision, procedure, learning, or important context. Do not wait to be asked.

**Upsert by ID:** Pass a stable `id` to `nmem_save` to create-or-update in one call. If a memory with that ID already exists it is updated; otherwise a new one is created. Use this when you have a natural key (e.g. topic or decision name) instead of the search-then-update dance.

Without an `id`, search first with `nmem_search`. If a matching memory exists, use `nmem_update` instead.

```
nmem_save content="What was decided and why" title="Descriptive title" unit_type="decision" labels="relevant-label" importance=0.8
```

**Good candidates:** decisions with rationale, repeatable procedures, lessons from experience, durable preferences, plans that future sessions will need.

**Skip saving:** transient debugging details, information the user marked as temporary, facts already well-captured in existing memories, generic knowledge that any LLM already knows.

**Quality bar:**
- Importance 0.8 to 1.0: major decisions, critical learnings, core preferences
- Importance 0.5 to 0.7: useful patterns, conventions, secondary decisions
- Importance 0.3 to 0.4: minor notes, observations, contextual details

One strong memory is better than three weak ones.

Unit types: `fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`

## Updating and Deleting

Update when the new information refines an existing memory:

```
nmem_update memory_id="<existing_id>" content="Updated content with new information"
```

Remove memories that are outdated or incorrect:

```
nmem_delete memory_id="<id>"
```

Prefer updating over deleting when the core insight is still valid.

## Thread Tools

Browse past conversations to recover context:

```
nmem_thread_search query="topic from a previous session"
nmem_thread_messages thread_id="<id>" limit=8
```

## Additional MCP Tools

In MCP mode, additional graph exploration tools are available: `memory_neighbors` discovers related memories and entities, `memory_evolves_chain` traces how a decision changed over time, and `list_memory_labels` shows existing categories. These are not available in plugin mode.
