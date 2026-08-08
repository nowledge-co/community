import { beforeEach, describe, expect, it, vi } from "vitest"

const execFileMock = vi.hoisted(() =>
  vi.fn(
    (
      _file: string,
      _args: readonly string[],
      _options: { readonly timeout: number },
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callback(null, '{"bundle":true}', "")
    },
  ),
)

vi.mock("node:child_process", () => ({ execFile: execFileMock }))

interface FakeAmp {
  readonly events: Map<string, (...args: readonly unknown[]) => unknown>
  readonly disposers: Array<() => void>
  readonly tools: string[]
  readonly toolDefinitions: Array<{
    readonly name: string
    readonly execute: (input: Record<string, unknown>, ctx: { readonly thread: { readonly id: string } }) => Promise<unknown>
  }>
  readonly commands: string[]
  readonly commandHandlers: Map<string, (ctx: {
    readonly ui: {
      readonly input: (options: { readonly title: string }) => Promise<string | undefined>
      readonly notify: (message: string) => Promise<void>
    }
    readonly thread?: { readonly id: string }
  }) => Promise<void>>
  readonly logger: { readonly log: (message: string) => void }
  readonly system: { readonly workspaceRoot: { readonly toString: () => string } | null }
  readonly threads: { readonly get: (threadId: string) => { readonly messages: (options: { readonly full: boolean }) => Promise<unknown[]> } }
  readonly registerTool: (definition: {
    readonly name: string
    readonly execute: (input: Record<string, unknown>, ctx: { readonly thread: { readonly id: string } }) => Promise<unknown>
  }) => void
  readonly registerCommand: (id: string, definition: object, execute: (ctx: unknown) => Promise<void>) => void
  readonly on: (eventName: string, handler: (...args: readonly unknown[]) => unknown) => void
  readonly onDispose: (handler: () => void) => void
}

function createFakeAmp(): FakeAmp {
  const events = new Map<string, (...args: readonly unknown[]) => unknown>()
  const disposers: Array<() => void> = []
  const tools: string[] = []
  const toolDefinitions: FakeAmp["toolDefinitions"] = []
  const commands: string[] = []
  const commandHandlers: FakeAmp["commandHandlers"] = new Map()
  return {
    events,
    disposers,
    tools,
    toolDefinitions,
    commands,
    commandHandlers,
    logger: { log: vi.fn() },
    system: { workspaceRoot: { toString: () => "/workspace" } },
    threads: {
      get: () => ({
        messages: async () => [
          { role: "user", id: "u1", content: [{ type: "text", text: "hello" }] },
        ],
      }),
    },
    registerTool: (definition) => {
      tools.push(definition.name)
      toolDefinitions.push(definition)
    },
    registerCommand: (id, _definition, execute) => {
      commands.push(id)
      commandHandlers.set(id, execute)
    },
    on: (eventName, handler) => {
      events.set(eventName, handler)
    },
    onDispose: (handler) => {
      disposers.push(handler)
    },
  }
}

describe("Amp plugin entrypoint", () => {
  beforeEach(() => {
    execFileMock.mockClear()
  })

  it("registers tools, commands, lifecycle hooks, and disposal", async () => {
    const amp = createFakeAmp()
    const mod = await import("../src/index")
    mod.default(amp as unknown as Parameters<typeof mod.default>[0])

    expect(amp.tools).toHaveLength(10)
    expect(amp.tools).toContain("nowledge_mem_context_bundle")
    expect(amp.commands).toEqual([
      "nowledge-mem:status",
      "nowledge-mem:save-thread",
      "nowledge-mem:search",
    ])
    expect([...amp.events.keys()].sort()).toEqual(["agent.end", "agent.start", "session.start"])
    expect(amp.disposers).toHaveLength(1)

    const saveThread = amp.toolDefinitions.find((definition) => definition.name === "nowledge_mem_save_thread")
    expect(saveThread).toBeDefined()
    const toolResult = await saveThread!.execute({}, { thread: { id: "T-one" } })
    expect(JSON.parse(String(toolResult))).toMatchObject({ skipped: true, reason: "incomplete_turn" })

    const statusCommand = amp.commandHandlers.get("nowledge-mem:status")
    expect(statusCommand).toBeDefined()
    const notifications: string[] = []
    await statusCommand!({
      ui: {
        input: async () => "",
        notify: async (message) => {
          notifications.push(message)
        },
      },
      thread: { id: "T-one" },
    })
    expect(notifications).toEqual(['{"bundle":true}'])

    const agentEnd = amp.events.get("agent.end")
    expect(agentEnd).toBeDefined()
    agentEnd!({ thread: { id: "T-one" } })
    amp.disposers[0]!()
  })

  it("preloads bootstrap on session.start and consumes it once on agent.start", async () => {
    const amp = createFakeAmp()
    const mod = await import("../src/index")
    mod.default(amp as unknown as Parameters<typeof mod.default>[0])

    const sessionStart = amp.events.get("session.start")
    const agentStart = amp.events.get("agent.start")
    expect(sessionStart).toBeDefined()
    expect(agentStart).toBeDefined()

    sessionStart!({ thread: { id: "T-one" } })
    const first = await agentStart!({ thread: { id: "T-one" } })
    const second = await agentStart!({ thread: { id: "T-one" } })

    expect(first).toEqual({
      message: {
        content: '[Nowledge Mem Context Bundle]\n{"bundle":true}',
        display: false,
      },
    })
    expect(second).toEqual({})
    expect(execFileMock).toHaveBeenCalledTimes(1)
  })
})
