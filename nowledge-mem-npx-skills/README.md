# Nowledge Mem Skills for AI Coding Agents

> Install Nowledge Mem skills on any supported AI coding agent using `npx skills add`.

[![npx skills](https://img.shields.io/badge/npx-skills-blue)](https://github.com/vercel-labs/add-skill)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Supported-green)](https://claude.ai/code)
[![Cursor](https://img.shields.io/badge/Cursor-Supported-green)](https://cursor.sh)

## Overview

These skills extend your AI coding agent with persistent memory capabilities powered by [Nowledge Mem](https://mem.nowledge.co):

- **Search Memory** - Automatically route recall across distilled memories and prior discussion threads
- **[Explore Graph](skills/explore-graph/SKILL.md)** - Show focused graphs of retrieved memories and explore related nodes one hop at a time
- **Read Working Memory** - Load your daily briefing at session start for cross-tool continuity
- **Save Handoff** - Leave resumable handoff summaries in generic agent environments
- **Save Thread (Deprecated Compatibility)** - Preserved for users who already installed the old skill name; in generic runtimes it must degrade honestly to a handoff, not claim lossless transcript import
- **Distill Memory** - Capture breakthrough moments as searchable insights, with proactive save guidance
- **Check Integration** - Detect your agent, verify setup, and guide native connector setup for richer features
- **Status** - Check Nowledge Mem connection, server version, CLI version, and configuration

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

# Add the graph fallback and progressive exploration skill
npx skills add nowledge-co/community/nowledge-mem-npx-skills --skill explore-graph

# Install to specific agent
npx skills add nowledge-co/community/nowledge-mem-npx-skills -a claude-code
```

### Supported Agents

The `skills` CLI automatically detects and installs to:

- Claude Code
- Cursor
- OpenCode
- Codex
- Gemini CLI and Antigravity 2.0, using Gemini's current global skills folder at `~/.gemini/config/skills`
- And 20+ more agents

If you previously connected Gemini-family skills through `~/.gemini/skills` or
`~/.gemini/antigravity/skills`, update the skills installer or reconnect skills
from the Mem app. New links should live under `~/.gemini/config/skills`, which
is the location Antigravity 2.0 reads.

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

**Option 3: Arch Linux AUR**

```bash
yay -S nmem-cli
# or: paru -S nmem-cli
nmem --version
```

Package: https://aur.archlinux.org/packages/nmem-cli

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

Search uses Normal mode for bounded recall, Deep for conceptual or weak-result
questions, and Progressive when the user wants to follow relationships from an
exact Memory ID. Non-empty Memory results automatically trigger a focused graph;
thread-only and empty results do not. Install `explore-graph` alongside
`search-memory` when selecting skills individually to include its fallback and
progressive exploration instructions.

### Explore Graph (`explore-graph`)

Shows the exact retrieved Memory IDs in ranked order, normally with
`depth=1` and `limit=15`. It can also start from a selected Memory and expand one hop
at a time, bounded to 5 hops and 20 neighbors per hop by default.

The skill prefers an inline MCP App when the host exposes `explore_graph` and
supports rendering it. Otherwise, it uses `nmem --json status` to construct a
focused standalone graph URL, preserving the full API base (including path
prefixes) in `base_url`. A host with verified browser identity and scope can
open a local graph or return a link. Remote links require the browser's existing
authenticated session. API keys never appear in links. CLI-only hosts have no
automatic browser or link fallback because they cannot verify that session;
they retain the successful search results and explain the limitation.

Graph viewing requires the same owner/member permissions and space as retrieval;
exact result IDs alone do not provide access control. For Space- or
Team-restricted searches, the graph surface must be confirmed to enforce those
restrictions. Browser links also require confirmation of the browser's identity
and active space, which the CLI configuration does not establish. If those checks
are unavailable, or a required tool fails, the agent skips the graph and keeps
the successful search results. A dedicated native connector is optional.

### Save Handoff (`save-handoff`)

Saves a structured resumable handoff for future reference. This is the preferred save surface in generic `npx skills` environments.

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

### Save Thread (`save-thread`, deprecated compatibility)

This old skill name is kept for compatibility because indexed `npx skills` entries can stay discoverable long after a rename.

**What it means now:**
- In generic `npx skills` environments, `save-thread` must behave like `save-handoff`
- It must **not** claim a real transcript-backed thread import unless the runtime has a dedicated native connector that actually supports one

**Why:**
- A shared skills package does not control whether the host agent exposes readable session transcripts
- Many agents only expose prompt behavior, not a programmatic session-history API
- Pretending this is a lossless thread save would be misleading for users and harmful for retrieval quality later

**If you need real thread save:**
- Use a native connector that has a real importer for that runtime
- Today that includes dedicated Nowledge connectors such as Gemini CLI or Claude Code, where `nmem t save --from ...` can read local session files on the client machine

**What to say as a user:**
- In generic agents: ask for **save handoff** or **checkpoint this**
- In native connectors with transcript import: ask for **save thread** when you want the actual session captured

### Read Startup Context (`read-working-memory`)

Loads Context Bundle at session start when available, or your daily Working Memory briefing as the lightweight fallback, so the agent knows your current context.

**Activates at:**
- The start of a new session
- When you ask about current priorities or recent work

**Example:**
```
[Agent reads Context Bundle or Working Memory at session start]

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

The reusable skills follow the same core flow as the richer native connectors: read Working Memory, route recall across memories and threads, show a focused graph of retrieved memories, save a resumable handoff when asked, and distill durable knowledge.

For generic `npx skills` environments, treat `save-handoff` as the honest default. The deprecated `save-thread` compatibility skill stays published only so existing indexed installs do not break or mislead users.

## Make Agents Use Memory Proactively

Native connectors like Claude Code, Gemini CLI, Cursor, OpenClaw, and Alma already bundle the behavioral guidance that teaches the agent when to read context, search, or save.

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
- Run `nmem --json context --source-app "<host>"` when identity, active space, active rules, or multi-agent behavior could matter.
- Use `nmem --json wm read` for a lightweight daily briefing or older `nmem` clients.
- If Context Bundle already includes Working Memory, do not immediately read Working Memory again.
- If the host already knows a project or agent lane, add `--space "<space name>"`.

Search proactively when:
- the user references previous work, a prior fix, or an earlier decision
- the task resumes a named feature, bug, refactor, or subsystem
- a debugging pattern resembles something solved earlier
- the user asks for rationale, preferences, procedures, or recurring workflow details

Retrieval routing:
- Start with `nmem --json m search` for durable knowledge.
- Use `nmem --json t search` when the user is asking about a prior discussion or exact conversation history.
- If a memory result includes `source_thread`, inspect that conversation progressively with `nmem --json t show <thread_id> --limit 8 --offset 0 --content-limit 1200`.
- If the host does not know a lane, stay in the default space. Do not invent one in the prompt.
- After non-empty Memory retrieval, use `explore-graph` to show the exact result IDs in the same scope; skip empty and thread-only results. If visualization fails, report the reason and retain the retrieved evidence.

When preserving knowledge:
- Use `nmem --json m add` for genuinely new durable knowledge.
- If an existing memory already captures the same decision, preference, or workflow and the new information refines it, use `nmem m update <id> ...` instead of creating a duplicate.
- Pass `--unit-type fact|preference|decision|plan|procedure|learning|context|event` when the type is clear.
- Use a handoff save only when the user explicitly asks for a resumable checkpoint or handoff summary.
```

For MCP-only agents, use the same policy but replace the commands with the tool names `read_working_memory`, `memory_search`, `thread_search`, `thread_fetch_messages`, `memory_add`, and `memory_update`. Pass `unit_type` to `memory_add` when the type is clear.

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
claude plugin marketplace add https://github.com/nowledge-co/community
claude plugin install nowledge-mem@nowledge-community
```

See [nowledge-mem-claude-code-plugin](../nowledge-mem-claude-code-plugin) for details.

## Links

- [Documentation](https://mem.nowledge.co/docs)
- [Nowledge Mem](https://mem.nowledge.co)
- [Discord Community](https://nowled.ge/discord)
- [GitHub](https://github.com/nowledge-co/community)

## Maintaining the Shared Graph Skill

[`skills/explore-graph/SKILL.md`](skills/explore-graph/SKILL.md) is the canonical
graph skill source. The Codex and Agent Plugins packages ship identical ordinary
files so each package works when installed on its own. Do not replace those
package copies with symlinks or runtime references outside the installed package:
Codex's sparse marketplace install does not include the npx skills directory.

After editing the canonical source, run these commands from the community
repository root:

```bash
cp nowledge-mem-npx-skills/skills/explore-graph/SKILL.md nowledge-mem-codex-plugin/skills/explore-graph/SKILL.md
cp nowledge-mem-npx-skills/skills/explore-graph/SKILL.md nowledge-mem-agent-plugin/skills/explore-graph/SKILL.md
```

Keep the npx and Agent Plugins `search-memory` skills aligned as well. Run the
existing package tests to check graph content, package independence, search
routing, and registry declarations:

```bash
python3 -m unittest nowledge-mem-codex-plugin/tests/test_codex_plugin.py
node nowledge-mem-codex-plugin/scripts/validate-plugin.mjs
```

---

**Made with care by [Nowledge Labs](https://nowledge-labs.ai)**
