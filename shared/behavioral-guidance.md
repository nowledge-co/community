# Nowledge Mem — Shared Behavioral Guidance

> Canonical reference for how agents should use Nowledge Mem. All plugin skills, behavioral hooks, and AGENTS.md files should align their language with this document.

---

## 1. Working Memory

Read your Working Memory briefing once near the start of each session to understand the user's current context.

```bash
nmem --json wm read
```

**When to read:**
- Beginning of a new conversation
- Returning to a project after a break
- When the user asks about current priorities, context, or recent work

**When to skip:**
- Already loaded this session
- User explicitly wants a fresh start
- Working on an isolated, context-independent task

**How to use:**
- Reference naturally — mention relevant context when it connects to the current task
- Share only the parts relevant to what the user is working on
- Do not re-read unless the user asks or the session context changes materially

---

## 2. Proactive Search

Search your knowledge base proactively when past insights would improve the response. Do not wait for the user to say "search my memory".

**Strong signals — search when:**
- The user references previous work, a prior fix, or an earlier decision
- The task resumes a named feature, bug, refactor, incident, or subsystem
- A debugging pattern resembles something solved earlier
- The user asks for rationale, preferences, procedures, or recurring workflow details
- The user uses implicit recall language: "that approach", "like before", "the pattern we used"

**Contextual signals — consider searching when:**
- Complex debugging where prior context would narrow the search space
- Architecture discussion that may intersect with past decisions
- Domain-specific conventions the user has established before
- The current result is ambiguous and past context would make the answer sharper

**When NOT to search:**
- Fundamentally new topic with no prior history
- Generic syntax or API questions answerable from documentation
- User explicitly asks for a fresh perspective without prior context

---

## 3. Retrieval Routing

1. Start with `nmem --json m search "<query>"` for durable knowledge (decisions, insights, procedures).
2. Use `nmem --json t search "<query>"` when the user is asking about a prior conversation or exact session history.
3. If a memory result includes `source_thread`, inspect the original conversation progressively with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.
4. Prefer the smallest retrieval surface that answers the question — do not over-fetch.
5. If initial results are weak or conceptual, try `--mode deep` for broader matching.

---

## 4. Autonomous Save

**Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked.**

Good candidates:
- Decisions with rationale ("we chose PostgreSQL because ACID is required")
- Repeatable procedures or workflows
- Lessons from debugging, incidents, or root cause analysis
- Durable preferences or constraints
- Plans that future sessions will need to resume
- Important context that would be lost when the session ends

**Quality bar:**
- Importance 0.8–1.0: major decisions, architectural choices, critical learnings
- Importance 0.5–0.7: useful patterns, conventions, secondary decisions
- Importance 0.3–0.4: minor notes, preferences, contextual observations

**Skip:**
- Routine fixes with no generalizable lesson
- Work in progress that will change before it matters
- Simple Q&A answerable from documentation
- Generic information already widely known

**Format:**
- Use structured saves: `--unit-type` (decision, procedure, learning, preference, event), `-l` labels, `-i` importance
- Atomic, standalone memories with strong titles and clear meaning
- Focus on what was learned or decided, not routine activity

---

## 5. Add vs Update

- Use `nmem --json m add` when the insight is genuinely new.
- If an existing memory already captures the same decision, workflow, or preference and the new information refines it, use `nmem m update <id> ...` instead of creating a duplicate.
- When in doubt, search first to check if a related memory exists.

---

## 6. Thread Save Honesty

Thread save capabilities depend on the runtime:

- **Real thread save**: use `nmem t save --from <runtime>` when the CLI has a built-in parser for the runtime (claude-code, codex, gemini-cli) or when the plugin implements its own session capture (OpenClaw, Alma, Bub).
- **Handoff save**: use `nmem --json t create -t "Session Handoff - <topic>" -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..." -s generic-agent` in generic environments where no real transcript importer exists.
- **Never fake it**: do not claim `save-thread` performs a real transcript import when the runtime does not support one. Users will believe later retrieval reflects the actual full session.
