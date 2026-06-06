# Changelog

## 0.1.1

- Session-start and compaction hooks now load Context Bundle when available, then fall back to Working Memory and the legacy local file. Droid receives identity, active scope, guidance, and current priorities on newer Nowledge Mem installs while older `nmem` clients keep working.

## 0.1.0

- Initial Droid plugin package for Nowledge Mem
- Native Factory marketplace packaging inside the `community` repository
- Working Memory bootstrap hooks for startup, resume, clear, and compaction
- Routed recall, distillation, and status commands through `nmem`
- Honest `save-handoff` semantics with no fake `save-thread` claim
