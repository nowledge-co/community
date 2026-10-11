---
name: check-integration
description: Detect whether Nowledge Mem is installed and reachable from iCode, verify the MCP server and hook wiring, and guide the fix when something is missing. Use when memory tools are absent, the startup reminder is missing, or the user asks to check the memory setup.
---

Verify the Nowledge Mem setup for iCode end to end.

1. **CLI**: run `nmem doctor` (or `nmem status`). It checks the credential
   home, server reachability, and API key. iCode is not in nmem's registered
   tool list yet, so "not registered" warnings for iCode are expected; only
   the server/key lines must pass.
2. **MCP**: in iCode, open `/agents` > the agent's MCP tab and confirm a
   `nowledge-mem` server; use the card's test button. It should report the
   `nowledge-mem` server with tools such as `memory_search`. If missing, the
   installer block was not merged (or iCode was not restarted after install).
3. **Hook**: submit a first prompt in a fresh session; the Nowledge Mem
   context reminder should appear as a system reminder. If not, check
   `~/.chrys/hooks/hooks.yaml` for the `nowledge-mem-icode-context` entry and
   `/runtime` > Hooks to confirm it loaded.
4. **Fallback diagnosis**: run the hook manually with
   `NMEM_ICODE_CONTEXT=off` removed, `nmem context` on PATH working, and
   NMEM_ICODE_TIMEOUT_SECONDS high enough for a cold Mem start.

If everything passes but tools are missing in chat, the MCP server may be
disabled or the tool scope may exclude them — recheck the server card.
