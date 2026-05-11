# Nowledge Mem (nmem) Skill for Proma

## Description
Provides persistent cross-session memory capabilities for Proma. nmem is Proma's "long-term memory" system -- remembering decisions, discussions, preferences, and context so future sessions can pick up where the last one left off.

Built-in MemOS memory (`mcp__mem__*`) is for short-term notes within the current session. nmem (`mcp__nowledge-mem__*`) is for cross-session persistence.

## Triggers

### Automatic
When the user expresses these intents, use nmem tools proactively:

| Intent | Tool | Example |
|--------|------|---------|
| Save memory | `mcp__nowledge-mem__add_memory` | "Remember this config", "This will be useful later" |
| Search memory | `mcp__nowledge-mem__search_memories` | "How did we solve this before?", "What did we discuss last time?" |
| Read working memory | `mcp__nowledge-mem__read_working_memory` | "What was I working on?", "Where did I leave off?" |
| Save session | `mcp__nowledge-mem__save_thread` | "Save this conversation", "Archive this session" |
| Check status | `mcp__nowledge-mem__status` | "nmem status" |

### Proactive behaviors (no user instruction needed)
- **Session start**: Automatically read Working Memory and mention recent focus areas
- **After key decisions**: Distill conclusions to nmem Memories
- **When user says "before", "last time", "we discussed"**: Search nmem first, then built-in memory

### Slash commands
- `/nmem-save` -- Manually save current session thread
- `/nmem-search <query>` -- Search memories
- `/nmem-status` -- Check nmem connection and working memory summary

## Usage Rules

1. nmem = long-term persistence; MemOS = short-term within-session
2. Search both nmem and MemOS; prefer nmem results for cross-session context
3. Save memories with enough context for your future self (or another AI) to understand
4. Fall back to built-in MemOS tools if nmem tools are unavailable
5. Don't store one-off, non-reusable information in nmem
