---
name: browse-now
description: Control the user's actual browser through the browse-now CLI when a task needs authenticated pages, dynamic interaction, form filling, screenshots, or other browser automation that web search cannot reach. Prefer it whenever the task depends on the user's real browser state rather than a generic fetch.
---

# Browse Now

> Use the user's real browser when the task needs live interaction, login state, or dynamic content.

## When To Use

Use `browse-now` when:

- the site requires the user's existing browser session or login cookies
- the task needs clicking, typing, scrolling, or navigating through a live page
- the page is dynamic enough that plain HTTP fetches or web search will miss the real UI state
- the user needs a screenshot or content extraction from the rendered page

Skip it when ordinary web search or direct HTTP fetching would answer the question faster.

`browse-now` is local-only. It must run on the same machine as the Nowledge Mem app, the browser, and the Exchange extension. It is not exposed through Access Anywhere.

## Core Loop

```bash
browse-now open <url>
browse-now snapshot -i
browse-now click @e5
browse-now wait 2
browse-now get url
browse-now snapshot -i
```

## Preferred Interaction Order

1. Start with `browse-now snapshot -i` to get interactive refs.
2. Use `click @eN` and `fill @eN ...` as the primary interaction path.
3. After navigation or major DOM changes, run `snapshot -i` again because refs reset.
4. Confirm page changes with `browse-now get url` or `browse-now get title`.
5. If accessibility data is sparse, use `browse-now find "query"`, `click -T "text"`, or `screenshot`.

## Practical Commands

```bash
browse-now open https://example.com
browse-now snapshot -i
browse-now find "login button"
browse-now click @e12
browse-now fill @e3 "search text" --submit
browse-now get page-text --max-chars 4000
browse-now screenshot /tmp/page.png
```

## Reliability Notes

- Refs from `snapshot -i` are the most reliable click targets.
- Text clicks are a fallback for dialogs, dropdowns, or poor accessibility trees.
- A successful click does not bypass login walls, paywalls, or anti-bot behavior.
- Always verify where you landed before assuming the browser action failed.

## Requirements

- Nowledge Mem desktop app installed
- `browse-now` available on `PATH`
- Nowledge Mem Exchange extension installed in a supported browser
- A connected browser session the agent can control
