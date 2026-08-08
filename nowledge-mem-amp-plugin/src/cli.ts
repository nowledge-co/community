/**
 * `nmem` CLI client.
 *
 * Wraps `node:child_process.execFile` so memory operations (search, save,
 * update, status, handoffs) go through the locally-installed `nmem` binary with
 * safe array-argv escaping. Using `execFile` with an array — rather than a shell
 * string or Amp's `amp.$` helper — keeps argument escaping deterministic and
 * independent of the host shell.
 *
 * The client returns JSON strings (the CLI is always invoked with `--json`) and
 * normalises failures into a JSON `{ "error": ... }` envelope so callers can
 * always `JSON.parse` the result.
 */

import type { ResolvedConfig } from "./config"
import { withAmbientSpaceArg } from "./identity"
import type { ExecFileFn } from "./types"

/** Name of the executable on PATH. */
const NMEM_BINARY = "nmem"

/** Maximum time (milliseconds) to wait for a single CLI invocation. */
const CLI_TIMEOUT_MS = 30_000

/** Substrings in stderr that indicate the binary is not installed. */
const NOT_FOUND_MARKERS = ["command not found", "not recognized"] as const

/**
 * Injectable ports required to build a CLI client.
 */
export interface CliPorts {
  /** `node:child_process.execFile`, injected for testability. */
  readonly execFile: ExecFileFn
}

/** Factory return type: a function that runs the `nmem` CLI. */
export type NmemCli = (args: readonly string[]) => Promise<string>

/**
 * Builds a `nmem` CLI client bound to a resolved configuration.
 *
 * @param config - Resolved configuration supplying ambient identity.
 * @param ports - Injectable ports supplying `execFile`.
 * @returns A function that runs `nmem --json <args>` and returns stdout as a string.
 */
export function createNmemCli(config: ResolvedConfig, ports: CliPorts): NmemCli {
  /**
   * Runs the `nmem` CLI with the given subcommand arguments.
   *
   * Ambient identity is applied via {@link withAmbientSpaceArg}. Errors are
   * caught and re-serialised as JSON so the caller never has to handle a throw.
   *
   * @param args - Subcommand arguments (for example `["m", "search", "query"]`).
   * @returns The trimmed CLI stdout, or a JSON error envelope.
   */
  return async function nmem(args: readonly string[]): Promise<string> {
    const decorated = withAmbientSpaceArg(args, config)
    const fullArgs = ["--json", ...decorated]

    return new Promise<string>((resolve) => {
      ports.execFile(NMEM_BINARY, fullArgs, (error, stdout, stderr) => {
        if (error !== null) {
          resolve(serialiseCliError(error, stderr))
          return
        }
        resolve(stdout.trim())
      })
    })
  }
}

/**
 * Serialises a CLI failure into a JSON error envelope.
 *
 * Missing-binary errors are detected from stderr so the message can point the
 * user at the install instructions rather than reporting a bare exit code.
 *
 * @param error - The error reported by `execFile`.
 * @param stderr - Captured stderr, used to classify the failure.
 * @returns A JSON string of the form `{"error": "..."}`.
 */
function serialiseCliError(error: Error, stderr: string): string {
  const lowerStderr = stderr.toLowerCase()
  const isNotFound = NOT_FOUND_MARKERS.some((marker) => lowerStderr.includes(marker))
  const message = isNotFound
    ? "nmem CLI not found. Install it from Nowledge Mem: Settings > Developer Tools > Install CLI, or run: pip install nmem-cli"
    : (stderr.trim() || error.message)
  return JSON.stringify({ error: message })
}

// Kept exported so callers can reuse the configured timeout if they need to
// build a cancellation wrapper around the CLI client.
export { CLI_TIMEOUT_MS }
