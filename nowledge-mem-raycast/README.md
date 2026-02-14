# Nowledge Mem for Raycast

Search and browse your personal knowledge base from Raycast. Find memories, save insights, and read your daily Working Memory briefing without leaving your workflow.

## Requirements

- [Nowledge Mem](https://mem.nowledge.co) desktop app running locally
- [Raycast](https://raycast.com)

## Commands

### Search Memories

Search your entire knowledge base with natural language. Shows results ranked by relevance with confidence scores.

When no search query is entered, shows your most recent memories.

### Add Memory

Save a quick memory from anywhere. Set a title, importance level, and content.

### Working Memory

View today's Working Memory briefing: your active focus areas, unresolved flags, and recent changes. The same briefing your AI tools read at `~/ai-now/memory.md`.

## Configuration

| Preference | Default | Description |
|---|---|---|
| Server URL | `http://localhost:14242` | Nowledge Mem server URL |

## Installation

### From Raycast Store

Search for "Nowledge Mem" in the Raycast Store.

### From Source

```bash
git clone https://github.com/nowledge-co/community.git
cd community/nowledge-mem-raycast
npm install
npm run dev
```

## License

MIT
