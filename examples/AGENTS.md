## Nowledge Mem Integration

Add this section to your project's `AGENTS.md` file to enable AI agents to autonomously manage knowledge through Nowledge Mem.

### Memory Operations

**Memory Categories** - Use these to guide content structure:

- **insight**: Key learnings, realizations, "aha" moments
- **decision**: Choices made with rationale and trade-offs  
- **fact**: Important information, data points, references
- **procedure**: How-to knowledge, workflows, SOPs
- **experience**: Events, conversations, outcomes

**Creating Memories:**

```bash
# Basic memory
nmem m add "Content with context" \
  -t "Searchable title (max 60 chars)" \
  -i 0.8

# With title and importance
nmem m add "Decided to use PostgreSQL for ACID compliance" \
  -t "Database Selection" \
  -i 0.9
```

**Importance Scale:**
- **0.8-1.0**: Critical decisions, breakthroughs, blockers resolved
- **0.5-0.7**: Useful insights, standard decisions
- **0.1-0.4**: Background info, minor details

**Searching Memories:**

```bash
# Basic search
nmem --json m search "authentication patterns"

# With filters
nmem --json m search "API design" --importance 0.8 --label architecture
```

**Thread Operations:**

```bash
# Save current session (Claude Code)
nmem t save --from claude-code

# Save current session (Codex)
nmem t save --from codex

# Show thread details
nmem t show claude-code-abc123
```

### Autonomous Memory Keeper Agent

For Claude Code users, create `.claude/agents/memory-keeper.md`:

```markdown
---
name: memory-keeper
description: Proactively saves insights, decisions, and learnings to Nowledge Mem after completing tasks or making decisions.
tools: Bash
model: inherit
---

You are a knowledge management specialist who captures valuable information.

**When to Act:**
- After completing significant tasks
- When important decisions are made
- After discovering key insights

**Process:**
1. Identify what's worth remembering
2. Categorize (insight/decision/fact/procedure/experience)
3. Save using `nmem m add` with appropriate importance

**Example:**
```bash
nmem m add "Root cause: API rate limiting missing exponential backoff" \
  -t "API Rate Limiting Fix" \
  -i 0.7
```

Act proactively but judiciously.
```

### Auto-Save Sessions with Hooks

For Claude Code, add to `.claude/config.json`:

```json
{
  "hooks": {
    "SessionEnd": [{
      "hooks": [{
        "type": "command",
        "command": "nmem t save --from claude-code"
      }]
    }]
  }
}
```

This automatically saves sessions on exit - idempotent and safe to run multiple times.

### Setup

**Prerequisites:**

```bash
# Option 1 (Recommended): Use uvx (no installation needed)
curl -LsSf https://astral.sh/uv/install.sh | sh
uvx --from nmem-cli nmem --version

# Option 2: Install with pip
pip install nmem-cli
```

**Note**: On Windows/Linux with Nowledge Mem Desktop app, `nmem` is bundled. On macOS or remote servers, use `uvx` or install manually.

**For Claude Code Plugin:**

```bash
# Add marketplace
claude plugin marketplace add nowledge-co/community

# Install plugin
claude plugin install nowledge-mem@nowledge-community
```

### Resources

- [Nowledge Mem CLI Docs](https://mem.nowledge.co/docs/cli)
- [Integration Guide](https://mem.nowledge.co/docs/integrations)
- [Claude Code Plugin](https://mem.nowledge.co/docs/integrations#claude-code)
