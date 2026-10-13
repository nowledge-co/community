---
name: status
description: Report Nowledge Mem connection and configuration status from iCode — server health, version, storage statistics, and which integration surfaces (MCP tools, startup hook) are active.
---

Report the Nowledge Mem connection status.

1. `nmem status` — server health + version.
2. `nmem stats` — database statistics (memories, threads, sources).
3. In-session surfaces: which Nowledge MCP tools are currently loaded (and
   whether progressive disclosure is hiding the rest), and whether the
   session-start context reminder fired.

Summarize briefly: server up/down, version drift between CLI and server if
any, and anything from the stats the user asked about.
