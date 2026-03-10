# Browse Now Skill for AI Agents

> Install a reusable `browse-now` skill on supported AI coding agents with `npx skills add`.

This package teaches compatible agents how to use the `browse-now` CLI that ships with the Nowledge Mem desktop app.

`browse-now` controls the user's real browser through the Nowledge Mem Exchange extension. It is the right tool for authenticated websites, dynamic pages, form filling, screenshots, and browser flows that ordinary web search cannot reach.

This is a local-only capability. The CLI, the Nowledge Mem app, the connected browser, and the extension must live on the same machine. Access Anywhere does not expose the browser bridge.

## Install

```bash
npx skills add nowledge-co/community/nowledge-mem-browse-now-npx-skills
```

Install just this skill:

```bash
npx skills add nowledge-co/community/nowledge-mem-browse-now-npx-skills --skill browse-now
```

## Requirements

You need all of these:

- the Nowledge Mem desktop app installed
- the bundled `browse-now` CLI available on your machine
- the Nowledge Mem Exchange browser extension installed in Chrome, Edge, Arc, or another supported Chromium browser
- at least one connected browser with the extension active

If the app is installed, `browse-now` is normally auto-installed for you. Verify with:

```bash
browse-now status
browse-now --help
```

If no browser is connected yet, open the browser where the extension is installed and keep the extension active.

## What The Skill Does

After installation, the agent learns to:

- prefer `browse-now` for authenticated and interactive browser work
- use refs from `snapshot -i` as the primary interaction surface
- re-snapshot after navigation or DOM changes
- verify navigation with `browse-now get url` or `browse-now get title`
- fall back to text clicks or screenshots when accessibility data is sparse

## Quick Start

```bash
browse-now open https://example.com
browse-now snapshot -i
browse-now click @e5
browse-now fill @e3 "search query" --submit
browse-now get page-text --max-chars 3000
```

## When To Use It

Use `browse-now` when the task requires:

- a logged-in website
- a real browser session with the user's cookies
- clicking, typing, or navigating through a live UI
- screenshots or visual follow-up on image-heavy pages
- content extraction from dynamic sites that do not expose enough text to normal search tools

Do not use it for simple public lookups that ordinary web search can answer faster.

## Links

- [Browse Now documentation](https://mem.nowledge.co/docs/browse-now)
- [Nowledge Mem](https://mem.nowledge.co)
- [Nowledge Mem Exchange](https://github.com/nowledge-co/nowledge-mem-exchange)
