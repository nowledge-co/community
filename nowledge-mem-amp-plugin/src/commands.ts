/**
 * Command-palette registrations for the Nowledge Mem Amp connector.
 *
 * Three commands surface the most common operations through Amp's command
 * palette. Each registration is plain data plus a thin handler that delegates to
 * the same dependencies the tools use, so behavior stays consistent across the
 * tool and command surfaces.
 */

import type { NmemCli } from "./cli"
import type { SessionSyncManager } from "./sync"
import type { CommandContext, CommandRegistration } from "./types"

/** Dependencies required to build the command handlers. */
export interface CommandDeps {
  /** CLI client used by status and search commands. */
  readonly nmem: NmemCli
  /** Capture manager used by the save-thread command. */
  readonly syncManager: SessionSyncManager
}

/** Reads a CLI result string, extracting a human-readable message. */
function summariseCliResult(result: string): string {
  const trimmed = result.trim()
  if (trimmed.length === 0) return "(no output)"
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed
}

/**
 * Builds the three command-palette registrations bound to the given dependencies.
 *
 * @param deps - Injected dependencies (CLI client and capture manager).
 * @returns The command registrations to pass to `amp.registerCommand`.
 */
export function createCommandRegistrations(deps: CommandDeps): CommandRegistration[] {
  return [
    {
      id: "nowledge-mem:status",
      title: "Nowledge Mem: Status",
      category: "Nowledge Mem",
      description: "Check Nowledge Mem server connectivity and configuration.",
      async execute(ctx: CommandContext): Promise<void> {
        const result = await deps.nmem(["status"])
        await ctx.notify(summariseCliResult(result))
      },
    },
    {
      id: "nowledge-mem:save-thread",
      title: "Nowledge Mem: Save Current Session",
      category: "Nowledge Mem",
      description: "Capture the current Amp session as a Nowledge Mem thread.",
      async execute(ctx: CommandContext): Promise<void> {
        const threadId = ctx.threadId
        if (threadId === undefined) {
          await ctx.notify("No active thread to capture.")
          return
        }
        const result = await deps.syncManager.syncNow(threadId)
        if (result.success === true) {
          await ctx.notify(`Saved session as Nowledge Mem thread (${result.messagesSaved} messages).`)
        } else if (result.skipped === true) {
          await ctx.notify(`Session capture skipped: ${result.reason ?? "unknown reason"}.`)
        } else {
          await ctx.notify(`Session capture failed: ${result.error ?? "unknown error"}.`)
        }
      },
    },
    {
      id: "nowledge-mem:search",
      title: "Nowledge Mem: Search Memory",
      category: "Nowledge Mem",
      description: "Search the Nowledge Mem knowledge graph.",
      async execute(ctx: CommandContext): Promise<void> {
        const query = await ctx.input("Search your knowledge graph:")
        if (query === undefined || query.trim().length === 0) {
          await ctx.notify("Search cancelled.")
          return
        }
        const result = await deps.nmem(["m", "search", query.trim()])
        await ctx.notify(summariseCliResult(result))
      },
    },
  ]
}
