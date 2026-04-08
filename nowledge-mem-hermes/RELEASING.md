# Upstreaming the Hermes Memory Provider

This integration does **not** currently map to a separate Hermes plugin
catalog. Hermes memory providers are discovered from directories inside the
`hermes-agent` repository itself, so the publish path is an upstream pull
request, not a marketplace upload.

## Why This Release Path

Hermes discovers memory providers from `plugins/memory/<name>/` and loads
providers from `__init__.py` + `plugin.yaml`. There is no equivalent to
ClawHub for Hermes memory providers today.

That means the official distribution path is:

1. port the provider into `NousResearch/hermes-agent`
2. add docs/tests there
3. get the upstream PR merged

Until then, this directory remains a Nowledge-maintained external package with
manual install instructions.

In this workspace, the upstream-ready version already lives under:

```text
3pp/hermes-agent/plugins/memory/nowledge-mem/
```

Treat that tree as the PR source of truth for official Hermes submission.

## Expected Upstream Shape

The upstream PR should add:

```text
plugins/memory/nowledge-mem/
├── __init__.py
├── client.py
├── plugin.yaml
└── README.md
```

`provider.py` can either stay as a helper module in that folder or be folded
into `__init__.py`. Hermes supports both patterns.

## Local Validation Before PR

Validate the Python files compile:

```bash
python3 -m py_compile \
  community/nowledge-mem-hermes/__init__.py \
  community/nowledge-mem-hermes/client.py \
  community/nowledge-mem-hermes/provider.py
```

Then validate behavior in a Hermes checkout:

- copy the provider into `plugins/memory/nowledge-mem/`
- run `hermes memory setup`
- confirm `nowledge-mem` appears in the provider picker
- confirm setup writes only the local timeout config
- confirm the provider activates when `nmem` is available
- confirm Working Memory appears in the system prompt
- confirm prefetch returns recall context
- confirm `nmem_search`, `nmem_save`, and thread tools execute successfully
- confirm cron sessions stay disabled

## Suggested Upstream PR Scope

The cleanest initial PR is:

- provider directory under `plugins/memory/nowledge-mem/`
- provider README
- docs update under Hermes memory-provider docs or user docs
- focused tests for provider loading and basic tool routing

Keep the first PR small. Do not bundle speculative features like graph tools or
session ingest unless Hermes maintainers ask for them.

## Review Checklist

- `plugin.yaml` description matches real behavior
- hook metadata reflects the implemented lifecycle methods
- `is_available()` performs no network calls
- config schema stays minimal
- all storage is profile-scoped through `hermes_home`
- provider fails closed when `nmem` or the backend is unavailable
- README distinguishes Hermes-native memory from Nowledge Mem cross-tool memory
