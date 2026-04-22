# Releasing

## Version Bump

1. Update `version` for the `copilot-cli` entry in `integrations.json` (repo root)
2. Update `version` in `.claude-plugin/plugin.json`
3. Add a new section to `CHANGELOG.md`

## Testing

Before release:

1. Verify `integrations.json` is valid JSON: `python3 -m json.tool integrations.json > /dev/null`
2. Verify `hooks/hooks.json` is valid JSON: `python3 -m json.tool hooks/hooks.json > /dev/null`
3. Run fixture tests: `uv run --with pytest pytest tests/ -v`
4. Install the plugin locally and verify:
   - Working Memory loads at session start
   - Per-turn nudge appears
   - Stop hook captures sessions from the packaged plugin runtime (check `~/.copilot/nowledge-mem-hooks/hook-log.jsonl` if the compatibility fallback path is used)
   - Copilot shows only the skill-backed surface (no extra command-doc entries)
   - The remaining skills still match actual behavior (`read-working-memory`, `search-memory`, `distill-memory`, `save-thread`)
   - `nmem status` still works as the direct troubleshooting path

## Release

1. Commit all changes
2. Push to the `community` repository
3. The Nowledge community marketplace auto-updates from the repo

## Post-Release

1. Update the desktop app's plugin registry awareness (fetches `integrations.json` at runtime)
2. Announce in Discord if significant changes
