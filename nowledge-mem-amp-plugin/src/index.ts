/**
 * Plugin entry point and wiring for the Nowledge Mem Amp connector.
 *
 * This module is intentionally thin: it reads the Amp plugin API and the host
 * environment, builds the resolved configuration and injected ports, and
 * registers tools, commands, session bootstrap, the `agent.end` capture
 * handler, and the dispose callback. All logic lives in the collaborator
 * modules; this layer only composes the Amp host API.
 */

import { execFile as nodeExecFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { PluginAPI, PluginCommandContext, PluginToolContext, ThreadID, ThreadMessage } from "@ampcode/plugin"

import { resolveConfig } from "./config"
import { createNmemCli } from "./cli"
import { createNmemHttp } from "./http"
import { SessionSyncManager } from "./sync"
import { createToolExecutors, TOOL_DEFINITIONS, SOURCE_APP } from "./tools"
import { createCommandRegistrations } from "./commands"
import { BootstrapManager } from "./bootstrap"
import { BEHAVIORAL_GUIDANCE } from "./guidance"
import type { CommandContext, ExecFileFn, ToolContext } from "./types"

/**
 * Reads the shared Nowledge Mem client config file (`~/.nowledge-mem/config.json`).
 *
 * Returns an empty object when the file is missing or unparseable so callers
 * always receive a record.
 *
 * @returns The parsed config object.
 */
function readSharedConfigFile(): Record<string, unknown> {
  const path = join(homedir(), ".nowledge-mem", "config.json")
  if (!existsSync(path)) return {}
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    /* c8 ignore next */
    return {}
  /* c8 ignore start */
  } catch {
    return {}
  }
  /* c8 ignore stop */
}

/**
 * Converts a `URI | null` workspace root to a plain string path.
 *
 * The connector records the workspace root as the Mem thread's `project` field.
 * When Amp runs without a workspace, falls back to the current working directory
 * so the field is always populated.
 *
 * @param value - The SDK workspace root.
 * @returns The resolved project path string.
 */
function resolveProjectPath(value: { toString(): string } | null): string {
  return value === null ? process.cwd() : value.toString()
}

/**
 * Adapts an Amp SDK {@link ThreadMessage} transcript into the loose SDK-message
 * array the messages module normalises.
 *
 * The connector's message converter is deliberately tolerant of unknown shapes;
 * here we hand it the SDK's typed messages, which it reads by duck-typing the
 * `role`, `content` blocks, and `id`. This adapter keeps the converter free of
 * SDK coupling while still feeding it real SDK output.
 *
 * @param messages - SDK thread messages.
 * @returns The messages in the converter's input shape.
 */
function toConverterMessages(messages: readonly ThreadMessage[]): unknown[] {
  return messages.map((message) => {
    const blocks = message.content.map((block) => ({ ...block }))
    return { role: message.role, id: message.id, parts: blocks }
  })
}

/**
 * Reads the full message transcript for an explicit manual save through the
 * Amp SDK.
 *
 * Automatic capture uses the messages already included in the `agent.end`
 * event, avoiding a Plugin RPC entirely. Manual saves retain their full-history
 * contract even though that explicit operation may require a large RPC read.
 *
 * @param amp - The Amp plugin API.
 * @param threadId - The thread id to read.
 * @returns The transcript as a loose array for the converter.
 */
export async function readThreadMessagesViaSdk(amp: PluginAPI, threadId: ThreadID): Promise<unknown[]> {
  const thread = amp.threads.get(threadId)
  const messages: ThreadMessage[] = []
  let offset = 0

  while (true) {
    const page = await thread.messages({ full: true, from: "start", offset, limit: 20 })
    messages.push(...page)
    if (page.length < 20) break
    offset += page.length
  }

  return toConverterMessages(messages)
}

/**
 * Builds the narrow {@link ToolContext} the connector tools expect, from the
 * richer SDK tool context. The SDK guarantees `thread` on tool contexts.
 *
 * @param ctx - The SDK tool context.
 * @returns The narrow tool context.
 */
function adaptToolContext(ctx: PluginToolContext): ToolContext {
  return { thread: { id: ctx.thread.id } }
}

/**
 * Builds the narrow {@link CommandContext} the connector commands expect, from
 * the richer SDK command context.
 *
 * @param ctx - The SDK command context.
 * @returns The narrow command context.
 */
function adaptCommandContext(ctx: PluginCommandContext): CommandContext {
  return {
    input: (message) => ctx.ui.input({ title: message }),
    notify: (message) => ctx.ui.notify(message),
    threadId: ctx.thread?.id,
  }
}

/**
 * Plugin entry point. Wires the resolved configuration and injected ports into
 * the Amp plugin API.
 *
 * @param amp - The Amp plugin API supplied by the host.
 */
export default function ampKnowledgeMem(amp: PluginAPI): void {
  const config = resolveConfig(process.env, readSharedConfigFile)

  const workspaceRoot = resolveProjectPath(amp.system.workspaceRoot)
  const readThreadMessages = (threadId: ThreadID): Promise<unknown[]> => readThreadMessagesViaSdk(amp, threadId)

  const nmem = createNmemCli(config, { execFile: nodeExecFile as ExecFileFn })
  const nmemApi = createNmemHttp(config, {
    fetch: globalThis.fetch.bind(globalThis),
    createAbortController: () => new AbortController(),
  })

  const syncManager = new SessionSyncManager({
    nmemApi,
    readThreadMessages,
    setTimer: (handler, ms) => setTimeout(handler, ms),
    clearTimer: (handle) => clearTimeout(handle),
    sourceApp: SOURCE_APP,
    projectPath: workspaceRoot,
    autoSyncEnabled: config.autoSyncEnabled,
    autoSyncDebounceMs: config.autoSyncDebounceMs,
    ambientSpaceId: config.ambientSpaceId,
  })

  const toolExecutors = createToolExecutors({ nmem, syncManager })
  for (const definition of TOOL_DEFINITIONS) {
    const executor = toolExecutors[definition.name]
    amp.registerTool({ ...definition, execute: (input, ctx) => executor(input, adaptToolContext(ctx)) })
  }

  const registrations = createCommandRegistrations({ nmem, syncManager })
  for (const registration of registrations) {
    amp.registerCommand(
      registration.id,
      { title: registration.title, category: registration.category, description: registration.description },
      async (ctx: PluginCommandContext) => registration.execute(adaptCommandContext(ctx)),
    )
  }

  const logger = amp.logger
  amp.on("agent.end", (event) => {
    syncManager.scheduleSync(event.thread.id, toConverterMessages(event.messages))
  })

  const bootstrapManager = new BootstrapManager(
    { nmem },
    { sourceApp: SOURCE_APP, enabled: config.bootstrapEnabled },
  )
  amp.on("session.start", (event) => {
    bootstrapManager.preload(event.thread.id)
  })
  amp.on("agent.start", async (event) => bootstrapManager.consume(event.thread.id))

  amp.onDispose(() => {
    bootstrapManager.dispose()
    syncManager.dispose()
    if (config.debugLogging) logger.log(`${SOURCE_APP} connector disposed`)
  })

  if (config.debugLogging) {
    logger.log(`${SOURCE_APP} connector loaded: ${BEHAVIORAL_GUIDANCE.length} bytes of guidance registered`)
  }
}

/**
 * Module-level re-export so the static-contract test and tooling can assert the
 * connector ships the documented tool names without importing internal modules.
 */
export { TOOL_DEFINITIONS as AMP_TOOL_DEFINITIONS } from "./tools"
