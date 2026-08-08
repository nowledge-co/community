/**
 * Session-start bootstrap for the Nowledge Mem Amp connector.
 *
 * The Context Bundle is fetched once on `session.start` (the earliest event)
 * and consumed on the first `agent.start` of that session. Subsequent
 * `agent.start` calls within the same session return an empty result, so the
 * bundle is injected exactly once per session — not on every prompt. This
 * keeps per-turn cost at zero (no CLI call after the first turn) while still
 * giving the agent its Nowledge Mem identity, space, rules, and Working Memory
 * at the start of the conversation.
 *
 * `session.start` is fire-and-forget (its handler returns void), so the fetch
 * is kicked off there and its result stored. `agent.start` is a request event
 * (its handler returns an `AgentStartResult`), so it reads the stored result
 * and returns it as a hidden message.
 *
 * Everything is fail-open: a Mem outage or disabled bootstrap leaves the
 * prompt untouched.
 */

import type { NmemCli } from "./cli"
import { isNmemErrorPayload } from "./tools"

/**
 * The reminder prefix shown before the Context Bundle so the agent can tell the
 * injected context apart from the user's own message.
 */
const REMINDER_PREFIX = "[Nowledge Mem Context Bundle]"

/** Maximum characters of the Context Bundle to inject, keeping prompts lean. */
const MAX_BUNDLE_CHARS = 4000

/**
 * Builds the `agent.start` result message from a Context Bundle CLI output.
 *
 * Returns `undefined` (meaning "inject nothing") when the bundle is missing or
 * an error, so a failed Mem connection never pollutes the user's prompt. When
 * the bundle is valid, it is truncated to {@link MAX_BUNDLE_CHARS} and prefixed
 * with {@link REMINDER_PREFIX}.
 *
 * @param bundleOutput - Raw `nmem --json context` stdout.
 * @returns The message content to inject, or `undefined` to inject nothing.
 */
export function buildBootstrapMessage(bundleOutput: string): string | undefined {
  if (bundleOutput.trim().length === 0) return undefined
  if (isNmemErrorPayload(bundleOutput)) return undefined
  const trimmed = bundleOutput.length > MAX_BUNDLE_CHARS
    ? `${bundleOutput.slice(0, MAX_BUNDLE_CHARS)}…`
    : bundleOutput
  return `${REMINDER_PREFIX}\n${trimmed}`
}

/** Dependencies required by {@link BootstrapManager}. */
export interface BootstrapDeps {
  /** CLI client used to read the Context Bundle. */
  readonly nmem: NmemCli
}

/** Options controlling whether the bootstrap injection is active. */
export interface BootstrapOptions {
  /** Source application tag passed to the Context Bundle CLI call. */
  readonly sourceApp: string
  /**
   * When `false`, the manager injects nothing. Lets users disable bootstrap via
   * `NMEM_AMP_BOOTSTRAP=0` without uninstalling the plugin.
   */
  readonly enabled: boolean
}

/**
 * Minimal shape of the value returned by an `agent.start` handler.
 *
 * Mirrors the SDK's `AgentStartResult` without importing the full type, so this
 * module stays decoupled from `@ampcode/plugin` and unit-testable in isolation.
 * The `message` field is optional: omitting it means "inject nothing", matching
 * the SDK contract where every field on `AgentStartResult` is optional.
 */
export interface AgentStartResultValue {
  /** One message appended after the user's content in the user message. */
  readonly message?: {
    /** The text to append. */
    readonly content: string
    /** Whether to show the message in the UI. */
    readonly display: boolean
  }
}

/** Per-session state for the bootstrap preload/consume cycle. */
interface SessionState {
  /** The in-flight preload promise, or `undefined` if preload was not started. */
  preloadPromise: Promise<string | null | undefined> | undefined
  /** The resolved message content after preload completes. */
  preloadedMessage: string | undefined | null
  /** Whether the preloaded message has been consumed by an agent.start handler. */
  consumed: boolean
}

/**
 * Manages the preload/consume bootstrap lifecycle.
 *
 * One manager instance serves all sessions for a plugin run. Per-session state
 * is keyed by thread id.
 */
export class BootstrapManager {
  private readonly deps: BootstrapDeps
  private readonly options: BootstrapOptions
  private readonly sessions = new Map<string, SessionState>()

  /**
   * @param deps - Injected dependencies (CLI client).
   * @param options - Bootstrap options.
   */
  public constructor(deps: BootstrapDeps, options: BootstrapOptions) {
    this.deps = deps
    this.options = options
  }

  /**
   * Preloads the Context Bundle for a session.
   *
   * Called on `session.start`. Kicks off the CLI fetch and stores the promise
   * so that a subsequent `consume` can await it. Fail-open: errors resolve to
   * `null` (distinct from `undefined`, meaning "not yet started").
   *
   * @param threadId - The thread id for this session.
   */
  public preload(threadId: string): void {
    if (!this.options.enabled) return
    const state = this.stateFor(threadId)
    if (state.preloadPromise !== undefined) return
    state.preloadPromise = this.deps
      .nmem(["context", "--source-app", this.options.sourceApp])
      .then((bundle) => {
        const message = buildBootstrapMessage(bundle) ?? null
        state.preloadedMessage = message
        return message
      })
      .catch(() => {
        state.preloadedMessage = null
        return null
      })
  }

  /**
   * Consumes the preloaded Context Bundle for a session.
   *
   * Called on `agent.start`. Awaits the preload promise if it is still in
   * flight, then returns the preloaded message on the first call for a session.
   * Subsequent calls return an empty result. When bootstrap is disabled or the
   * bundle was empty, always returns an empty result.
   *
   * @param threadId - The thread id for this session.
   * @returns The `agent.start` result with the hidden message, or an empty object.
   */
  public async consume(threadId: string): Promise<AgentStartResultValue> {
    if (!this.options.enabled) return {}
    const state = this.stateFor(threadId)
    if (state.preloadPromise !== undefined) {
      await state.preloadPromise
    }
    if (state.consumed) return {}
    state.consumed = true
    if (state.preloadedMessage === undefined || state.preloadedMessage === null) return {}
    return { message: { content: state.preloadedMessage, display: false } }
  }

  /**
   * Discards all cached session bootstrap state during plugin disposal.
   *
   * In-flight CLI promises are allowed to settle, but their results are no
   * longer reachable by a subsequent agent-start handler.
   */
  public dispose(): void {
    this.sessions.clear()
  }

  /**
   * Returns the per-session state, creating it on first access.
   *
   * @param threadId - The thread id.
   * @returns The mutable state record for the session.
   */
  private stateFor(threadId: string): SessionState {
    let state = this.sessions.get(threadId)
    if (state === undefined) {
      state = { preloadPromise: undefined, preloadedMessage: undefined, consumed: false }
      this.sessions.set(threadId, state)
    }
    return state
  }
}
