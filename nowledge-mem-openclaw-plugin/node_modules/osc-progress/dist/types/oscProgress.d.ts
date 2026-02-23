/**
 * OSC 9;4 progress prefix (`ESC ] 9 ; 4 ;`).
 *
 * Typical emitted forms:
 * - `ESC ] 9;4;<state>;<percent>;<payload> ST`
 * - `ESC ] 9;4;<state>;;<payload> ST` (indeterminate)
 */
export declare const OSC_PROGRESS_PREFIX = "\u001B]9;4;";
/** String Terminator (ST): `ESC \\` */
export declare const OSC_PROGRESS_ST = "\u001B\\";
/** Bell (BEL): `0x07` */
export declare const OSC_PROGRESS_BEL = "\u0007";
/** C1 String Terminator (ST): `0x9c` */
export declare const OSC_PROGRESS_C1_ST = "\u009C";
/** How to terminate the OSC sequence when emitting. */
export type OscProgressTerminator = 'st' | 'bel';
export interface OscProgressSupportOptions {
    /** Force support on/off, overriding env heuristics. */
    force?: boolean;
    disabled?: boolean;
    /** Name of env var which disables OSC progress when set to `"1"`. */
    disableEnvVar?: string;
    /** Name of env var which forces OSC progress when set to `"1"`. */
    forceEnvVar?: string;
}
export interface OscProgressOptions extends OscProgressSupportOptions {
    /**
     * Extra payload appended to the OSC sequence (many terminals ignore this; a few show it).
     * Defaults to `"Working…"`. Sanitized to avoid control chars and terminators.
     */
    label?: string;
    /**
     * Target duration in ms for the internal `0 → 99%` ramp.
     * The implementation never emits 100% by itself; completion is via `stop()`.
     */
    targetMs?: number;
    /** Write function (defaults to `process.stderr.write`). */
    write?: (data: string) => void;
    /** Environment lookup (defaults to `process.env`). */
    env?: NodeJS.ProcessEnv;
    /** TTY flag (defaults to `process.stdout.isTTY`). */
    isTty?: boolean;
    /** When true, emit an indeterminate progress indicator (no percentage). */
    indeterminate?: boolean;
    /**
     * Numeric OSC 9;4 state.
     * - 0: clear/hide
     * - 1: normal
     * - 2: error
     * - 3: indeterminate
     * - 4: ambiguous (paused/warning depending on terminal)
     */
    state?: 1 | 2 | 4;
    /** OSC terminator to use. `st` = ESC \\, `bel` = BEL. */
    terminator?: OscProgressTerminator;
}
export interface OscProgressControllerOptions extends OscProgressOptions {
    /**
     * Emit a stalled state when no updates arrive within this window.
     * Set to 0 to disable (default).
     */
    stallAfterMs?: number;
    /** Customize the stalled label or formatter. Defaults to appending " (stalled)". */
    stalledLabel?: string | ((label: string) => string);
    /**
     * Delay (ms) between done/fail and clearing the progress indicator.
     * Set to 0 for immediate clear.
     */
    clearDelayMs?: number;
    /** Clear progress on process exit. */
    autoClearOnExit?: boolean;
}
export interface OscProgressSequence {
    /** Inclusive start index in the input string. */
    start: number;
    /** Exclusive end index in the input string. */
    end: number;
    /** Raw substring that matched. */
    raw: string;
    /** Which terminator was encountered. */
    terminator: 'st' | 'bel' | 'c1st';
}
export type OscProgressController = {
    /** Emit an indeterminate progress indicator. */
    setIndeterminate: (label: string) => void;
    /** Emit a determinate progress indicator. */
    setPercent: (label: string, percent: number) => void;
    /** Clear/hide the progress indicator. */
    clear: () => void;
};
export type OscProgressReporter = OscProgressController & {
    /** Emit a paused/stalled progress indicator (state=4). */
    setPaused: (label: string) => void;
    /** Emit 100% then clear after the configured delay. */
    done: (label?: string) => void;
    /** Emit error state then clear after the configured delay. */
    fail: (label?: string) => void;
    /** Dispose timers/listeners created by this controller. */
    dispose: () => void;
};
/**
 * Sanitizes a label/payload so it can't break the surrounding OSC sequence.
 * Removes escape chars and common OSC terminators; trims whitespace.
 */
export declare function sanitizeLabel(label: string): string;
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
export declare function supportsOscProgress(env?: NodeJS.ProcessEnv, isTty?: boolean, options?: OscProgressSupportOptions): boolean;
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
export declare function findOscProgressSequences(text: string): OscProgressSequence[];
/**
 * Removes OSC 9;4 progress sequences from `text`.
 *
 * Behavior:
 * - strips sequences terminated by ST/BEL/C1 ST
 * - if a sequence is unterminated, it is removed until end-of-string
 */
export declare function stripOscProgress(text: string): string;
/**
 * Convenience helper:
 * - if `keepOsc` is true, returns the input unchanged (useful when writing to a TTY)
 * - otherwise, strips OSC 9;4 sequences (useful for logs/snapshots)
 */
export declare function sanitizeOscProgress(text: string, keepOsc: boolean): string;
/**
 * Emits a terminal progress indicator using OSC 9;4 and returns `stop()`.
 *
 * Notes:
 * - no-op when `supportsOscProgress(...)` is false
 * - determinate mode ramps `0% → 99%` on a timer; `stop()` clears progress
 * - indeterminate mode emits `state=3` and `stop()` clears progress
 */
export declare function startOscProgress(options?: OscProgressOptions): () => void;
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
export declare function createOscProgressController(options?: OscProgressControllerOptions): OscProgressReporter;
