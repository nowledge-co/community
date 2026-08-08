/**
 * Typed surface of the Amp plugin SDK and the Nowledge Mem connector.
 *
 * This module re-exports the parts of `@ampcode/plugin` the connector relies on
 * and declares local types that model connector-internal contracts (injected
 * ports, narrow runtime contexts used for dependency injection). It is type-only:
 * nothing here exists at runtime, so the plugin loads even when the SDK is
 * present only as a peer dependency.
 *
 * The connector is written against the SDK's own types where they apply
 * ({@link ThreadID}, {@link PluginAPI}), and against narrow local context types
 * where the full SDK context would needlessly couple the collaborator modules to
 * the host. The wiring layer in {@link ../index} adapts between the two.
 */

/**
 * Re-exports the SDK entry point and the branded thread id.
 *
 * `ThreadID` is `` `T-${string}` `` in the SDK: a branded template-literal type.
 * Using it everywhere lets the compiler catch values that are not real Amp
 * thread ids.
 */
export type { PluginAPI, ThreadID } from "@ampcode/plugin"

/**
 * JSON-Schema object accepted by `amp.registerTool` as a tool `inputSchema`.
 *
 * Mirrors {@link PluginToolDefinition.inputSchema} from the SDK so the tool
 * registry in {@link ../tools} is fully typed without any conversion at the
 * boundary.
 */
export interface JsonSchema {
  /** Always `"object"` for tool inputs. */
  readonly type: "object"
  /** Property definitions keyed by argument name. */
  readonly properties?: Record<string, object>
  /** Names of required properties. Mutable to match the SDK's `string[]`. */
  readonly required?: string[]
  /** Permits the extra keys the SDK's input schema type allows. */
  readonly [key: string]: unknown
}

/**
 * Minimal signal a registered tool execute function returns.
 *
 * The connector always returns a JSON string (or void) so the agent receives a
 * uniform, parseable payload. The SDK accepts `string | content-block[]`; this
 * narrower type documents the connector's contract and stays assignable.
 */
export type ToolExecuteResult = string | void

/**
 * Narrow runtime context the tool execute handlers depend on.
 *
 * Only the active thread id is read (for session capture). Declaring just that
 * keeps the tools module decoupled from the full {@link PluginToolContext}; the
 * wiring layer adapts the SDK context into this shape.
 */
export interface ToolContext {
  /** The active thread, if any. */
  readonly thread?: { readonly id: import("@ampcode/plugin").ThreadID }
}

/**
 * Narrow runtime context the command handlers depend on.
 *
 * Declares only the UI helpers and thread id the commands use, so the commands
 * module stays decoupled from the full {@link PluginCommandContext}.
 */
export interface CommandContext {
  /** Prompt the user for free text. Provided by Amp's UI layer. */
  readonly input: (message: string) => Promise<string | undefined>
  /** Show a non-blocking notification. Provided by Amp's UI layer. */
  readonly notify: (message: string) => Promise<void>
  /** The active thread id, when a thread is open. */
  readonly threadId: import("@ampcode/plugin").ThreadID | undefined
}

/**
 * Registration descriptor returned by {@link ../commands.createCommandRegistrations}.
 *
 * Each entry maps to one `amp.registerCommand` call performed by the wiring
 * layer in {@link ../index}.
 */
export interface CommandRegistration {
  /** Command id shown in the palette as `nowledge-mem:<suffix>`. */
  readonly id: string
  /** Human-readable title. */
  readonly title: string
  /** Optional grouping category. */
  readonly category: string
  /** Short description. */
  readonly description: string
  /** Handler invoked when the command is selected. */
  readonly execute: (ctx: CommandContext) => Promise<void>
}

/**
 * Minimal signature of `node:child_process.execFile` the CLI client depends on.
 *
 * Declared locally (rather than importing the full Node type) so the test suite
 * can supply a narrow fake without pulling in Node-specific typings, and so the
 * connector stays host-independent at the type level.
 *
 * @param file - Executable to invoke (`nmem`).
 * @param args - Argument array; each element is passed as a separate argv entry.
 * @param callback - Receives any error, stdout, and stderr as strings.
 */
export type ExecFileFn = (
  file: string,
  args: readonly string[],
  callback: (error: Error | null, stdout: string, stderr: string) => void,
) => void
