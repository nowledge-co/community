import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
  readonly threadMessageOptions: Array<{
    readonly full: boolean
    readonly from: "start" | "end"
    readonly offset: number
    readonly limit: number
  }>
  readonly threads: {
    readonly get: (threadId: string) => {
      readonly messages: (options: {
        readonly full: boolean
        readonly from: "start" | "end"
        readonly offset: number
        readonly limit: number
      }) => Promise<unknown[]>
    }
  }
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
  const threadMessageOptions: FakeAmp["threadMessageOptions"] = []
  return {
    events,
    disposers,
    tools,
    toolDefinitions,
    commands,
    commandHandlers,
    threadMessageOptions,
    logger: { log: vi.fn() },
    system: { workspaceRoot: { toString: () => "/workspace" } },
    threads: {
      get: () => ({
        messages: async (options) => {
          threadMessageOptions.push(options)
          return [{ role: "user", id: "u1", content: [{ type: "text", text: "hello" }] }]
        },
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
    vi.stubEnv("NMEM_AMP_DEBUG", "")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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
    expect(amp.threadMessageOptions).toEqual([{ full: true, from: "start", offset: 0, limit: 20 }])

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
    agentEnd!({
      thread: { id: "T-one" },
      messages: [
        { role: "user", id: "u2", content: [{ type: "text", text: "follow up" }] },
        { role: "assistant", id: "a2", content: [{ type: "text", text: "done" }] },
      ],
    })
    amp.disposers[0]!()
    expect(amp.logger.log).not.toHaveBeenCalled()
  })

  it("stays silent on stderr by default and logs lifecycle only under NMEM_AMP_DEBUG", async () => {
    const amp = createFakeAmp()
    const mod = await import("../src/index")
    mod.default(amp as unknown as Parameters<typeof mod.default>[0])
    amp.disposers[0]!()
    expect(amp.logger.log).not.toHaveBeenCalled()

    const debugAmp = createFakeAmp()
    vi.stubEnv("NMEM_AMP_DEBUG", "1")
    mod.default(debugAmp as unknown as Parameters<typeof mod.default>[0])
    debugAmp.disposers[0]!()

    expect(debugAmp.logger.log).toHaveBeenCalledTimes(2)
    expect(vi.mocked(debugAmp.logger.log).mock.calls[0]![0]).toMatch(/^amp connector loaded: \d+ bytes/)
    expect(vi.mocked(debugAmp.logger.log).mock.calls[1]![0]).toBe("amp connector disposed")
  })

  it("paginates the full transcript from the start", async () => {
    const calls: Array<{ full: boolean; from: "start" | "end"; offset: number; limit: number }> = []
    const transcript = Array.from({ length: 45 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      id: `message-${index}`,
      content: [{ type: "text", text: `message ${index}` }],
    }))
    const amp = createFakeAmp()
    const paginatedAmp = {
      ...amp,
      threads: {
        get: () => ({
          messages: async (options: { full: boolean; from: "start" | "end"; offset: number; limit: number }) => {
            calls.push(options)
            return transcript.slice(options.offset, options.offset + options.limit)
          },
        }),
      },
    }
    const mod = await import("../src/index")

    const messages = await mod.readThreadMessagesViaSdk(
      paginatedAmp as unknown as Parameters<typeof mod.readThreadMessagesViaSdk>[0],
      "T-one" as Parameters<typeof mod.readThreadMessagesViaSdk>[1],
    )

    expect(messages).toHaveLength(45)
    expect(messages.map((message) => (message as { id: string }).id)).toEqual(
      transcript.map((message) => message.id),
    )
    expect(calls).toEqual([
      { full: true, from: "start", offset: 0, limit: 20 },
      { full: true, from: "start", offset: 20, limit: 20 },
      { full: true, from: "start", offset: 40, limit: 20 },
    ])
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
    // A second session start should preload a different session independently.
    sessionStart!({ thread: { id: "T-two" } })
    expect(await agentStart!({ thread: { id: "T-two" } })).toEqual({
      message: {
        content: '[Nowledge Mem Context Bundle]\n{"bundle":true}',
        display: false,
      },
    })
  })
})
