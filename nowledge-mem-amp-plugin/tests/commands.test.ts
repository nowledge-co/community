import { describe, expect, it, vi } from "vitest"

import { createCommandRegistrations } from "../src/commands"
import type { NmemCli } from "../src/cli"
import type { SessionSyncManager } from "../src/sync"
import type { CaptureResult } from "../src/sync"
import type { CommandContext } from "../src/types"

/** A fake nmem that returns canned stdout. */
function fakeNmem(stdout: string): NmemCli {
  return (() => Promise.resolve(stdout)) as NmemCli
}

/** A capture-manager stub whose syncNow returns the given result. */
function stubManager(result: CaptureResult): Pick<SessionSyncManager, "syncNow"> {
  return { syncNow: vi.fn(async () => result) }
}

/** Builds a command context capturing notifications. */
function commandContext(overrides: Partial<CommandContext> = {}): CommandContext & { notifications: string[] } {
  const notifications: string[] = []
  return {
    input: vi.fn(async () => "user query"),
    notify: async (message: string) => {
      notifications.push(message)
    },
    threadId: "T-1",
    notifications,
    ...overrides,
  }
}

describe("createCommandRegistrations", () => {
  it("returns three registrations with stable ids", () => {
    const registrations = createCommandRegistrations({ nmem: fakeNmem("{}"), syncManager: stubManager({ success: true, threadId: "t", messagesSaved: 1, title: "x" }) as SessionSyncManager })
    expect(registrations.map((r) => r.id)).toEqual([
      "nowledge-mem:status",
      "nowledge-mem:save-thread",
      "nowledge-mem:search",
    ])
    for (const registration of registrations) {
      expect(registration.title.length).toBeGreaterThan(0)
      expect(registration.category).toBe("Nowledge Mem")
      expect(registration.description.length).toBeGreaterThan(0)
    }
  })

  it("status runs nmem status and notifies with the result", async () => {
    const nmem = fakeNmem('{"connected":true}')
    const registrations = createCommandRegistrations({ nmem, syncManager: stubManager({ success: true, threadId: "t", messagesSaved: 0, title: "" }) as SessionSyncManager })
    const ctx = commandContext()
    await registrations[0]!.execute(ctx)
    expect(ctx.notifications).toEqual(['{"connected":true}'])
  })

  it("status truncates very long output", async () => {
    const long = "x".repeat(600)
    const nmem = fakeNmem(long)
    const registrations = createCommandRegistrations({ nmem, syncManager: stubManager({ success: true, threadId: "t", messagesSaved: 0, title: "" }) as SessionSyncManager })
    const ctx = commandContext()
    await registrations[0]!.execute(ctx)
    expect(ctx.notifications[0]).toMatch(/…$/)
    expect(ctx.notifications[0]!.length).toBe(501)
  })

  it("status reports a placeholder for empty output", async () => {
    const nmem = fakeNmem("   ")
    const registrations = createCommandRegistrations({ nmem, syncManager: stubManager({ success: true, threadId: "t", messagesSaved: 0, title: "" }) as SessionSyncManager })
    const ctx = commandContext()
    await registrations[0]!.execute(ctx)
    expect(ctx.notifications).toEqual(["(no output)"])
  })

  it("save-thread notifies success with the message count", async () => {
    const registrations = createCommandRegistrations({
      nmem: fakeNmem("{}"),
      syncManager: stubManager({ success: true, threadId: "amp-t-1", messagesSaved: 5, title: "x" }) as SessionSyncManager,
    })
    const ctx = commandContext()
    await registrations[1]!.execute(ctx)
    expect(ctx.notifications[0]).toContain("5 messages")
  })

  it("save-thread notifies skipped with the reason", async () => {
    const registrations = createCommandRegistrations({
      nmem: fakeNmem("{}"),
      syncManager: stubManager({ skipped: true, reason: "no_messages", threadId: "t", messagesSaved: 0, title: "" }) as SessionSyncManager,
    })
    const ctx = commandContext()
    await registrations[1]!.execute(ctx)
    expect(ctx.notifications[0]).toContain("no_messages")
  })

  it("save-thread reports 'unknown reason' when a skipped result omits the reason", async () => {
    const registrations = createCommandRegistrations({
      nmem: fakeNmem("{}"),
      syncManager: stubManager({ skipped: true, reason: undefined, threadId: "t", messagesSaved: 0, title: "" }) as SessionSyncManager,
    })
    const ctx = commandContext()
    await registrations[1]!.execute(ctx)
    expect(ctx.notifications[0]).toContain("unknown reason")
  })

  it("save-thread reports 'unknown error' when a failed result omits the error", async () => {
    const registrations = createCommandRegistrations({
      nmem: fakeNmem("{}"),
      syncManager: stubManager({ error: undefined, threadId: "t", messagesSaved: 0, title: "" }) as SessionSyncManager,
    })
    const ctx = commandContext()
    await registrations[1]!.execute(ctx)
    expect(ctx.notifications[0]).toContain("unknown error")
  })

  it("save-thread notifies when no thread is active", async () => {
    const registrations = createCommandRegistrations({
      nmem: fakeNmem("{}"),
      syncManager: stubManager({ success: true, threadId: "t", messagesSaved: 0, title: "" }) as SessionSyncManager,
    })
    const ctx = commandContext({ threadId: undefined })
    await registrations[1]!.execute(ctx)
    expect(ctx.notifications[0]).toContain("No active thread")
  })

  it("search prompts for a query and notifies with the result", async () => {
    const nmem = fakeNmem('{"results":[]}')
    const registrations = createCommandRegistrations({ nmem, syncManager: stubManager({ success: true, threadId: "t", messagesSaved: 0, title: "" }) as SessionSyncManager })
    const ctx = commandContext()
    await registrations[2]!.execute(ctx)
    expect(ctx.input).toHaveBeenCalledWith("Search your knowledge graph:")
    expect(ctx.notifications).toEqual(['{"results":[]}'])
  })

  it("search cancels when the user provides no query", async () => {
    const nmem = fakeNmem('{"results":[]}')
    const registrations = createCommandRegistrations({ nmem, syncManager: stubManager({ success: true, threadId: "t", messagesSaved: 0, title: "" }) as SessionSyncManager })
    const ctx = commandContext({ input: vi.fn(async () => undefined) })
    await registrations[2]!.execute(ctx)
    expect(ctx.notifications).toEqual(["Search cancelled."])
  })

  it("search cancels when the query is whitespace", async () => {
    const nmem = fakeNmem('{"results":[]}')
    const registrations = createCommandRegistrations({ nmem, syncManager: stubManager({ success: true, threadId: "t", messagesSaved: 0, title: "" }) as SessionSyncManager })
    const ctx = commandContext({ input: vi.fn(async () => "   ") })
    await registrations[2]!.execute(ctx)
    expect(ctx.notifications).toEqual(["Search cancelled."])
  })
})
