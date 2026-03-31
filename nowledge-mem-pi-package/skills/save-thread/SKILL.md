---
name: save-thread
description: "Save a structured handoff summary when the user asks to preserve the session. Creates a searchable record of goals, decisions, and next steps."
---

# Save Thread

Pi does not have a native transcript importer. This skill creates a structured handoff summary that captures the session's key outcomes as a searchable thread in your knowledge base.

## When to Use

- User asks to save the session: "save this", "checkpoint", "record what we did"
- Session ending with important context that should carry forward
- Complex multi-step work that a future session will resume

Never auto-save or suggest saving unprompted.

## Usage

```bash
nmem --json t create \
  -t "Session Handoff - <topic>" \
  -c "Goal: ... Decisions: ... Files: ... Risks: ... Next: ..." \
  -s generic-agent
```

## Content Format

Structure the content as a clear handoff. Include only what a future session needs to continue:

```
Goal: What the session set out to accomplish
Decisions: Key choices made and their rationale
Files: Important files created or modified
Outcome: What was achieved
Risks: Known risks, open questions, or things that could break
Next: Concrete steps for the next session
```

### Example

```bash
nmem --json t create \
  -t "Session Handoff - Auth Migration to OAuth2" \
  -c "Goal: Migrate session auth from JWT to OAuth2 with PKCE.
Decisions: Chose Authorization Code flow with PKCE over Implicit for security. Using passport-oauth2 library.
Files: src/auth/oauth2.ts (new), src/auth/middleware.ts (updated), tests/auth.test.ts (updated).
Outcome: Core flow working, token refresh implemented, tests passing.
Risks: Token refresh not tested under clock skew; CSRF state parameter still missing.
Next: Add CSRF state parameter, update API docs, deploy to staging." \
  -s generic-agent
```

## Thread vs Memory

A thread preserves session structure: goals, sequence, context. A memory distills a single insight or decision. They serve different purposes. Use both when appropriate: save the thread for continuity, distill key decisions as standalone memories.

## Links

- [Documentation](https://mem.nowledge.co/docs/integrations/pi)
- [Troubleshooting](https://mem.nowledge.co/docs/troubleshooting)
