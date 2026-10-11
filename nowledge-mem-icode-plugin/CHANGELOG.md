# Changelog

## 0.1.0

- Initial iCode (Chrys) integration.
- Installer merges the `nowledge-mem` MCP server into an agent profile
  (`tools.mcp`, HTTP transport, progressive disclosure), installs the
  `user_prompt_submit` Context Bundle hook into `~/.chrys/hooks/hooks.yaml`,
  and copies the shared skills into `~/.agents/skills`.
- Honest capability set: working memory, search, distill, guided recall, and
  status via MCP + hook; no automatic thread capture (no registered iCode
  transcript parser yet — `save-handoff` skill instead).
- Idempotent install with timestamped backups and `--remove` manifest.
