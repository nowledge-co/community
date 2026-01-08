---
description: Analyze conversation and create structured memory entries
---

Analyze our current conversation and create structured memory entries for important information. Follow this systematic approach:

**Analysis Process:**

1. **Content Review**: Examine our conversation to identify:
   - Key insights, decisions, and learnings
   - Important details, names, and dates
   - Actionable items and outcomes
   - Information valuable for future reference

2. **Memory Structuring**: For each significant piece of information, create:
   - **Concise Title** (max 60 characters): Captures the essence and is searchable
   - **Structured Summary**: Preserves key details, uses clear language, includes actionable items
   - **Importance Score** (0.1-1.0): Based on significance and future value
   - **Relevant Labels**: 2-4 labels using lowercase with hyphens (e.g., work, meeting, python, decision)

3. **Quality Standards**:
   - Write in clear, professional language
   - Use specific details (names, dates, technical terms)
   - Structure with bullet points or numbered lists when appropriate
   - Ensure memories are standalone and understandable out of context
   - Avoid redundancy across memories

**Memory Creation**:

Use the `nmem` CLI to create memories for each important piece of information:

```bash
nmem m add "Detailed summary with key information, formatted clearly" \
  --title "Brief, searchable title" \
  --importance 0.8
```

**Example:**

```bash
nmem m add "Implemented JWT-based authentication with refresh tokens. Access tokens expire in 15min, refresh tokens in 7 days. Tokens stored in httpOnly cookies for security." \
  --title "JWT Authentication Implementation" \
  --importance 0.9
```

**For programmatic use**, add `--json` flag to verify creation:

```bash
nmem --json m add "Content here" --title "Title" --importance 0.8
```

**Guidelines:**

- **High importance** (0.8-1.0): Critical decisions, major insights, key learnings
- **Medium importance** (0.5-0.7): Useful details, preferences, contextual information  
- **Lower importance** (0.1-0.4): Minor notes, exploratory discussions

Create 2-5 focused memories that capture the essential takeaways from our conversation.
