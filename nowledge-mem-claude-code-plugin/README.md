# Nowledge Mem Claude Code Plugin

> AI-powered personal knowledge base that surfaces relevant context and preserves insights during your coding sessions.

[![Claude Code](https://img.shields.io/badge/Claude%20Code-1.0%2B-blue)](https://claude.ai/code)

## Overview

Nowledge Mem transforms Claude Code into a context-aware coding companion by:

- **🔍 Automatically surfacing relevant context** from your past work when you need it
- **💾 Preserving valuable insights** from coding sessions for future reference
- **🧠 Building a searchable knowledge base** of your decisions, patterns, and solutions

Instead of starting fresh every session, Claude can now remember your architectural decisions, debugging solutions, and personal preferences - making every interaction more productive.

## Features

### Intelligent Context Search

Claude automatically searches your knowledge base when you:

- Reference past work: "Like we did last time..."
- Ask for recall: "What was that pattern we used?"
- Debug familiar issues: "This error looks familiar"
- Continue previous work: "Let's keep working on authentication"

### Guided Session Persistence

Save important coding sessions with:

- **Simple command**: Just say "save this session"
- **Smart summaries**: Brief descriptions for easy future retrieval
- **Automatic deduplication**: Safe to save multiple times
- **Multi-session support**: Save individual sessions or batch process

### Semantic Search

Find information using natural language:

- **Multi-strategy search**: Vector similarity + full-text + graph analysis
- **AI validation**: Results are relevance-checked by LLM
- **Confidence scoring**: Know how relevant each result is
- **Label filtering**: Organize by topics, projects, or categories

### Memory Management

Beyond conversations:

- Add standalone memories with `memory_add`
- Update existing memories with `memory_update`
- Organize with labels and importance scores
- Track entities and relationships in your knowledge graph

## Installation

### Prerequisites

**nmem CLI** - Choose one of the following options:

**Option 1: uvx (Recommended - No Installation Required)**

```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run nmem directly (downloads automatically on first use)
uvx --from nmem-cli nmem --version
```

**Benefits:**
- No manual installation or updates needed
- Isolated from system Python
- Cached for fast startup (use `uvx --refresh --from nmem-cli nmem` to update)
- Works on macOS, Linux, and Windows

**Option 2: pip/pipx (Traditional Installation)**

```bash
# Using pip
pip install nmem-cli

# Or using pipx for isolated installation
pipx install nmem-cli
```

Verify installation:

```bash
nmem --version
# or
uvx --from nmem-cli nmem --version
```

**Note**: 
- On Windows/Linux with Nowledge Mem Desktop app installed, `nmem` is bundled
- On macOS or when using Mem as a remote server, use `uvx` or install manually
- Ensure the Nowledge Mem server is running at `http://localhost:14242`

### Plugin Installation

#### Option 1: Install from Marketplace (Recommended)

```bash
claude plugin install nowledge-mem
```

#### Option 2: Install from Directory

```bash
# Clone the repository
git clone https://github.com/nowledge-co/community.git
cd community/nowledge-mem-claude-code-plugin

# Install locally
claude plugin install .
```

### Verify Installation

Check that the plugin loaded successfully:

```bash
claude plugin list
```

You should see `nowledge-mem` in the list.

### Update Plugin

To update to the latest version:

```bash
# Update marketplace index
claude plugin marketplace update

# Update the plugin
claude plugin update nowledge-mem@nowledge-community

# Restart Claude Code to apply changes
```

## Quick Start

### 1. Verify Connection

Verify that `nmem` can connect to your Nowledge Mem server:

```bash
nmem status
```

You should see server status information. If this works, the plugin will be able to use `nmem` commands.

### 2. Search Your Knowledge Base

Try asking about past work:

```text
What do I know about Python async?
```

Or reference previous conversations:

```text
What was that database optimization we discussed?
```

Claude will automatically search your knowledge base using the **Search Memory** skill, which uses `nmem --json m search` under the hood.

### 3. Save a Session

After completing valuable work, save it:

```text
Save this session - implemented user authentication with JWT
```

Claude will use the **Save Thread** skill to store your conversation using `nmem t save --from claude-code`.

### 4. Build Your Knowledge Base

Add standalone memories:

```text
Remember this: For this project, we use Tailwind for styling and avoid CSS-in-JS
```

Or during conversations, Claude can suggest saving important information.

## Skills Reference

This plugin includes four Agent Skills and lifecycle hooks that extend Claude's capabilities:

### Read Working Memory

**Automatically activates at session start.**

Loads your daily Working Memory briefing from `~/ai-now/memory.md`. This gives Claude your current context — active focus areas, priorities, unresolved flags, and recent knowledge changes — without you asking.

**How it works:**

1. Claude reads `~/ai-now/memory.md` at the start of each session
2. References relevant context naturally during the conversation
3. Skips if already loaded or if the file doesn't exist

### Search Memory

**Automatically activates when you:**

- Reference past work or conversations
- Ask to recall specific information
- Need context for debugging or decisions
- Continue previous work

**Example triggers:**

- "What do I know about React hooks?"
- "Show me what we discussed about database design"
- "Like we did in the authentication module"
- "继续上次关于机器学习的讨论"

**How it works:**

1. Claude detects semantic triggers in your message
2. Formulates an optimal search query
3. Runs `nmem --json m search "<query>"` with appropriate filters
4. Synthesizes relevant results into response

### Save Thread

**Activates when you explicitly request:**

- "Save this session"
- "Remember this conversation"
- "Checkpoint this"

**How it works:**

1. Claude generates a brief summary of the conversation
2. Runs `nmem t save --from claude-code -s "<summary>"`
3. Auto-detects and imports the current session from `~/.claude/projects/`
4. Confirms successful save with thread ID and message count

**Features:**
- Idempotent: Re-running appends only new messages
- Auto-generated thread ID: `claude-code-{session_id}`
- Can save current session or all sessions for a project

**Never activates automatically** - always requires explicit user request.

### Distill Memory

**Activates when:**

- Breakthrough moments occur (debugging resolved, root cause found)
- Important decisions are made with clear rationale
- Valuable lessons or patterns are recognized

**How it works:**

1. Claude detects high-value moments in the conversation
2. Suggests distilling the insight into a memory
3. If approved, runs `nmem m add "<content>" --title "<title>" --importance <score>`
4. Confirms memory creation

**Focuses on quality over quantity** - typically 1-3 memories per session.

## Lifecycle Hooks

The plugin includes hooks that keep Claude aware of your knowledge context. Configured in `hooks/hooks.json`, they activate automatically when the plugin is installed.

| Hook | Event | What it does |
|------|-------|-------------|
| **Context injection** | `SessionStart` (startup) | Reads `~/ai-now/memory.md` and injects your Working Memory into the session |
| **Context recovery + checkpoint** | `SessionStart` (compact) | Re-injects Working Memory after context compaction and prompts Claude to save important findings via `nmem m add` |

Both hooks are best-effort and fail silently if the Working Memory file doesn't exist.

**Customizing hooks:** Edit `.claude/settings.json` to override or disable individual hooks. See the [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) for details.

## Slash Commands

The plugin provides three CLI-based slash commands (no MCP required):

### /nowledge-mem:save

Save the current session to Nowledge Mem:

```
/save
```

This runs `nmem t save --from claude-code` to save the current session.

### /nowledge-mem:sum

Distill insights from the conversation into memories:

```
/sum
```

Claude will analyze the conversation and create structured memory entries using `nmem m add`.

### /nowledge-mem:search

Search your knowledge base:

```
/search <query>
```

This runs `nmem --json m search "<query>"` and returns relevant results.

## Available CLI Commands

The plugin uses these `nmem` CLI commands (skills handle them automatically):

### Memory Operations

**Search Memories**
```bash
nmem --json m search "<query>" [--importance MIN] [-l LABEL] [-t TIME] [-n LIMIT]
```
- Search memories using semantic + full-text search
- Returns: JSON with ranked results and confidence scores

**Add Memory**
```bash
nmem m add "<content>" --title "<title>" --importance <0.0-1.0>
```
- Add new memory to knowledge base
- Automatic entity extraction and relationship building

**Update Memory**
```bash
nmem m update <id> --content "<content>" --title "<title>" --importance <score>
```
- Update existing memory content or metadata

**List Memories**
```bash
nmem --json m [-n LIMIT] [--importance MIN]
```
- List recent memories with optional filters

### Thread Operations

**Save Session**
```bash
# Save current Claude Code session
nmem t save --from claude-code

# Save with custom summary
nmem t save --from claude-code -s "Implemented authentication feature"

# Save all sessions for current project
nmem t save --from claude-code -m all

# Save for specific project
nmem t save --from claude-code -p /path/to/project
```
- Auto-detects sessions from `~/.claude/projects/`
- Idempotent: Re-running appends only new messages
- Thread ID: `claude-code-{session_id}`

**Create Thread (Manual)**
```bash
nmem t create -t "<title>" -m '<json_messages>'
# Or from file
nmem t create -t "<title>" -f conversation.md
```
- Manual thread creation from JSON or markdown
- Use when not importing from Claude Code/Codex

**Search Threads**
```bash
nmem --json t search "<query>" [-n LIMIT]
```
- Search threads by title and content

**Show Thread**
```bash
nmem --json t show <id> [-m MAX_MESSAGES]
```
- Display thread details with messages

## Usage Examples

### Example 1: Debugging with Context

```text
You: I'm getting this authentication error again [pastes error]

Claude: Let me check if we've encountered this before...
[Automatically searches knowledge base]

Found it! We solved this 2 weeks ago. The issue was with token expiration 
handling in the middleware. Here's what we did...
```

### Example 2: Continuing Previous Work

```text
You: Let's continue with the API refactoring we started

Claude: [Searches for "API refactoring"]

I found our previous discussion. We were migrating from REST to GraphQL 
and had just finished the User resolver. Next steps were...
```

### Example 3: Saving Important Work

```text
You: Save this session - fixed memory leak in event listeners

Claude: I'll save this to your knowledge base.

✓ Session saved successfully!

Summary: Fixed memory leak in event listeners
Messages saved: 23
Thread ID: abc-123

You can retrieve this later by searching for "memory leak event listeners"
```

### Example 4: Multi-Language Support

```text
You: 我们之前讨论的数据库优化方案是什么？

Claude: [Searches: "数据库优化方案"]

我找到了之前的讨论。我们决定使用 Redis 缓存和数据库索引优化...
```

## Links

- **Documentation**: [https://mem.nowledge.co/docs](https://mem.nowledge.co/docs)
- **Website**: [https://mem.nowledge.co](https://mem.nowledge.co)
- **Discord**: [https://nowled.ge/discord](https://nowled.ge/discord)
- **GitHub**: [https://github.com/nowledge-co/community](https://github.com/nowledge-co/community)

---

**Made with ❤️ by [Nowledge Labs](https://nowledge-labs.ai)**

*Transform your coding experience - never lose context again.*
