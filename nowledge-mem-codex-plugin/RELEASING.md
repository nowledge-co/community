# Releasing Nowledge Mem for Codex

This package has two surfaces:

1. the Codex plugin itself under `.codex-plugin/` and `skills/`
2. the optional host-level hook installer under `scripts/install_hooks.py`

Codex does not currently load hook assets directly from the plugin directory. The installer bridges that gap by copying the bundled runtime hook into `~/.codex/hooks/`, merging `~/.codex/hooks.json`, and enabling `codex_hooks = true` in `~/.codex/config.toml`.

## Preflight

Run from the repository root:

```bash
node nowledge-mem-codex-plugin/scripts/validate-plugin.mjs
```

## Release Checklist

- bump `.codex-plugin/plugin.json` version
- add a top entry to `CHANGELOG.md`
- bump `integrations.json` -> `integrations[id="codex-cli"].version`
- update expected version checks in `scripts/validate-plugin.mjs`
- keep install examples on `cp -r .../. ...` so `.codex-plugin/` is copied
- keep `scripts/install_hooks.py` idempotent
- keep `hooks/nmem-stop-save.py` focused on direct transcript import via `transcript_path`
- re-run `node nowledge-mem-codex-plugin/scripts/validate-plugin.mjs`

## Manual Smoke Test

After copying the plugin into `~/.codex/plugins/cache/local/nowledge-mem/local/`:

```bash
python3 ~/.codex/plugins/cache/local/nowledge-mem/local/scripts/install_hooks.py
codex exec -C . "Reply with exactly OK and nothing else."
tail -n 20 ~/.codex/log/nowledge-mem-stop-hook.log
```

Expect:

- `hook: Stop`
- `hook: Stop Completed`
- a successful `nmem t import` result in the hook log
