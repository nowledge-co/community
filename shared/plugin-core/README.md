# Internal plugin core

This private TypeScript package owns acknowledged snapshot selection, persistence
acknowledgement validation, and bounded thread-sync timeout parsing. Host IDs,
destination keys, SDK lifecycle, transport, recovery, and cursor persistence stay
in each connector. File-backed capture uses `nmem`.

See [the spec](../../docs/SHARED_PLUGIN_CORE_SPEC.md) for boundaries and delivery.
The Node 24 requirement here applies to build and test tooling. Generated ESM
targets ES2022 and has no dependency on this package at installation time.

```sh
npm --prefix shared/plugin-core ci --ignore-scripts
npm --prefix shared/plugin-core run typecheck
npm --prefix shared/plugin-core test
npm --prefix shared/plugin-core run build
npm --prefix nowledge-mem-opencode-plugin run build
npm --prefix shared/plugin-core run check
npm --prefix shared/plugin-core run test:artifacts
```

Commit generated files with the source change. Do not edit them directly. The
generator rejects stale or extra files in check mode and produces identical
modules, declarations, and content manifests for every registered consumer.
`consumers.json` records build paths and transitive consumers; capabilities and
installation metadata remain in `integrations.json`.

The snapshot fixtures were captured from OpenCode's implementation at Community
commit `d6e546efe17c9ba48291a67356c4be6f7a7883a8`. Shared fixture results preserve
its valid cursor behavior, prefix framing, and remote/local count distinction.
Separate tests cover intentional hardening of invalid cursor and acknowledgement
counts. Existing adapter suites cover routing, transport, retry, and privacy.

Release jobs first check generated output, then pack the plugin once. Run
`scripts/receipt.ts <plugin> <pack.json> <full-source-sha>` to bind the reviewed
embedded manifest and tarball bytes into `core-receipt.json`. Retain that file,
the original tarball, and `pack.json` together. Verification uses the original
artifact with `--verify`, including after an upload succeeded but readback failed.
Receipt verification uses only Node built-ins and does not rebuild the core.

Artifact checks use disposable directories and host API doubles. They prove
packaging and adapter registration, not acceptance by a live host or Mem backend.
Pi's OMP and Step Code wrappers are loaded against the newly packed Pi payload
with Jiti 2.7, the loader dependency of the inspected Pi SDK 1.1.0 package.
