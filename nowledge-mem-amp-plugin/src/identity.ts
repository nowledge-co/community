/**
 * Ambient-identity decoration for Nowledge Mem requests.
 *
 * Both transports (CLI and HTTP) need to carry the resolved ambient identity so
 * that search, save, and capture land in the correct space and are attributed to
 * the correct AI Identity. This module holds the two pure decorators that apply
 * that identity to a CLI argument array and to an HTTP request body.
 *
 * Keeping these as pure functions of {@link ResolvedConfig} means the CLI and
 * HTTP clients stay transport-only and identity stays testable in isolation.
 */

import type { ResolvedConfig } from "./config"

/**
 * Commands that are scoped to a space and therefore eligible for `--space`.
 *
 * Free-form commands (such as `status`) are deliberately excluded because the
 * Nowledge Mem CLI treats them as global diagnostics.
 */
const SPACE_SCOPED_COMMANDS: ReadonlySet<string> = new Set([
  "context",
  "ctx",
  "wm",
  "m",
  "memories",
  "t",
  "threads",
])

/**
 * Commands that accept agent-identity flags.
 *
 * Only the Context Bundle command resolves an AI Identity, so only it receives
 * `--agent-id` / `--host-agent-id`. Applying them elsewhere would be ignored by
 * the CLI at best and misleading at worst.
 */
const IDENTITY_SCOPED_COMMANDS: ReadonlySet<string> = new Set(["context", "ctx"])

/**
 * Decorates a CLI argument array with the resolved ambient identity.
 *
 * Rules, matching the repository-wide convention:
 *   - `--space` is appended only for space-scoped commands and only when an
 *     ambient space is resolved and the caller has not already set `--space`.
 *   - `--agent-id` / `--host-agent-id` are appended only for the Context Bundle
 *     command, only when resolved, and only when not already present.
 *
 * The original array is never mutated; a new array is returned when decoration
 * applies and the input is returned as-is otherwise.
 *
 * @param args - The base CLI argument array (the first element is the command).
 * @param config - The resolved configuration supplying ambient identity.
 * @returns The possibly-decorated argument array.
 */
export function withAmbientSpaceArg(args: readonly string[], config: ResolvedConfig): string[] {
  const next = args.length === 0 ? [] : [...args]
  const command = next[0] ?? ""

  if (config.ambientSpaceId !== undefined && !next.includes("--space")) {
    if (SPACE_SCOPED_COMMANDS.has(command)) {
      next.push("--space", config.ambientSpaceId)
    }
  }

  if (!IDENTITY_SCOPED_COMMANDS.has(command)) {
    return next
  }

  if (config.ambientAgentId !== undefined && !next.includes("--agent-id")) {
    next.push("--agent-id", config.ambientAgentId)
  }
  if (config.ambientHostAgentId !== undefined && !next.includes("--host-agent-id")) {
    next.push("--host-agent-id", config.ambientHostAgentId)
  }

  return next
}

/**
 * Decorates an HTTP request body with the resolved ambient space.
 *
 * The body is left untouched when no space is resolved, when the body already
 * carries a `space_id`, or when the body is not a plain object (callers pass
 * already-validated objects, but this guard keeps the function total).
 *
 * @param body - The request body to decorate.
 * @param config - The resolved configuration supplying ambient identity.
 * @returns The possibly-decorated body.
 */
export function withAmbientSpace<T>(body: T, config: ResolvedConfig): T | (T & { readonly space_id: string }) {
  if (
    config.ambientSpaceId === undefined ||
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return body
  }
  const record = body as Readonly<Record<string, unknown>>
  if ("space_id" in record) {
    return body
  }
  return { ...body, space_id: config.ambientSpaceId }
}
