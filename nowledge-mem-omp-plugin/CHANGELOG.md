# Changelog

## [0.1.4] - 2026-10-29

### Fixed

- Capture human OMP dialogue instead of internal context, tool activity, and
  reasoning. Distinguish user input from agent-attributed `role=user` messages.
- Match the default Codex import's text projection: preserve complete human
  text, commentary/final replies, skill drafts, and attachment captions; omit
  image/file payloads and synthetic placeholders.
- Require Pi 0.8.15 or newer for the OMP-specific projection. Native identities,
  acknowledged deltas, and startup context injection remain unchanged.

## [0.1.3] - 2026-10-11

### Fixed

- Search first, inspect at most one small targeted thread range per question, and report evidence gaps rather than walking offsets.
- Preserve explicit target ranges, progressive graph exploration and existing session capture.

## [0.1.2] - 2026-10-08

- Inherit Pi's acknowledged message-suffix sync so repeated lifecycle events no
  longer resend the complete OMP branch.
- Require Pi 0.8.10 or newer on the compatible 0.8.x line.
- Publish through GitHub OIDC trusted publishing with a verified npm artifact.

## 0.1.1

- Inherit the Pi runtime's resilient thread-sync timeout, safe create-to-append fallback, latest-turn coalescing, and quiet interactive diagnostics.

## 0.1.0

- Initial OMP plugin package.
- Adds startup Context Bundle / Working Memory injection through OMP's extension lifecycle.
- Adds automatic OMP conversation branch sync as Mem threads with `source_app=omp`.
- Bundles Nowledge Mem skills for recall, distillation, handoff summaries, and status checks.
