# Connect plugins to the workspace open in Mem

Install the current Nowledge Mem CLI on the computer **where the host runs**. These plugins require **nmem 0.10.125 or later**, with `nmem mcp --help` available. Ensure that the host can launch `nmem` on its PATH; a shell alias does not install an executable.

Codex, Cursor, WorkBuddy, CodeBuddy, Agent Plugins, Devin, DimAgent, Kimi Work, and the Craft Agent source example start `nmem mcp` over standard input and output. The same plugin setup works with the desktop backend and with a connected Cloud workspace. The CLI reads its selected endpoint and key when the host opens a session. After moving, start a new host session: the old one stays on its original workspace. Do not copy a key into a plugin manifest.

Custom remote servers and hosted connectors configured by URL are separate connections. If a host cannot run local commands (including a hosted install without the CLI), use its HTTPS connector settings instead. A plugin update does not rewrite your own MCP server definitions.
