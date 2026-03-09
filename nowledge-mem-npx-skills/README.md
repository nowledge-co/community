# Nowledge Mem Skills for AI Coding Agents

> Install Nowledge Mem skills on any supported AI coding agent using `npx skills add`.

[![npx skills](https://img.shields.io/badge/npx-skills-blue)](https://github.com/vercel-labs/add-skill)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Supported-green)](https://claude.ai/code)
[![Cursor](https://img.shields.io/badge/Cursor-Supported-green)](https://cursor.sh)

## Overview

These skills extend your AI coding agent with persistent memory capabilities powered by [Nowledge Mem](https://mem.nowledge.co):

- **Search Memory** - Automatically route recall across distilled memories and prior discussion threads
- **Read Working Memory** - Load your daily briefing at session start for cross-tool continuity
- **Save Handoff** - Leave resumable handoff summaries in generic agent environments
- **Distill Memory** - Capture breakthrough moments as searchable insights

## Installation

### Quick Install (All Skills)

```bash
npx skills add nowledge-co/community/nowledge-mem-npx-skills
```

### Install Specific Skills

```bash
# List available skills
npx skills add nowledge-co/community/nowledge-mem-npx-skills --list

# Install specific skill
npx skills add nowledge-co/community/nowledge-mem-npx-skills --skill search-memory

# Install to specific agent
npx skills add nowledge-co/community/nowledge-mem-npx-skills -a claude-code
```

### Supported Agents

The `skills` CLI automatically detects and installs to:

- Claude Code
- Cursor
- OpenCode
- Codex
- And 20+ more agents

## Prerequisites

### 1. nmem CLI

Choose one installation method:

**Option 1: uvx (Recommended - No Installation Required)**

```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run nmem directly (downloads automatically)
uvx --from nmem-cli nmem --version
```

**Option 2: pip**

```bash
pip install nmem-cli
nmem --version
```

### 2. Nowledge Mem Server

Ensure the Nowledge Mem server is running at `http://localhost:14242`.

- **Desktop App**: Server runs automatically
- **Manual**: See [documentation](https://mem.nowledge.co/docs)

### 3. Verify Setup

```bash
nmem status
```

## Skills

### Search Memory (`search-memory`)

Automatically searches your knowledge base when past insights would improve the response.

**Activates when:**
- You reference past work: "Like we did last time..."
- You ask for recall: "What was that pattern?"
- Context suggests prior solutions exist

**Example:**
```
You: I'm getting that authentication error again

Agent: [Automatically searches knowledge base]
Found it! We solved this 2 weeks ago. The issue was token expiration...
```

### Save Handoff (`save-handoff`)

Saves a structured resumable handoff for future reference.

**Activates when you say:**
- "Save this session"
- "Checkpoint this"
- "Remember this conversation"

**Example:**
```
You: Save this session - implemented JWT authentication

Agent: ✓ Handoff saved
Title: Session Handoff - JWT authentication
Summary: Goal, Decisions, Files, Risks, Next
Thread ID: generic-agent-abc123
```

### Read Working Memory (`read-working-memory`)

Loads your daily Working Memory briefing at session start so the agent knows your current context.

**Activates at:**
- The start of a new session
- When you ask about current priorities or recent work

**Example:**
```
[Agent reads Working Memory at session start]

Agent: I see you're focused on the auth migration and have an
unresolved flag about the session handling approach. Want me to
pick up where you left off?
```

### Distill Memory (`distill-memory`)

Recognizes breakthrough moments and captures them as searchable memories.

**Activates during:**
- Debugging breakthroughs
- Important decisions
- Lessons learned

**Example:**
```
Agent: This debugging insight seems valuable - React hooks cleanup
must return function to prevent memory leaks. Distill into memory?

You: Yes

Agent: ✓ Memory saved with importance 0.9
```

## Usage Examples

### Search Your Knowledge

```bash
# Via CLI
nmem --json m search "React patterns"

# In conversation
"What do I know about database optimization?"
```

### Memory Lifecycle

The reusable skills follow the same core flow as the richer native integrations: read Working Memory, route recall across memories and threads, save a resumable handoff when asked, and distill durable knowledge.

## Make Agents Use Memory Proactively

Native integrations like Claude Code, Gemini CLI, Cursor, OpenClaw, and Alma already bundle the behavioral guidance that teaches the agent when to read context, search, or save.

For less common agents, custom harnesses, or environments that only see `nmem`, skills, or MCP tools, you should add explicit intent guidance in `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, or the system prompt.

### Step 1: Give The Agent A Memory Surface

Use one of these:

- `npx skills` for shared skill-based behavior
- `nmem` CLI for terminal-visible commands
- MCP when the client can call tools directly

### Step 2: Add An Intent Policy

For CLI or skill-driven agents, paste a policy like this into `AGENTS.md` or your system prompt:

```markdown
## Nowledge Mem

Use Nowledge Mem as your external memory system.

At session start:
- Run `nmem --json wm read` once to load current priorities and recent context.
- Do not re-read it on every turn unless the user asks or the session context changed materially.

Search proactively when:
- the user references previous work, a prior fix, or an earlier decision
- the task resumes a named feature, bug, refactor, or subsystem
- a debugging pattern resembles something solved earlier
- the user asks for rationale, preferences, procedures, or recurring workflow details

Retrieval routing:
- Start with `nmem --json m search` for durable knowledge.
- Use `nmem --json t search` when the user is asking about a prior discussion or exact conversation history.
- If a memory result includes `source_thread`, inspect that conversation progressively with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.

When preserving knowledge:
- Use `nmem --json m add` for genuinely new durable knowledge.
- If an existing memory already captures the same decision, preference, or workflow and the new information refines it, use `nmem m update <id> ...` instead of creating a duplicate.
- Use a handoff save only when the user explicitly asks for a resumable checkpoint or handoff summary.
```

For MCP-only agents, use the same policy but replace the commands with the tool names `read_working_memory`, `memory_search`, `thread_search`, `thread_fetch_messages`, `memory_add`, and `memory_update`.

### Step 3: Keep The Prompt Direct

The best intent prompts are short and operational. Tell the agent exactly:

- when to read Working Memory
- when to search proactively
- when to use thread tools instead of memory search
- when to add a new memory versus update an existing one
- when handoff save is explicit-only

### Save a Handoff

```bash
# Via CLI
nmem --json t create -t "Session Handoff - auth refactor" -c "Goal: finish auth refactor. Decisions: keep refresh verification in the API layer. Files: auth.ts, auth.test.ts. Risks: remote expiry path still unverified. Next: run the remote flow." -s generic-agent

# In conversation
"Save a handoff for this debugging session"
```

### Create a Memory

```bash
nmem m add "PostgreSQL over MongoDB: ACID needed for transactions" \
  -t "Database: PostgreSQL for ACID" \
  -i 0.9 --unit-type decision -l database -l architecture
```

## Alternative Installation

### Claude Code Plugin (Full Featured)

For Claude Code users, the full plugin with slash commands and real session import is also available:

```bash
claude plugin marketplace add nowledge-co/community
claude plugin install nowledge-mem@nowledge-community
```

See [nowledge-mem-claude-code-plugin](../nowledge-mem-claude-code-plugin) for details.

## Links

- [Documentation](https://mem.nowledge.co/docs)
- [Nowledge Mem](https://mem.nowledge.co)
- [Discord Community](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

---

**Made with care by [Nowledge Labs](https://nowledge-labs.ai)**
