# ⏳ osc-progress — Tiny lib for OSC 9;4 terminal progress.

Tiny TypeScript helper for **OSC 9;4** terminal progress (Ghostty / WezTerm / Windows Terminal).

## Install

```bash
pnpm add osc-progress
```

## Usage

```ts
import process from 'node:process'
import { startOscProgress } from 'osc-progress'

const stop = startOscProgress({
  label: 'Fetching',
  write: (chunk) => process.stderr.write(chunk),
  env: process.env,
  isTty: process.stderr.isTTY,
})

// ...do work...

stop()
```

Indeterminate (spinner-like) mode:

```ts
import { startOscProgress } from 'osc-progress'

const stop = startOscProgress({ label: 'Waiting', indeterminate: true })
// ...
stop()
```

Strip OSC progress from stored logs:

```ts
import { sanitizeOscProgress } from 'osc-progress'

const clean = sanitizeOscProgress(text, /*keepOsc*/ process.stdout.isTTY)
```

## API

### `supportsOscProgress(env?, isTty?, options?)`

Returns `true` when emitting OSC 9;4 progress makes sense.

Heuristics:
- requires a TTY
- enables for `TERM_PROGRAM=ghostty*`, `TERM_PROGRAM=wezterm*`, or `WT_SESSION` (Windows Terminal)

Optional overrides:
- `options.disabled` / `options.force`
- `options.disableEnvVar` / `options.forceEnvVar` (expects `= "1"`)

### `startOscProgress(options?)`

Starts a best-effort progress indicator and returns `stop(): void`.

Notes:
- `label` is appended as extra payload; **not part of the canonical OSC 9;4 spec** (many terminals ignore it, some show it).
- default is a timer-driven `0% → 99%` progression (never completes by itself).
- `terminator` defaults to `st` (`ESC \\`); `bel` is also supported.

### `createOscProgressController(options?)`

Returns a small stateful controller:
- `setIndeterminate(label)`
- `setPercent(label, percent)`
- `setPaused(label)` (state `4`)
- `done(label?)` (emit 100% then clear)
- `fail(label?)` (emit error state then clear)
- `clear()`
- `dispose()` (cleanup timers/listeners)

Use this when you already have real progress (bytes/total, seconds/total) and want determinate terminal progress instead of the timer-based ramp.

Notes:
- returns no-op methods when `supportsOscProgress(...)` is false
- `percent` is rounded and clamped to `0..100`
- `clear()` uses the last label (or the initial `options.label` if nothing was set yet)
- progress updates are throttled by default (deduped + max ~1 update/150ms)
- `stallAfterMs` emits a paused/stalled state when updates stop
- `clearDelayMs` controls how long `done()` / `fail()` wait before clearing
- `autoClearOnExit` clears on process exit

```ts
import process from 'node:process'
import { createOscProgressController } from 'osc-progress'

const osc = createOscProgressController({
  env: process.env,
  isTty: process.stderr.isTTY,
  write: (chunk) => process.stderr.write(chunk),
  stallAfterMs: 10_000,
  clearDelayMs: 200,
  autoClearOnExit: true,
})

osc.setIndeterminate('Connecting')
osc.setPercent('Downloading', 12)
osc.setPercent('Downloading', 67)
osc.done()
```

#### Controller options

- `stallAfterMs`: emit state=4 when no updates are seen within this window.
- `stalledLabel`: override stalled label (string or formatter).
- `clearDelayMs`: delay before `done()`/`fail()` clears.
- `autoClearOnExit`: clear progress on process exit.

### `sanitizeOscProgress(text, keepOsc)`

Removes OSC 9;4 progress sequences (terminated by `BEL`, `ST` (`ESC \\`), or `0x9c`).

## Semantics / portability

OSC 9;4 is widely implemented, but state `4` is ambiguous across terminals (some treat it as `paused`, some as `warning`).
This library exposes the raw numeric state and does not try to reinterpret it.
