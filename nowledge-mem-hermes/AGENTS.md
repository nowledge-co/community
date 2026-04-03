# Nowledge Mem for Hermes

**Core behavior: Read Working Memory at session start. Search proactively when past context would help. Save decisions and learnings without being asked.**

You have access to the user's cross-tool knowledge graph through MCP tools from the `nowledge-mem` server. In Hermes, these tools appear with the `mcp_nowledge_mem_` prefix (e.g., `mcp_nowledge_mem_memory_search`). The guidance below uses the base tool names for readability.

**Nowledge Mem vs Hermes built-in memory:** Hermes' built-in memory stores Hermes-specific facts (env details, tool quirks). Nowledge Mem stores cross-tool knowledge: decisions, procedures, and learnings that future sessions in any tool should know about. Use both. When in doubt about where to save, ask: "Would this matter in a Claude Code, Cursor, or Codex session?" If yes, save to Nowledge Mem.

## Working Memory

At session start, load the user's current context:

```
read_working_memory
```

This returns priorities, recent decisions, and open questions. If relevant items relate to the current task, mention them briefly. If it returns empty, note there is no briefing yet and continue.

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
memory_search query="your search query"
```

For past conversations specifically:

```
thread_search query="your search query"
thread_fetch_messages thread_id="<id>" limit=8
```

## Saving Knowledge

Save proactively when the conversation produces a decision, procedure, learning, or important context. Do not wait to be asked.

Before calling `memory_add`, do a quick `memory_search` with the key concept. If a matching memory exists, use `memory_update` instead.

```
memory_add content="What was decided and why" title="Descriptive title" unit_type="decision" labels=["relevant-label"] importance=0.8
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
memory_update memory_id="<existing_id>" content="Updated content with new information"
```

Remove memories that are outdated or incorrect:

```
memory_delete memory_id="<id>"
```

Prefer updating over deleting when the core insight is still valid.

## Graph Exploration

When a memory is relevant but you need broader context:

```
memory_neighbors memory_id="<id>"
memory_evolves_chain memory_id="<id>"
```

`memory_neighbors` discovers related memories and entities. `memory_evolves_chain` traces how a decision or understanding changed over time.

## Thread Tools

Save the current conversation when the user asks:

```
thread_persist summary="Brief description of what was discussed"
```

Be transparent: `thread_persist` creates a structured save based on Hermes' session context. The completeness of the captured transcript depends on what Hermes passes to MCP. This is not guaranteed to be a verbatim record of every message.

Browse past conversations to recover context:

```
thread_search query="topic from a previous session"
thread_fetch_messages thread_id="<id>" limit=8
```

## Labels

Use `list_memory_labels` to see existing categories before creating new labels. Reuse existing labels when they fit. Apply 1 to 3 labels per memory. Prefer broad categories (e.g., `architecture`, `product-strategy`) over narrow ones.
