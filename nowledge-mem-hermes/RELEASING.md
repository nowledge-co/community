# Releasing the Hermes Memory Provider

This integration ships as a standalone Hermes memory-provider plugin. Hermes
no longer accepts new in-tree memory providers under `plugins/memory/`, so the
canonical Nowledge Mem release path is this community package plus the install
script that places it in `~/.hermes/plugins/nowledge-mem/`.

## Why This Release Path

Hermes discovers user memory providers from `$HERMES_HOME/plugins/<name>/` and
loads providers from `__init__.py` + `plugin.yaml`. There is no equivalent to
ClawHub for Hermes memory providers today, and upstream's policy is to keep new
providers out of the core repository.

That means the supported distribution path is:

1. update this directory in `nowledge-co/community`
2. validate against the latest Hermes provider ABC and loader
3. publish/merge the community package
4. optionally send a small upstream docs PR listing Nowledge Mem under Hermes community plugins

Keep `3pp/hermes-agent` as a compatibility reference and E2E target, not as
the release source of truth.

## Local Validation Before Release

Validate the Python files compile:

```bash
python3 -m py_compile \
  community/nowledge-mem-hermes/__init__.py \
  community/nowledge-mem-hermes/client.py \
  community/nowledge-mem-hermes/provider.py
```

Run the provider and installer regression suites:

```bash
cd community
uv run --with pytest pytest nowledge-mem-hermes/tests -q
bash nowledge-mem-hermes/tests/test_setup.sh
```

On Windows, also run the native Windows PowerShell 5.1 installer suite:

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File nowledge-mem-hermes\tests\test_setup.ps1
```

Keep `setup.ps1` ASCII-only and BOM-free. The same source must work when
executed directly by Windows PowerShell 5.1 and when streamed through the
documented `irm ... | iex` command. `test_installer_contract.py` enforces this
before release.

Then validate behavior against a current Hermes checkout:

- install through `setup.sh` into an isolated `$HERMES_HOME/plugins/nowledge-mem/`
- run `hermes memory setup`
- confirm `nowledge-mem` appears in the provider picker
- confirm setup writes only the local timeout config
- confirm the provider activates when `nmem` is available
- confirm Working Memory appears in the system prompt
- confirm prefetch returns recall context
- confirm `nmem_search`, `nmem_save`, and thread tools execute successfully
- confirm cron sessions stay disabled

## Optional Upstream Docs PR

After a community release is available, the only upstream PR we should open is
a small docs-only change:

- add Nowledge Mem to the Hermes community plugins list
- link to `https://github.com/nowledge-co/community/tree/main/nowledge-mem-hermes`
- avoid adding provider code under `plugins/memory/`

Do not reopen the closed in-tree provider PR unless Hermes maintainers change
their memory-provider policy.

## Review Checklist

- `plugin.yaml` description matches real behavior
- hook metadata reflects the implemented lifecycle methods
- `is_available()` performs no network calls
- config schema stays minimal
- all storage is profile-scoped through `hermes_home`
- provider fails closed when `nmem` or the backend is unavailable
- README distinguishes Hermes-native memory from Nowledge Mem cross-tool memory
- `setup.ps1` remains ASCII-only and BOM-free, and both native installers pass
