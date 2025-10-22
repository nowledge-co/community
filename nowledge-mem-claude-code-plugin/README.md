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

### Nowledge Mem MCP Server Installation

```bash
claude mcp add --transport http nowledge-mem http://localhost:14242/mcp
```

### Option 1: Install from Marketplace (Recommended)

```bash
claude plugin install nowledge-mem
```

### Option 2: Install from Directory

```bash
# Clone the plugin
git clone https://github.com/nowledge-labs/nowledge-mem.git
cd nowledge-mem/claude-code-plugin

# Install locally
claude plugin install .
```

### Verify Installation

Check that the plugin loaded successfully:

```bash
claude plugin list
```

You should see `nowledge-mem` in the list.

## Quick Start

### 1. Verify Connection

Start Claude Code and ask:

```text
List available memory labels
```

If the backend is connected, you'll see a list of labels (may be empty if this is your first time).

### 2. Search Your Knowledge Base

Try asking about past work:

```text
What do I know about Python async?
```

Or reference previous conversations:

```text
What was that database optimization we discussed?
```

Claude will automatically search your knowledge base using the **Search Knowledge Base** skill.

### 3. Save a Session

After completing valuable work, save it:

```text
Save this session - implemented user authentication with JWT
```

Or use the guided prompt:

```text
/save
```

Claude will use the **Persist Coding Session** skill to store your conversation.

### 4. Build Your Knowledge Base

Add standalone memories:

```text
Remember this: For this project, we use Tailwind for styling and avoid CSS-in-JS
```

Or during conversations, Claude can suggest saving important information.

## Skills Reference

This plugin includes two Agent Skills that extend Claude's capabilities:

### Search Knowledge Base

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
3. Calls `memory_search` MCP tool
4. Synthesizes relevant results into response

### Persist Coding Session

**Activates when you explicitly request:**

- "Save this session"
- "Remember this conversation"
- Use `/save` prompt

**How it works:**

1. Claude asks for a brief summary (1-2 sentences)
2. Detects your current project path
3. Calls `thread_persist` MCP tool
4. Confirms successful save with details

**Never activates automatically** - always requires explicit user request.

## Available MCP Tools

The plugin exposes these MCP tools (you can call them directly or let skills handle them):

### Core Search & Retrieval

**`memory_search`**

- Search memories using semantic + full-text search
- Parameters: `query`, `limit`, `mode` (normal/deep), `confidence_threshold`, `filter_labels`
- Returns: Ranked results with confidence scores

**`list_memory_labels`**

- Get all available labels with usage counts
- Helps with label filtering in searches

### Memory Management

**`memory_add`**

- Add new memory to knowledge base
- Parameters: `content`, `title`, `importance`, `labels`, `source`
- Automatic entity extraction and relationship building

**`memory_update`**

- Update existing memory content or metadata
- Parameters: `memory_id`, `content`, `title`, `importance`, `labels`
- Use after `memory_search` to get memory IDs

### Session Persistence

**`thread_persist`**

- Save Claude Code sessions to knowledge base
- Parameters: `client` (claude-code), `project_path`, `persist_mode`, `summary`
- Automatic deduplication and session detection

## Available MCP Prompts

**`/sum`** - Analyze current conversation and create structured memories

**`/save`** - Guided workflow for saving coding sessions

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
