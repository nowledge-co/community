import { describe, expect, it, vi } from "vitest"

import { createToolExecutors, isNmemErrorPayload, SOURCE_APP, TOOL_DEFINITIONS, TOOL_NAMES } from "../src/tools"
import type { NmemCli } from "../src/cli"
import type { SessionSyncManager } from "../src/sync"
import type { CaptureResult } from "../src/sync"
import type { ToolContext } from "../src/types"

/** A fake nmem that records calls and returns canned stdout. */
function fakeNmem(stdout = '{"ok":true}'): NmemCli & { calls: readonly string[][] } {
  const calls: string[][] = []
  const fn = ((args: readonly string[]) => {
    calls.push([...args])
    return Promise.resolve(stdout)
  }) as NmemCli & { calls: readonly string[][] }
  fn.calls = calls
  return fn
}

/** A no-op capture manager stub for tools that do not exercise capture. */
function stubManager(): Pick<SessionSyncManager, "syncNow"> {
  return { syncNow: vi.fn(async (): Promise<CaptureResult> => ({ success: true, threadId: "amp-t-1", messagesSaved: 2, title: "t" })) }
}

/** A tool context with an active thread. */
const THREAD_CTX: ToolContext = { thread: { id: "T-1" } }

/** A tool context with no thread. */
const NO_THREAD_CTX: ToolContext = {}

describe("TOOL_DEFINITIONS", () => {
  it("declares exactly the ten canonical tools in order", () => {
    expect(TOOL_DEFINITIONS.map((d) => d.name)).toEqual([...TOOL_NAMES])
    expect(TOOL_NAMES).toHaveLength(10)
  })

  it("each definition has a name, description, and object inputSchema", () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.description.length).toBeGreaterThan(0)
      expect(def.inputSchema.type).toBe("object")
    }
  })

  it("marks the required arguments for search/save/update/handoff", () => {
    const byName = Object.fromEntries(TOOL_DEFINITIONS.map((d) => [d.name, d])) as Record<string, (typeof TOOL_DEFINITIONS)[number]>
    expect(byName["nowledge_mem_search"]!.inputSchema.required).toContain("query")
    expect(byName["nowledge_mem_save"]!.inputSchema.required).toContain("content")
    expect(byName["nowledge_mem_save"]!.inputSchema.required).toContain("title")
    expect(byName["nowledge_mem_update"]!.inputSchema.required).toContain("memory_id")
    expect(byName["nowledge_mem_save_handoff"]!.inputSchema.required).toContain("topic")
  })
})

describe("createToolExecutors", () => {
  it("context_bundle returns the bundle, falling back to working memory on error", async () => {
    const errorCli = fakeNmem(JSON.stringify({ error: "context failed" }))
    const wmCli = fakeNmem('{"wm":true}')
    const nmem = ((args: readonly string[]) =>
      args[0] === "context" ? errorCli(args) : wmCli(args)) as NmemCli
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })

    const result = await executors.nowledge_mem_context_bundle({}, THREAD_CTX)
    expect(result).toBe('{"wm":true}')
  })

  it("context_bundle returns the bundle directly when it succeeds", async () => {
    const nmem = fakeNmem('{"bundle":true}')
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    const result = await executors.nowledge_mem_context_bundle({}, THREAD_CTX)
    expect(result).toBe('{"bundle":true}')
  })

  it("working_memory runs wm read", async () => {
    const nmem = fakeNmem('{"wm":true}')
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_working_memory({}, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["wm", "read"])
  })

  it("search builds the search command with optional flags", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_search({ query: "q", limit: 50, label: "bug", mode: "deep" }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["m", "search", "q", "-n", "20", "-l", "bug", "--mode", "deep"])
  })

  it("search clamps limit to a minimum of 1", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_search({ query: "q", limit: 0 }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["m", "search", "q", "-n", "1"])
  })

  it("search omits flags when they are absent", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_search({ query: "q" }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["m", "search", "q"])
  })

  it("search does not add --mode when mode is default", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_search({ query: "q", mode: "default" }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["m", "search", "q"])
  })

  it("search tolerates a missing query by defaulting to empty", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_search({}, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["m", "search", ""])
  })

  it("save builds the add command with all optional fields", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_save(
      { content: "c", title: "t", unit_type: "decision", labels: "a, b ,", importance: 0.9 },
      THREAD_CTX,
    )
    expect(nmem.calls[0]).toEqual(["m", "add", "c", "-t", "t", "--source", SOURCE_APP, "--unit-type", "decision", "-l", "a", "-l", "b", "-i", "0.9"])
  })

  it("save omits optional fields when absent", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_save({ content: "c", title: "t" }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["m", "add", "c", "-t", "t", "--source", SOURCE_APP])
  })

  it("save tolerates a missing required content/title by defaulting to empty", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_save({}, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["m", "add", "", "-t", "", "--source", SOURCE_APP])
  })

  it("update builds the update command with provided fields", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_update({ memory_id: "m1", content: "new", title: "newt", importance: 0.5 }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["m", "update", "m1", "-c", "new", "-t", "newt", "-i", "0.5"])
  })

  it("update omits absent optional fields", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_update({ memory_id: "m1" }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["m", "update", "m1"])
  })

  it("update tolerates a missing memory_id by defaulting to empty", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_update({}, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["m", "update", ""])
  })

  it("thread_search builds the thread search command with limit", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_thread_search({ query: "q", limit: 3 }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["t", "search", "q", "--limit", "3"])
  })

  it("thread_search without limit omits the flag", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_thread_search({ query: "q" }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["t", "search", "q"])
  })

  it("thread_search tolerates a missing query by defaulting to empty", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_thread_search({}, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["t", "search", ""])
  })

  it("save_thread delegates to the sync manager and JSON-serialises the result", async () => {
    const manager = stubManager()
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: manager as SessionSyncManager })
    const result = await executors.nowledge_mem_save_thread({ summary: "wrap-up" }, THREAD_CTX)
    expect(manager.syncNow).toHaveBeenCalledWith("T-1")
    const parsed = JSON.parse(result as string) as { success: boolean; summary: string }
    expect(parsed.success).toBe(true)
    expect(parsed.summary).toBe("wrap-up")
  })

  it("save_thread returns an error when no thread is active", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    const result = await executors.nowledge_mem_save_thread({}, NO_THREAD_CTX)
    const parsed = JSON.parse(result as string) as { error: string }
    expect(parsed.error).toContain("No active thread")
  })

  it("save_thread serialises a thrown error and suggests handoff", async () => {
    const manager = { syncNow: vi.fn(async () => Promise.reject(new Error("boom"))) }
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: manager as unknown as SessionSyncManager })
    const result = await executors.nowledge_mem_save_thread({}, THREAD_CTX)
    const parsed = JSON.parse(result as string) as { error: string }
    expect(parsed.error).toContain("boom")
    expect(parsed.error).toContain("nowledge_mem_save_handoff")
  })

  it("save_thread serialises a non-Error throw", async () => {
    const manager = { syncNow: vi.fn(async () => Promise.reject("string fail")) }
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: manager as unknown as SessionSyncManager })
    const result = await executors.nowledge_mem_save_thread({}, THREAD_CTX)
    const parsed = JSON.parse(result as string) as { error: string }
    expect(parsed.error).toContain("string fail")
  })

  it("save_handoff builds the handoff create command", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_save_handoff({ topic: "release", summary: "Goal: ..." }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["t", "create", "-t", "Session Handoff - release", "-c", "Goal: ...", "-s", SOURCE_APP])
  })

  it("save_handoff tolerates missing topic/summary by defaulting to empty", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_save_handoff({}, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["t", "create", "-t", "Session Handoff - ", "-c", "", "-s", SOURCE_APP])
  })

  it("graph_expand builds the expand command with depth and limit", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_graph_expand({ memory_id: "m1", depth: 2, limit: 10 }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["graph", "expand", "m1", "--depth", "2", "-n", "10"])
  })

  it("graph_expand clamps depth to the 1-3 range", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_graph_expand({ memory_id: "m1", depth: 10 }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["graph", "expand", "m1", "--depth", "3"])
  })

  it("graph_expand clamps limit to the 1-50 range", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_graph_expand({ memory_id: "m1", limit: 0 }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["graph", "expand", "m1", "-n", "1"])
  })

  it("graph_expand omits depth and limit when absent", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_graph_expand({ memory_id: "m1" }, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["graph", "expand", "m1"])
  })

  it("graph_expand tolerates a missing memory_id by defaulting to empty", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_graph_expand({}, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["graph", "expand", ""])
  })

  it("status runs the status command", async () => {
    const nmem = fakeNmem()
    const executors = createToolExecutors({ nmem, syncManager: stubManager() as SessionSyncManager })
    await executors.nowledge_mem_status({}, THREAD_CTX)
    expect(nmem.calls[0]).toEqual(["status"])
  })
})

describe("isNmemErrorPayload", () => {
  it("returns true for an error envelope", () => {
    expect(isNmemErrorPayload('{"error":"x"}')).toBe(true)
  })

  it("returns false for a non-error object", () => {
    expect(isNmemErrorPayload('{"ok":true}')).toBe(false)
  })

  it("returns false for invalid JSON", () => {
    expect(isNmemErrorPayload("not json")).toBe(false)
  })

  it("returns false for non-object JSON", () => {
    expect(isNmemErrorPayload("42")).toBe(false)
  })
})
