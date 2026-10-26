# Import transcripts from isolated Codex homes

Some hosts (including Ekko/Hermes Studio) launch Codex with a separate home
for each runtime. An ordinary shell may not inherit that runtime selection.
Consequently, the default `~/.codex/sessions` and `~/.codex/archived_sessions`
can be absent even though the host has saved conversations.

The workflow below was checked with nmem 0.10.107. Check
`nmem t sync --help` for your installed version before using these flags.
Core discovery feedback is tracked in
[community issue #775](https://github.com/nowledge-co/community/issues/775).

## Locate only the intended roots

Use the host's runtime metadata or configured Codex home to identify the exact
transcript directories. A representative Studio layout is:

```text
~/.hermes-web-ui/coding-agent/model/<profile>/<provider>/codex/runs/<run-id>/sessions/
```

This is an example, not a guaranteed path across host versions. Multiple
profiles, providers and runs can have different roots. Include an archive root
only when it exists and you intend to import it. Do not recursively scan the
whole disk, alter `~/.codex`, or symlink it to one run: that can hide other
history and disturb native Codex. Do not copy transcripts to fabricate a
shared home.

## Preview explicit roots, then import

Replace each placeholder with an existing directory on the machine running
`nmem` (not the remote Mem server). Start with a bounded preview:

```bash
nmem --json t sync --from codex --all-projects \
  --session-dir "/absolute/runtime-A/sessions" \
  --session-dir "/absolute/runtime-B/sessions" \
  --limit 5
```

Inspect the returned session IDs, files, workspaces and count. Remove `--limit`
to preview the full selection before importing it. Confirm the intended Mem
destination and Space; when a specific Space is required, use the same verified
`--space "<space name>"` or `--space-id "<exact ID>"` on preview and apply.
Do not infer that a successful preview has checked remote authentication or
that a limited preview covers every session.

After the user authorizes importing that selection, repeat with `--apply`:

```bash
nmem --json t sync --from codex --all-projects \
  --session-dir "/absolute/runtime-A/sessions" \
  --session-dir "/absolute/runtime-B/sessions" \
  --apply
```

`--session-dir` is repeatable. Pass concrete directories rather than an
unexpanded wildcard. `--all-projects` is not a filesystem-wide search.
An `unchanged` result means the existing thread needed no new messages; inspect
`failed` and per-session results rather than treating an exit code alone as
proof of complete coverage. Let the importer preserve native session identity;
do not create replacement threads to work around conflicts.

Do not add `--distill` just to fix directory discovery: it is a separate
model-processing request that can incur usage. This document changes neither
CLI discovery nor automatic capture. Keep the normal trusted Stop-hook setup
for new turns; historical import is an explicit recovery operation.
