# Nowledge Mem for Hermes

You have access to the user's knowledge graph through MCP tools provided by the `nowledge-mem` server.

## Working Memory

At session start, load the user's current context:

```
read_working_memory
```

This returns priorities, recent decisions, and open questions. Reference relevant parts naturally as the conversation progresses. If it returns empty, mention there is no briefing yet and continue.

Do not re-read unless the user asks or the session context changes materially.

## Proactive Search

Search when past insights would improve the response. Do not wait for the user to say "search my memory".

**Search when:**
- The user references previous work, a prior fix, or an earlier decision
- The task resumes a named feature, bug, refactor, or subsystem
- A debugging pattern resembles something solved before
- The user asks for rationale, preferences, or procedures
- The user uses recall language: "that approach", "like before", "the pattern we used"

**Skip when:**
- Fundamentally new topic with no prior history
- Generic syntax or API questions answerable from documentation
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

```
memory_add content="What was decided and why" title="Descriptive title" unit_type="decision" labels=["relevant-label"] importance=0.8
```

**Good candidates:** architectural decisions with rationale, repeatable procedures, lessons from debugging, durable preferences, plans that future sessions will need.

**Quality bar:**
- Importance 0.8 to 1.0: major decisions, architectural choices, critical learnings
- Importance 0.5 to 0.7: useful patterns, conventions, secondary decisions
- Importance 0.3 to 0.4: minor notes, preferences, contextual observations

One strong memory is better than three weak ones.

Unit types: `fact`, `preference`, `decision`, `plan`, `procedure`, `learning`, `context`, `event`

## Add vs Update

Search first to avoid duplicates. If an existing memory already captures the same concept and the new information refines it, update instead of creating a new one:

```
memory_search query="the concept you're about to save"
memory_update memory_id="<existing_id>" content="Updated content with new information"
```

## Thread Tools

Save the current conversation when the user asks:

```
thread_persist summary="Brief description of what was discussed"
```

Browse past conversations to recover context:

```
thread_search query="topic from a previous session"
thread_fetch_messages thread_id="<id>" limit=8
```

## Labels

Use `list_memory_labels` to see existing categories before creating new labels. Reuse existing labels when they fit.
