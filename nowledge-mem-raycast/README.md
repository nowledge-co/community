# Nowledge Mem for Raycast

Search and browse your personal knowledge base from Raycast. Find memories, save insights, edit your Working Memory, and copy results without leaving your workflow.

## Requirements

- [Nowledge Mem](https://mem.nowledge.co) desktop app running locally
- [Raycast](https://raycast.com)

## Commands

### Search Memories

Search your entire knowledge base with natural language. Shows results ranked by relevance with confidence scores.

When no search query is entered, shows your most recent memories.

**Actions on any memory:**
- **View** — push to a detail view with full content and metadata
- **Copy Content** — copy the memory text to clipboard
- **Copy Title** — copy just the title
- **Open in Nowledge Mem** — deep link to the memory in the desktop app

### Add Memory

Save a quick memory from anywhere. Set a title, importance level, and content.

### Working Memory

View today's Working Memory briefing: your active focus areas, unresolved flags, and recent changes. The same briefing your AI tools read at `~/ai-now/memory.md`.

**Actions:**
- **Edit Working Memory** — inline edit form, saves directly to `~/ai-now/memory.md`
- **Copy** — copy the full briefing to clipboard
- **Open in Editor** — open the file in your default text editor

### Edit Working Memory

Edit your daily Working Memory briefing inline. Changes are saved directly to `~/ai-now/memory.md` and respected by all connected AI tools (Claude Code, Cursor, Codex, etc.).

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

## Store Submission Checklist

Before publishing:
- [ ] Create a 512x512 PNG icon at `assets/extension-icon.png` (use [ray.so/icon](https://ray.so/icon))
- [ ] Add 1-6 screenshots (2000x1250 PNG) to `metadata/`
- [ ] Run `npm run build` to validate
- [ ] Run `npm run publish` to open PR against raycast/extensions

## License

MIT
