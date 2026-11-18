# Changelog

## Unreleased

## 0.2.0

- Explicitly forwards the configured Mem API key to nmem across the host's
  credential scrub, restoring authenticated Cloud/remote CLI operations while
  preserving pinned history credentials and intentional empty authentication.

- Drains already queued turn capture during graceful unload so completed
  headless sessions are imported before the host exits; qualified with a real
  installed DSH launcher, tool turn and packed plugin.
- A cancelled pre-step does not delay healthy startup context on the next turn;
  dash-prefixed exact Space IDs remain CLI option values.

- Adds human-only `/mem-backfill`: metadata listing, explicit selected-session
  preview and one-use confirmation. No startup scan/upload; requires optional
  DSH commands/sessionQuery services (qualified on 0.2.2-rc.2).
- Pins the preview's CLI connection and exact Space for up to ten minutes;
  preserves clean conversation projection and native identities, with bounded
  selections, cancellation and per-session outcomes.
- Serializes historical and automatic imports of the same DSH session within
  the process; native reconciliation still guards concurrent external writers.

## 0.1.9

- Retains recalled event/source dates, explicit saved-date fallback and later
  update evidence already shipped in the community mirror's 0.1.8 rendering.

- Keeps capture running past malformed event data, missing content/source and
  invalid timestamps. Safe existing session IDs stay stable; opaque IDs use a
  collision-resistant namespace instead of collapsing after sanitization.
- Stages private import files under DSH_HOME (default ~/.dsh), outside Linux's
  sandbox-hidden /tmp, and removes each payload after its attempt.
- Reports content-free import failure categories and backs off failed context
  loads and turn captures. A checkpoint conflict can reconcile once; an initial
  FULL conflict is diagnosed without rewriting existing Threads.
- Preserves host decision fields such as startsRequestSeries during injection.
- Falls back to default recall matching when the optional custom regex is invalid.
- Admits DSH 0.2.1-rc.3, 0.2.1-rc.5, 0.2.2-rc.1 and 0.2.2-rc.2 with an expanded
  Windows/Linux test matrix; unknown previews remain excluded.

- Prompt-time recall triggers and searches only on text the user typed
  (`source.kind: "user"`). Runtime context, background job notices with their
  output, subagent reports, goal rounds, other plugins' context, tool results
  and reasoning no longer start a search or become its query.
- English recall keywords match whole words and their plural or verb forms, so
  `mem` no longer fires on "meme", "member" or "memo", nor `prior` on
  "priority". Chinese keywords still match as substrings.
- Quotes nmem arguments for PowerShell on Windows. Text with an apostrophe or a
  curly quote no longer makes the search or the Thread import fail or get split.
- Passes flag-like search queries after -- and titles as --title=value so
  user text cannot become a CLI option.

## 0.1.7

- Captures human input and assistant reply text instead of the model execution
  trace. Tool-call steps (including their narration), tool results, reasoning,
  and producer-injected context no longer inflate synchronized Threads or titles.
- Keeps existing session/message identities and acknowledged import checkpoints.
  Previously imported noise is not automatically deleted or rewritten.

## 0.1.6

- Admits the tested DSH 0.2.1-rc.2 host packages without an unsafe version
  exemption, with compatibility coverage on Ubuntu and Windows.

- Restores startup context, prompt recall, and turn-end capture on DSH
  0.1.7-rc.1 and 0.2.1-alpha.1 through `shell.execute(...).result()`, while
  retaining the legacy `shell.run()` path and host-authorized sandbox retry.
- Emits the v4-compatible `plugin:nowledge-mem` source kind and recognizes
  both legacy and migrated messages for context deduplication, recall queries,
  transcript filtering, and thread titles.
- Explicitly admits the tested DSH and Cordis preview versions in optional
  peer ranges and adds regression coverage using the host's message, Session,
  and v4 admission implementations.
- Adds ESLint and GitHub Actions CI with Ubuntu/Windows compatibility tests
  for DSH 0.1.7-rc.1 and 0.2.1-alpha.1, plus npm package validation.

## 0.1.5

- Restores turn-end capture on DeepSeek Harness 0.1.2 and newer by reading one
  stable `snapshotEvents()` view per import attempt. Older supported hosts keep
  an explicit `events` fallback; missing or broken event APIs now surface a
  diagnosable compatibility error instead of an empty successful sync.
- Preserves structured checkpoint-conflict output from a non-zero `nmem`
  import so the existing one-shot full reconciliation can actually run.

## 0.1.4

- Flushes DSH write-behind session persistence before exporting a completed
  turn, while keeping Mem capture fail-open when the host storage backend is
  unavailable.
- Detects the Context Bundle from DSH's model-visible derived message surface,
  so compaction can re-inject it when the prior snapshot is no longer visible.

## 0.1.3

- Makes the sandbox-unavailable `danger-full-access` retry fail closed unless
  the plugin explicitly opts in and the DSH host resolves the policy.
- Keeps the imported thread title session-scoped across incremental batches and
  rebuilds reconciliation arguments from the full payload.
- Turn-end capture now imports only events after the last acknowledged DSH
  sequence, stamps stable message external IDs, and replays safely after event
  compaction or a failed write.
- Prompt-time recall no longer fires on a bare continuation prompt such as
  "continue" or "继续". Since the prompt is also the search query, recalling on
  a content-free continuation could surface unrelated memories.

## 0.1.2

- Omits unset MCP auth and identity headers so DSH boots cleanly with a local unauthenticated Nowledge Mem server.
- Guards `nmem` shell calls and retries Windows sandbox-unavailable failures with an explicit `danger-full-access` policy instead of rejecting DSH event listeners.

## 0.1.1

- Marks DeepSeek Harness runtime packages as optional peers so `pnpm` does not try to fetch unpublished DSH internals during GitHub or tarball install.

## 0.1.0

- Initial community DeepSeek Harness bundle.
- Adds native Context Bundle injection, prompt-time recall, Mem MCP tools, and turn-end DSH transcript import.
