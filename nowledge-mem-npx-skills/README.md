# Nowledge Mem Skills for AI Coding Agents

> Install Nowledge Mem skills on any supported AI coding agent using `npx skills add`.

[![npx skills](https://img.shields.io/badge/npx-skills-blue)](https://github.com/vercel-labs/add-skill)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Supported-green)](https://claude.ai/code)
[![Cursor](https://img.shields.io/badge/Cursor-Supported-green)](https://cursor.sh)

## Overview

These skills extend your AI coding agent with persistent memory capabilities powered by [Nowledge Mem](https://mem.nowledge.co):

- **Search Memory** - Automatically surface relevant context from your knowledge base
- **Save Thread** - Persist complete coding sessions for future reference
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

### Save Thread (`save-thread`)

Saves complete conversations as checkpoints for future reference.

**Activates when you say:**
- "Save this session"
- "Checkpoint this"
- "Remember this conversation"

**Example:**
```
You: Save this session - implemented JWT authentication

Agent: ✓ Thread saved
Summary: Implemented JWT authentication
Messages: 23
Thread ID: claude-code-abc123
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

### Save a Session

```bash
# Via CLI
nmem t save --from claude-code -s "Implemented user auth"

# In conversation
"Save this session - fixed memory leak in event listeners"
```

### Create a Memory

```bash
nmem m add "PostgreSQL over MongoDB: ACID needed for transactions" \
  -t "Database: PostgreSQL for ACID" \
  -i 0.9
```

## Alternative Installation

### Claude Code Plugin (Full Featured)

For Claude Code users, the full plugin with slash commands is also available:

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
