# Releasing

## Version Bump

1. Update `version` in `.claude-plugin/plugin.json`
2. Update `version` for the `copilot-cli` entry in `integrations.json` (repo root)
3. Add a new section to `CHANGELOG.md`

## Testing

Before release:

1. Verify `integrations.json` is valid JSON: `python3 -m json.tool integrations.json > /dev/null`
2. Verify `hooks/hooks.json` is valid JSON: `python3 -m json.tool hooks/hooks.json > /dev/null`
3. Run fixture tests: `python3 -m pytest tests/ -v`
4. Install the plugin locally and verify:
   - Working Memory loads at session start
   - Per-turn nudge appears
   - Stop hook captures sessions (check `~/.copilot/nowledge-mem-hooks/hook-log.jsonl`)
   - Slash commands work (`/save`, `/search`, `/sum`, `/status`)

## Release

1. Commit all changes
2. Push to the `community` repository
3. The Nowledge community marketplace auto-updates from the repo

## Post-Release

1. Update the desktop app's plugin registry awareness (fetches `integrations.json` at runtime)
2. Announce in Discord if significant changes
