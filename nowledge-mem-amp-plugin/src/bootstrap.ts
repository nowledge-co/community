/**
 * Session-start bootstrap for the Nowledge Mem Amp connector.
 *
 * Amp exposes an `agent.start` request event whose handler may return an
 * {@link AgentStartResult} carrying one message appended after the user's
 * prompt content. The connector uses this to inject a compact Context Bundle
 * reminder at the start of each turn, so the agent is aware of its Nowledge
 * Mem identity, active space, rules, and Working Memory without a separate
 * tool call.
 *
 * This module owns only the pure decision logic: whether to inject, and what
 * text to inject. Fetching the bundle and registering the handler live in the
 * wiring layer ({@link ../index}) so this module stays free of host coupling
 * and fully unit-testable.
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

/** Dependencies required by {@link createBootstrapHandler}. */
export interface BootstrapDeps {
  /** CLI client used to read the Context Bundle. */
  readonly nmem: NmemCli
}

/** Options controlling whether the bootstrap injection is active. */
export interface BootstrapOptions {
  /** Source application tag passed to the Context Bundle CLI call. */
  readonly sourceApp: string
  /**
   * When `false`, the handler injects nothing. Lets users disable bootstrap via
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

/**
 * Builds an `agent.start` handler that injects the Context Bundle.
 *
 * The handler is async because it shells out to `nmem`. It never throws: a
 * failed fetch is swallowed and the handler returns an empty result (no
 * injection), so a Mem outage cannot break the agent's turn.
 *
 * @param deps - Injected dependencies (CLI client).
 * @param options - Bootstrap options.
 * @returns An async handler returning the `agent.start` result object.
 */
export function createBootstrapHandler(
  deps: BootstrapDeps,
  options: BootstrapOptions,
): () => Promise<AgentStartResultValue> {
  /**
   * Reads the Context Bundle and returns the `agent.start` result.
   *
   * @returns The result object with a hidden message, or an empty object.
   */
  return async function onAgentStart(): Promise<AgentStartResultValue> {
    if (!options.enabled) return {}
    try {
      const bundle = await deps.nmem(["context", "--source-app", options.sourceApp])
      const message = buildBootstrapMessage(bundle)
      if (message === undefined) return {}
      // display:false hides the injection from the transcript UI while still
      // letting the model see it as part of the user message body.
      return { message: { content: message, display: false } }
    } catch {
      return {}
    }
  }
}
