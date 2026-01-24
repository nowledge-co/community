---
name: nowledge-mem-distill
description: Recognize breakthrough moments, blocking resolutions, and design decisions worth preserving. Detect high-value insights that save future time. Suggest distillation at valuable moments, not routine work.
---

# Distill Memory

> Capture breakthrough moments and valuable insights as searchable memories in your knowledge base.

## When to Suggest

**Breakthrough moments:**
- Extended debugging finally resolves
- User relief signals ("Finally!", "Aha!", "That was it!")
- Root cause discovered after investigation

**Important decisions:**
- Compared multiple options
- Chose with clear rationale
- Trade-off resolved with reasoning

**Research conclusions:**
- Investigated multiple approaches
- Reached definitive conclusion
- Optimal path determined

**Unexpected discoveries:**
- Counterintuitive solution found
- Assumption challenged and corrected
- Surprising cause-effect relationship

**Lessons learned:**
- "Next time do X instead"
- Preventive measure identified
- Pattern recognized for future use

**Skip these (not worth preserving):**
- Routine fixes
- Work in progress
- Simple Q&A
- Generic information

## Prerequisites

**nmem CLI** - Choose one option:

**Option 1: uvx (Recommended)**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uvx --from nmem-cli nmem --version
```

**Option 2: pip**
```bash
pip install nmem-cli
nmem --version
```

Ensure Nowledge Mem server is running at `http://localhost:14242`

## Usage

Use `nmem m add` to create memories:

```bash
nmem m add "Insight content with context for future use" \
  -t "Searchable title (50-60 chars)" \
  -i 0.8
```

### Memory Quality Guidelines

**Good memories (atomic + actionable):**

- "React hooks cleanup must return function. Missing return caused memory leaks in event listeners."
- "PostgreSQL over MongoDB: ACID compliance needed for financial transactions."
- "Docker build cache invalidation: COPY package*.json before source files."

**Poor memories (avoid):**

- Vague: "Fixed bugs in the code"
- Too long: Full conversation transcripts
- No context: "Use useState"

### Content Guidelines

- Focus on outcome/insight, not process
- Include "why" not just "what"
- Add enough context for future understanding
- Be specific and actionable

### Importance Scores

| Score | Use for |
|-------|---------|
| 0.8-1.0 | Major breakthroughs, critical decisions |
| 0.5-0.7 | Useful patterns, good practices |
| 0.3-0.4 | Minor tips, nice-to-know |

### Options

| Flag | Description | Example |
|------|-------------|---------|
| `-t, --title` | Searchable title | `-t "React Hooks Cleanup"` |
| `-i, --importance` | Score 0.0-1.0 | `-i 0.9` |
| `--json` | JSON response | `--json` |

## Suggestion Approach

**Timing:** After resolution/decision, when user pauses

**Pattern:** "This [type] seems valuable - [essence]. Distill into memory?"

**Frequency:** 1-3 per session typical. Quality over quantity.

## Examples

```bash
# High-value debugging insight
nmem m add "React hooks cleanup must return function. Missing return caused memory leaks in event listeners when component unmounted." \
  -t "React Hooks Cleanup Pattern" \
  -i 0.9

# Architecture decision
nmem m add "Chose PostgreSQL over MongoDB: needed ACID compliance for financial transactions and complex JOIN queries for reporting." \
  -t "Database Choice: PostgreSQL for ACID" \
  -i 0.9

# Development workflow tip
nmem m add "Docker build cache: COPY package*.json and run npm install BEFORE copying source files. Saves rebuild time on code changes." \
  -t "Docker Build Cache Optimization" \
  -i 0.7

# Debugging lesson
nmem m add "CORS preflight fails silently in fetch. Check Network tab for OPTIONS request, not just the main request." \
  -t "CORS Debugging: Check OPTIONS Request" \
  -i 0.8
```

## Links

- [Documentation](https://mem.nowledge.co/docs)
- [Nowledge Mem](https://mem.nowledge.co)
- [Discord Community](https://nowled.ge/discord)
