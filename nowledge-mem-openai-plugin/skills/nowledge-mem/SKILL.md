---
name: nowledge-mem
description: Use a connected Nowledge Mem Cloud workspace for cross-tool context, memory search, scoped knowledge writes, thread lookup, and Library retrieval in ChatGPT or Codex.
---

# Nowledge Mem Cloud

Use the connected Nowledge Mem tools when the answer depends on prior decisions, current working context, exact earlier conversations, or durable knowledge that should survive this chat.

## Connect

If the Nowledge Mem tools are unavailable, direct the user to the official setup guide at `https://mem.nowledge.co/docs/integrations/chatgpt-web`. The MCP endpoint must be public HTTPS and end in `/mcp`. Complete the host's OAuth flow; never ask the user to paste a Nowledge API key into chat.

This public plugin package is skills-only until its production MCP connection is registered with OpenAI. Do not invent an app identifier or imply that installing the skill alone creates a Cloud connection.

## Use

1. Start with `read_context_bundle` when broad current context is useful.
2. Use `memory_search` for focused recall and `get_memory_by_id` for exact follow-up.
3. Use `thread_search` and thread message tools only when exact prior conversation evidence matters.
4. Use Library tools for source-backed material.
5. Before `memory_add` or `memory_update`, make the intended Space and durable claim clear. A write may require separately approved `mem:write` scope.

Respect the tools actually exposed by the connected server. Do not claim access to hidden administrative, identity, scheduler, deletion, or review/governance tools.

## Boundaries

- Remote MCP lets ChatGPT or Codex call Mem. It does not let Mem read the host's private transcript.
- Use the browser extension or an official export for ChatGPT conversation capture. Use the dedicated local Codex connector for Codex lifecycle hooks and transcript capture.
- A client name and `source_app` are provenance, not an AI Identity or Space selector.
- Never create a new Space merely to make a connection succeed.

When a task materially depends on remembered context, cite or summarize the retrieved evidence honestly. Do not describe a retrieval as proof that the memory helped unless the user or downstream work confirms it.
