# Changelog

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
