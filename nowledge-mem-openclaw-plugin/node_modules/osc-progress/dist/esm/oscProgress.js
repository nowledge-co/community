import process from 'node:process';
/**
 * OSC 9;4 progress prefix (`ESC ] 9 ; 4 ;`).
 *
 * Typical emitted forms:
 * - `ESC ] 9;4;<state>;<percent>;<payload> ST`
 * - `ESC ] 9;4;<state>;;<payload> ST` (indeterminate)
 */
export const OSC_PROGRESS_PREFIX = '\u001b]9;4;';
/** String Terminator (ST): `ESC \\` */
export const OSC_PROGRESS_ST = '\u001b\\';
/** Bell (BEL): `0x07` */
export const OSC_PROGRESS_BEL = '\u0007';
/** C1 String Terminator (ST): `0x9c` */
export const OSC_PROGRESS_C1_ST = '\u009c';
const DEFAULT_THROTTLE_INTERVAL_MS = 150;
const DEFAULT_CLEAR_DELAY_MS = 150;
function resolveTerminator(terminator) {
    return terminator === 'bel' ? OSC_PROGRESS_BEL : OSC_PROGRESS_ST;
}
/**
 * Sanitizes a label/payload so it can't break the surrounding OSC sequence.
 * Removes escape chars and common OSC terminators; trims whitespace.
 */
export function sanitizeLabel(label) {
    const withoutSt = label.replaceAll(OSC_PROGRESS_ST, '');
    const withoutEscape = withoutSt.split('\u001b').join('');
    const withoutTerminators = withoutEscape
        .replaceAll(OSC_PROGRESS_BEL, '')
        .replaceAll(OSC_PROGRESS_C1_ST, '');
    return withoutTerminators.replaceAll(']', '').trim();
}
/**
 * Best-effort check whether OSC 9;4 progress output is likely to work.
 *
 * Default heuristics:
 * - requires `isTty === true`
 * - enables for Ghostty (`TERM_PROGRAM=ghostty*`), WezTerm (`TERM_PROGRAM=wezterm*`), Windows Terminal (`WT_SESSION`)
 *
 * Override knobs:
 * - `options.force` / `options.disabled`
 * - `options.forceEnvVar` / `options.disableEnvVar` (expects value `"1"`)
 */
export function supportsOscProgress(env = process.env, isTty = process.stdout.isTTY, options = {}) {
    if (!isTty)
        return false;
    if (options.disabled)
        return false;
    if (options.force)
        return true;
    if (options.disableEnvVar && env[options.disableEnvVar] === '1') {
        return false;
    }
    if (options.forceEnvVar && env[options.forceEnvVar] === '1') {
        return true;
    }
    const termProgram = (env.TERM_PROGRAM ?? '').toLowerCase();
    if (termProgram.includes('ghostty'))
        return true;
    if (termProgram.includes('wezterm'))
        return true;
    if (env.WT_SESSION)
        return true;
    return false;
}
/**
 * Finds OSC 9;4 progress sequences inside an arbitrary string.
 *
 * Supports three terminators:
 * - ST (`ESC \\`)
 * - BEL (`0x07`)
 * - C1 ST (`0x9c`)
 *
 * Unterminated sequences are ignored (use `stripOscProgress` if you want to drop them).
 */
export function findOscProgressSequences(text) {
    const sequences = [];
    const prefixLen = OSC_PROGRESS_PREFIX.length;
    let searchFrom = 0;
    while (searchFrom < text.length) {
        const start = text.indexOf(OSC_PROGRESS_PREFIX, searchFrom);
        if (start === -1)
            break;
        const after = start + prefixLen;
        const candidates = [];
        const stStart = text.indexOf(OSC_PROGRESS_ST, after);
        if (stStart !== -1) {
            candidates.push({ endExclusive: stStart + OSC_PROGRESS_ST.length, terminator: 'st' });
        }
        const belStart = text.indexOf(OSC_PROGRESS_BEL, after);
        if (belStart !== -1) {
            candidates.push({ endExclusive: belStart + OSC_PROGRESS_BEL.length, terminator: 'bel' });
        }
        const c1Start = text.indexOf(OSC_PROGRESS_C1_ST, after);
        if (c1Start !== -1) {
            candidates.push({ endExclusive: c1Start + OSC_PROGRESS_C1_ST.length, terminator: 'c1st' });
        }
        if (candidates.length === 0) {
            searchFrom = after;
            continue;
        }
        candidates.sort((a, b) => a.endExclusive - b.endExclusive);
        const best = candidates[0];
        sequences.push({
            start,
            end: best.endExclusive,
            raw: text.slice(start, best.endExclusive),
            terminator: best.terminator,
        });
        searchFrom = best.endExclusive;
    }
    return sequences;
}
/**
 * Removes OSC 9;4 progress sequences from `text`.
 *
 * Behavior:
 * - strips sequences terminated by ST/BEL/C1 ST
 * - if a sequence is unterminated, it is removed until end-of-string
 */
export function stripOscProgress(text) {
    const prefixLen = OSC_PROGRESS_PREFIX.length;
    let current = text;
    while (current.includes(OSC_PROGRESS_PREFIX)) {
        const start = current.indexOf(OSC_PROGRESS_PREFIX);
        const after = start + prefixLen;
        const stStart = current.indexOf(OSC_PROGRESS_ST, after);
        const belStart = current.indexOf(OSC_PROGRESS_BEL, after);
        const c1Start = current.indexOf(OSC_PROGRESS_C1_ST, after);
        const ends = [];
        if (stStart !== -1)
            ends.push(stStart + OSC_PROGRESS_ST.length);
        if (belStart !== -1)
            ends.push(belStart + OSC_PROGRESS_BEL.length);
        if (c1Start !== -1)
            ends.push(c1Start + OSC_PROGRESS_C1_ST.length);
        const cutEnd = ends.length === 0 ? current.length : Math.min(...ends);
        current = `${current.slice(0, start)}${current.slice(cutEnd)}`;
    }
    return current;
}
/**
 * Convenience helper:
 * - if `keepOsc` is true, returns the input unchanged (useful when writing to a TTY)
 * - otherwise, strips OSC 9;4 sequences (useful for logs/snapshots)
 */
export function sanitizeOscProgress(text, keepOsc) {
    return keepOsc ? text : stripOscProgress(text);
}
/**
 * Emits a terminal progress indicator using OSC 9;4 and returns `stop()`.
 *
 * Notes:
 * - no-op when `supportsOscProgress(...)` is false
 * - determinate mode ramps `0% → 99%` on a timer; `stop()` clears progress
 * - indeterminate mode emits `state=3` and `stop()` clears progress
 */
export function startOscProgress(options = {}) {
    const { label = 'Working…', targetMs = 10 * 60_000, write = (text) => process.stderr.write(text), indeterminate = false, state = 1, terminator, } = options;
    if (!supportsOscProgress(options.env, options.isTty, options)) {
        return () => { };
    }
    const cleanLabel = sanitizeLabel(label);
    const end = resolveTerminator(terminator);
    const send = (st, percent) => {
        if (percent == null) {
            write(`${OSC_PROGRESS_PREFIX}${st};;${cleanLabel}${end}`);
            return;
        }
        const clamped = Math.max(0, Math.min(100, Math.round(percent)));
        write(`${OSC_PROGRESS_PREFIX}${st};${clamped};${cleanLabel}${end}`);
    };
    if (indeterminate) {
        send(3, null);
        return () => {
            send(0, 0);
        };
    }
    const target = Math.max(targetMs, 1_000);
    const startedAt = Date.now();
    send(state, 0);
    const timer = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const percent = Math.min(99, (elapsed / target) * 100);
        send(state, percent);
    }, 900);
    timer.unref?.();
    let stopped = false;
    return () => {
        if (stopped)
            return;
        stopped = true;
        clearInterval(timer);
        send(0, 0);
    };
}
/**
 * Creates a small stateful controller for OSC 9;4 progress output.
 *
 * Useful when you want to drive progress updates yourself (e.g. bytes downloaded / total bytes,
 * or seconds processed / total duration) and switch between indeterminate and determinate modes.
 *
 * Behavior:
 * - no-op controller when `supportsOscProgress(...)` is false
 * - `setIndeterminate(label)` emits `state=3`
 * - `setPercent(label, percent)` emits `state=1` with a clamped integer percent
 * - `clear()` emits `state=0` using the last label
 */
export function createOscProgressController(options = {}) {
    // Default to stderr: progress belongs with other interactive output and avoids polluting stdout pipes.
    const { label = 'Working…', write = (text) => process.stderr.write(text), terminator, stallAfterMs = 0, stalledLabel, clearDelayMs = DEFAULT_CLEAR_DELAY_MS, autoClearOnExit = false, } = options;
    if (!supportsOscProgress(options.env, options.isTty, options)) {
        // No-op controller: callers can keep their code linear and still be safe in unsupported terminals/logs.
        return {
            setIndeterminate: () => { },
            setPercent: () => { },
            setPaused: () => { },
            done: () => { },
            fail: () => { },
            clear: () => { },
            dispose: () => { },
        };
    }
    // Resolve once; avoids branching in hot paths.
    const end = resolveTerminator(terminator);
    const resolveStalledLabel = (baseLabel) => {
        if (typeof stalledLabel === 'function')
            return stalledLabel(baseLabel);
        if (typeof stalledLabel === 'string')
            return stalledLabel;
        return `${baseLabel} (stalled)`;
    };
    const normalizePercent = (percent) => Math.max(0, Math.min(100, Math.round(percent)));
    let lastEmittedLabel = label;
    let lastEmittedPercent = null;
    let lastEmittedState = null;
    let lastEmitAt = 0;
    let hasEmitted = false;
    let lastSeenLabel = label;
    let lastSeenPercent = 0;
    let lastSeenMode = 'indeterminate';
    let stallTimer = null;
    let clearTimer = null;
    let stallEnabled = true;
    const clearStallTimer = () => {
        if (stallTimer !== null) {
            clearTimeout(stallTimer);
            stallTimer = null;
        }
    };
    const clearTimers = () => {
        clearStallTimer();
        if (clearTimer !== null) {
            clearTimeout(clearTimer);
            clearTimer = null;
        }
    };
    const scheduleStall = () => {
        if (!stallAfterMs || stallAfterMs <= 0)
            return;
        if (stallTimer !== null)
            clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
            stallTimer = null;
            if (!stallEnabled)
                return;
            const labelToUse = resolveStalledLabel(lastSeenLabel);
            const percent = lastSeenMode === 'determinate' ? lastSeenPercent : null;
            send(4, percent, labelToUse, true);
        }, stallAfterMs);
        stallTimer.unref?.();
    };
    const scheduleClear = () => {
        if (clearDelayMs <= 0) {
            clear();
            return;
        }
        if (clearTimer !== null)
            clearTimeout(clearTimer);
        clearTimer = setTimeout(() => {
            clearTimer = null;
            clear();
        }, clearDelayMs);
        clearTimer.unref?.();
    };
    const send = (state, percent, nextLabel, force = false) => {
        // Always sanitize; labels often come from user-visible input (filenames/URLs) and must not break OSC.
        const cleanLabel = sanitizeLabel(nextLabel);
        const normalizedPercent = percent == null ? null : normalizePercent(percent);
        const now = Date.now();
        const stateChanged = state !== lastEmittedState;
        const labelChanged = cleanLabel !== lastEmittedLabel;
        const percentChanged = normalizedPercent !== lastEmittedPercent;
        const withinInterval = now - lastEmitAt < DEFAULT_THROTTLE_INTERVAL_MS;
        let shouldEmit = force || !hasEmitted || stateChanged || labelChanged;
        if (!shouldEmit && percentChanged) {
            shouldEmit = !withinInterval;
        }
        if (!shouldEmit)
            return;
        if (normalizedPercent == null) {
            write(`${OSC_PROGRESS_PREFIX}${state};;${cleanLabel}${end}`);
        }
        else {
            write(`${OSC_PROGRESS_PREFIX}${state};${normalizedPercent};${cleanLabel}${end}`);
        }
        lastEmittedLabel = cleanLabel;
        lastEmittedPercent = normalizedPercent;
        lastEmittedState = state;
        lastEmitAt = now;
        hasEmitted = true;
    };
    // Remember the last user-provided label so `clear()` clears the most recent task label.
    const updateSeen = (nextLabel, mode, percent, shouldScheduleStall = true) => {
        lastSeenLabel = nextLabel;
        lastSeenMode = mode;
        lastSeenPercent = percent ?? 0;
        if (shouldScheduleStall) {
            scheduleStall();
        }
    };
    const setIndeterminate = (nextLabel) => {
        stallEnabled = true;
        updateSeen(nextLabel, 'indeterminate', null);
        send(3, null, nextLabel);
    };
    const setPercent = (nextLabel, percent) => {
        const normalized = normalizePercent(percent);
        stallEnabled = true;
        updateSeen(nextLabel, 'determinate', normalized);
        send(1, normalized, nextLabel);
    };
    const setPaused = (nextLabel) => {
        stallEnabled = false;
        const percent = lastSeenMode === 'determinate' ? lastSeenPercent : null;
        updateSeen(nextLabel, lastSeenMode, lastSeenMode === 'determinate' ? lastSeenPercent : null, false);
        send(4, percent, nextLabel, true);
    };
    const clear = () => {
        stallEnabled = false;
        clearTimers();
        send(0, 0, lastSeenLabel, true);
    };
    const done = (nextLabel) => {
        const labelToUse = nextLabel ?? lastSeenLabel;
        stallEnabled = false;
        clearStallTimer();
        updateSeen(labelToUse, 'determinate', 100, false);
        send(1, 100, labelToUse, true);
        scheduleClear();
    };
    const fail = (nextLabel) => {
        const labelToUse = nextLabel ?? lastSeenLabel;
        const percent = lastSeenMode === 'determinate' ? lastSeenPercent : null;
        stallEnabled = false;
        clearStallTimer();
        updateSeen(labelToUse, lastSeenMode, lastSeenMode === 'determinate' ? lastSeenPercent : null, false);
        send(2, percent, labelToUse, true);
        scheduleClear();
    };
    const handleExit = () => {
        clear();
    };
    if (autoClearOnExit) {
        process.once('exit', handleExit);
    }
    const dispose = () => {
        clearTimers();
        if (autoClearOnExit) {
            process.off('exit', handleExit);
        }
    };
    return { setIndeterminate, setPercent, setPaused, done, fail, clear, dispose };
}
//# sourceMappingURL=oscProgress.js.map