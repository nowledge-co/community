# Changelog

## [0.1.3] - 2026-11-12

### Fixed

- Declare the exact Space protocol on direct HTTP session synchronization so
  workspaces using current Spaces can accept captured conversations.
- Preserve the selected destination; do not fall back to an unscoped write
  when a configured Space cannot be resolved.

## Unreleased

- `distill-memory` now says where a Team save lands: with no named Space it goes to your personal space ("Only me"), Mem reports the destination, and sharing means saving with `--space`. Guidance only; no runtime change.

## [0.1.2] - 2026-10-11

### Fixed

- Search first, inspect at most one small targeted thread range per question, and report evidence gaps rather than walking offsets.
- Preserve explicit target ranges, progressive graph exploration and existing session capture.

## [0.1.1] - 2026-10-08

- Require Pi 0.8.10 or newer on the compatible 0.8.x line and align runtime version diagnostics.
- Publish through GitHub OIDC trusted publishing with a verified npm artifact.

## [0.1.0] - 2026-09-22

### Added

- Native Step Code package with startup context injection and memory skills.
- Automatic thread synchronization at the settled-agent boundary, with final lifecycle flushes.
- Stable `source_app=step-code` attribution and `nmem t sync --from step-code` historical backfill.
