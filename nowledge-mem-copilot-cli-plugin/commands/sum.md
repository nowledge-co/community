---
description: Distill insights from this conversation into memories
---

# Distill Memory

Analyze our conversation and create structured memory entries using the nmem CLI.

## Memory Categories

Use these categories to guide content structure:

- **insight**: Key learnings, realizations, "aha" moments
- **decision**: Choices made with rationale and trade-offs
- **fact**: Important information, data points, references
- **procedure**: How-to knowledge, workflows, SOPs
- **experience**: Events, conversations, outcomes

## Process

1. Identify valuable insights from our conversation
2. For each insight, create a memory with appropriate category

## Command

```bash
nmem m add "Content with full context" \
  -t "Searchable title (max 60 chars)" \
  -i 0.8
```

## Importance Scale

- **0.8-1.0**: Critical decisions, breakthroughs, blockers resolved
- **0.5-0.7**: Useful insights, standard decisions
- **0.1-0.4**: Background info, minor details

## Quality Standards

- **Atomic**: One insight per memory
- **Actionable**: Focus on what was learned, not what was discussed
- **Standalone**: Readable without conversation context
- **Professional**: No emojis, clear language

## Example

```bash
nmem m add "React useEffect cleanup functions must return a function, not call it directly. Incorrect: useEffect(() => cleanup()). Correct: useEffect(() => cleanup). This caused memory leaks in our dashboard component." \
  -t "React useEffect Cleanup Pattern" \
  -i 0.9
```
