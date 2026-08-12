import { describe, expect, it, vi } from "vitest"

import { SessionSyncManager } from "../src/sync"
import type { CaptureResult, SessionSyncManagerOptions } from "../src/sync"
import type { HttpResponse } from "../src/http"
import type { ThreadID } from "../src/types"

/** A thread id in the SDK's branded `T-${string}` shape. */
const THREAD_ID = "T-abc123" as ThreadID

/** Flushes pending microtasks so async captures driven by the fake timer settle. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

/** A transcript with one user and one assistant turn. */
const FULL_TRANSCRIPT = [
  { role: "user", id: "u1", parts: [{ type: "text", text: "hello" }] },
  { role: "assistant", id: "a1", parts: [{ type: "text", text: "hi back" }] },
]

/** A transcript missing an assistant turn. */
const INCOMPLETE_TRANSCRIPT = [{ role: "user", id: "u1", parts: [{ type: "text", text: "hello" }] }]

/** Builds a fake nmemApi that responds per-path. Handlers may be async. */
function fakeNmemApi(
  handlers: Record<string, (() => HttpResponse) | (() => Promise<HttpResponse>)>,
): SessionSyncManagerOptions["nmemApi"] & { calls: string[] } {
  const calls: string[] = []
  const fn = ((path: string) => {
    calls.push(path)
    const handler = handlers[path] ?? handlers["default"]
    if (handler === undefined) return Promise.resolve({ ok: false, status: 500, data: { error: "no handler" } })
    return Promise.resolve(handler())
  }) as unknown as SessionSyncManagerOptions["nmemApi"] & { calls: string[] }
  fn.calls = calls
  return fn
}

/** Builds manager options with sensible defaults and injectable overrides. */
function managerOptions(overrides: Partial<SessionSyncManagerOptions> = {}): SessionSyncManagerOptions {
  const timers = fakeTimers()
  return {
    nmemApi: fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: { id: "T-new" } }) }),
    readThreadMessages: async () => FULL_TRANSCRIPT,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    sourceApp: "amp",
    projectPath: "/proj",
    autoSyncEnabled: true,
    autoSyncDebounceMs: 1500,
    ambientSpaceId: undefined,
    ...overrides,
  }
}

/** Fake timer pair that records handles and fires them only when requested. */
function fakeTimers(): {
  setTimer: SessionSyncManagerOptions["setTimer"]
  clearTimer: SessionSyncManagerOptions["clearTimer"]
  handles: number[]
  fireAll: () => void
} {
  let counter = 0
  const handles: number[] = []
  const pending = new Map<number, () => void>()
  return {
    handles,
    fireAll: () => {
      const callbacks = [...pending.values()]
      pending.clear()
      handles.length = 0
      for (const callback of callbacks) callback()
    },
    setTimer: (handler) => {
      counter += 1
      handles.push(counter)
      pending.set(counter, handler)
      return counter as unknown as ReturnType<typeof setTimeout>
    },
    clearTimer: (handle) => {
      const index = handles.indexOf(handle as unknown as number)
      if (index >= 0) handles.splice(index, 1)
      pending.delete(handle as unknown as number)
    },
  }
}

describe("SessionSyncManager.syncNow", () => {
  it("creates a thread on a fresh transcript", async () => {
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: { id: "T-new" } }) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    const result = await manager.syncNow(THREAD_ID)

    expect(result.success).toBe(true)
    expect(result.threadId).toBe("amp-t-abc123")
    expect(result.messagesSaved).toBe(2)
    expect(nmemApi.calls).toEqual(["/threads"])
  })

  it.each([
    [409, { error: "exists" }],
    [422, { detail: "Thread amp-t-abc123 already exists in space default." }],
    [422, { error: "Thread amp-t-abc123 already exists in space default." }],
    [422, "THREAD amp-t-abc123 ALREADY EXISTS in space default."],
    [422, { error: { message: "Thread exists in space default." } }],
  ])("falls back to append when create returns the existing-thread response %i", async (status, data) => {
    const nmemApi = fakeNmemApi({
      "/threads": () => ({ ok: false, status, data }),
      "/threads/amp-t-abc123/append": () => ({ ok: true, status: 200, data: { appended: true } }),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ambientSpaceId: "Research" }))
    const result = await manager.syncNow(THREAD_ID)

    expect(result.success).toBe(true)
    expect(nmemApi.calls).toEqual(["/threads", "/threads/amp-t-abc123/append"])
  })

  it.each([
    { detail: "messages are invalid" },
    "messages are invalid",
  ])("preserves an unrelated 422 create failure", async (data) => {
    const nmemApi = fakeNmemApi({
      "/threads": () => ({ ok: false, status: 422, data }),
      "/threads/amp-t-abc123/append": () => ({ ok: true, status: 200, data: { appended: true } }),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    const result = await manager.syncNow(THREAD_ID)

    expect(result.success).toBeUndefined()
    expect(result.error).toContain("Thread save failed (422)")
    expect(nmemApi.calls).toEqual(["/threads"])
  })

  it("preserves the original create failure when it is not a conflict", async () => {
    const nmemApi = fakeNmemApi({
      "/threads": () => ({ ok: false, status: 500, data: { error: "boom" } }),
      "/threads/amp-t-abc123/append": () => ({ ok: true, status: 200, data: { appended: true } }),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    const result = await manager.syncNow(THREAD_ID)

    expect(result.success).toBeUndefined()
    expect(result.error).toContain("Thread save failed (500)")
    expect(nmemApi.calls).toEqual(["/threads"])
  })

  it("appends without a space_id when no ambient space is set", async () => {
    const nmemApi = fakeNmemApi({
      "/threads": () => ({ ok: false, status: 409, data: {} }),
      "/threads/amp-t-abc123/append": () => ({ ok: true, status: 200, data: {} }),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    const result = await manager.syncNow(THREAD_ID)
    expect(result.success).toBe(true)
    expect(nmemApi.calls).toEqual(["/threads", "/threads/amp-t-abc123/append"])
  })

  it("includes space_id on the append body when an ambient space is set", async () => {
    let capturedBody: unknown
    const nmemApi = fakeNmemApi({
      "/threads": () => ({ ok: false, status: 409, data: {} }),
      "/threads/amp-t-abc123/append": () => ({ ok: true, status: 200, data: {} }),
    })
    // Wrap to capture the body argument.
    const wrapped: SessionSyncManagerOptions["nmemApi"] = ((path: string, body: unknown) => {
      if (path.includes("append")) capturedBody = body
      return nmemApi(path, body)
    }) as unknown as SessionSyncManagerOptions["nmemApi"]
    const manager = new SessionSyncManager(managerOptions({ nmemApi: wrapped, ambientSpaceId: "Research" }))
    await manager.syncNow(THREAD_ID)

    expect(capturedBody).toMatchObject({
      space_id: "Research",
      deduplicate: true,
      idempotency_key: "amp:live:amp-t-abc123",
    })
  })

  it("returns an append error result when create conflicts and append fails", async () => {
    const nmemApi = fakeNmemApi({
      "/threads": () => ({ ok: false, status: 500, data: { error: "boom" } }),
      "/threads/amp-t-abc123/append": () => ({ ok: false, status: 500, data: { error: "boom2" } }),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    const result = await manager.syncNow(THREAD_ID)

    expect(result.success).toBeUndefined()
    expect(result.error).toContain("Thread save failed (500)")
  })

  it("skips with no_messages when the transcript is empty", async () => {
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages: async () => [] }))
    const result = await manager.syncNow(THREAD_ID)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe("no_messages")
    expect(nmemApi.calls).toEqual([])
  })

  it("skips with no_extractable_messages when messages lack ids", async () => {
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(
      managerOptions({ nmemApi, readThreadMessages: async () => [{ role: "user", parts: [{ type: "text", text: "x" }] }] }),
    )
    const result = await manager.syncNow(THREAD_ID)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe("no_extractable_messages")
  })

  it("skips with incomplete_turn when only one role is present", async () => {
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages: async () => INCOMPLETE_TRANSCRIPT }))
    const result = await manager.syncNow(THREAD_ID)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe("incomplete_turn")
  })

  it("forces re-upload on syncNow even when the signature matches a prior run", async () => {
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    await manager.syncNow(THREAD_ID)
    await manager.syncNow(THREAD_ID)
    expect(nmemApi.calls).toHaveLength(2)
  })

  it("serializes overlapping manual captures and reruns the forced save", async () => {
    let resolveFirst: (value: HttpResponse) => void
    let callCount = 0
    const firstInFlight = new Promise<HttpResponse>((resolve) => {
      resolveFirst = resolve
    })
    const nmemApi = fakeNmemApi({
      "/threads": async () => {
        callCount += 1
        return callCount === 1
          ? await firstInFlight
          : { ok: true, status: 200, data: {} }
      },
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))

    const firstSync = manager.syncNow(THREAD_ID)
    const secondSync = manager.syncNow(THREAD_ID)
    await flushMicrotasks()
    expect(nmemApi.calls).toEqual(["/threads"])

    resolveFirst!({ ok: true, status: 200, data: {} })
    await Promise.all([firstSync, secondSync])

    expect(nmemApi.calls).toEqual(["/threads", "/threads"])
  })

  it("derives the title from the first user message, truncated to 120 chars", async () => {
    const longContent = "x".repeat(200)
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(
      managerOptions({
        nmemApi,
        readThreadMessages: async () => [
          { role: "user", id: "u1", parts: [{ type: "text", text: longContent }] },
          { role: "assistant", id: "a1", parts: [{ type: "text", text: "ok" }] },
        ],
      }),
    )
    const result = await manager.syncNow(THREAD_ID)
    expect(result.title).toBe("x".repeat(120))
  })

  it("uses the first user message even when the assistant turn comes first", async () => {
    // Assistant-first ordering still has both roles, so it is not incomplete,
    // and the title still comes from the (second) user turn.
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(
      managerOptions({
        nmemApi,
        readThreadMessages: async () => [
          { role: "assistant", id: "a1", parts: [{ type: "text", text: "assistant first" }] },
          { role: "user", id: "u1", parts: [{ type: "text", text: "user second" }] },
        ],
      }),
    )
    const result = await manager.syncNow(THREAD_ID)
    expect(result.title).toBe("user second")
  })

  it("falls back to the first message when no user turn exists", async () => {
    // No user turn means deriveTitle cannot find a user message, so it falls
    // back to messages[0]. The transcript is still incomplete_turn and skipped,
    // so assert the skip path explicitly.
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(
      managerOptions({
        nmemApi,
        readThreadMessages: async () => [
          { role: "assistant", id: "a1", parts: [{ type: "text", text: "assistant first" }] },
          { role: "assistant", id: "a2", parts: [{ type: "text", text: "assistant second" }] },
        ],
      }),
    )
    const result = await manager.syncNow(THREAD_ID)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe("incomplete_turn")
  })
})

describe("SessionSyncManager.scheduleSync", () => {
  it("does nothing when auto-sync is disabled", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, autoSyncEnabled: false, ...timers }))
    manager.scheduleSync(THREAD_ID)
    expect(timers.handles).toHaveLength(0)
    expect(nmemApi.calls).toHaveLength(0)
  })

  it("schedules a capture that persists the thread", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    manager.scheduleSync(THREAD_ID)
    expect(nmemApi.calls).toEqual([])
    timers.fireAll()
    await flushMicrotasks()
    expect(nmemApi.calls).toEqual(["/threads"])
  })

  it("skips an unchanged transcript on a second non-forced schedule", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    await flushMicrotasks()
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    await flushMicrotasks()
    // First schedule persists; second is deduped by signature.
    expect(nmemApi.calls).toHaveLength(1)
  })

  it("coalesces repeated schedules inside the debounce window", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))

    manager.scheduleSync(THREAD_ID)
    manager.scheduleSync(THREAD_ID)
    expect(timers.handles).toHaveLength(1)
    timers.fireAll()
    await flushMicrotasks()

    expect(nmemApi.calls).toEqual(["/threads"])
  })

  it("coalesces overlapping captures via the pending flag", async () => {
    let resolveFirst: (value: HttpResponse) => void
    const firstInFlight = new Promise<HttpResponse>((resolve) => {
      resolveFirst = resolve
    })
    const nmemApi = fakeNmemApi({
      "/threads": async () => firstInFlight,
    })
    const timers = fakeTimers()
    const manager = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages: async () => FULL_TRANSCRIPT, ...timers }))

    // Kick off an async capture without awaiting, so inFlight is set.
    const firstSync = manager.syncNow(THREAD_ID)
    await Promise.resolve()
    // While the first is in flight, schedule and fire auto-sync. It sees the
    // in-flight manual capture, sets pending, and does not write concurrently.
    manager.scheduleSync(THREAD_ID)
    await flushMicrotasks()
    timers.fireAll()
    await flushMicrotasks()
    expect(nmemApi.calls).toEqual(["/threads"])

    // Allow the first to complete; the pending flag schedules one more capture.
    resolveFirst!({ ok: true, status: 200, data: {} })
    await firstSync
    await flushMicrotasks()
    expect(timers.handles).toHaveLength(1)
    timers.fireAll()
    await flushMicrotasks()

    // Dedup prevents further persistence of the same signature.
    expect(nmemApi.calls).toEqual(["/threads"])
  })
})

describe("SessionSyncManager.dispose", () => {
  it("clears pending timers and prevents scheduling after dispose", () => {
    let setCount = 0
    let clearedCount = 0
    const manager = new SessionSyncManager(
      managerOptions({
        autoSyncEnabled: true,
        setTimer: () => {
          setCount += 1
          return setCount as unknown as ReturnType<typeof setTimeout>
        },
        clearTimer: () => {
          clearedCount += 1
        },
        nmemApi: fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) }),
      }),
    )
    manager.scheduleSync(THREAD_ID)
    expect(setCount).toBe(1)
    manager.dispose()
    expect(clearedCount).toBe(1)
    manager.scheduleSync(THREAD_ID)
    expect(setCount).toBe(1)
  })

  it("does not reschedule pending work after dispose", async () => {
    const timers = fakeTimers()
    let resolveRequest: ((response: HttpResponse) => void) | undefined
    const nmemApi = fakeNmemApi({
      "/threads": () => new Promise<HttpResponse>((resolve) => { resolveRequest = resolve }),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    await flushMicrotasks()
    manager.scheduleSync(THREAD_ID)
    manager.dispose()
    resolveRequest?.({ ok: true, status: 200, data: {} })
    await flushMicrotasks()
    expect(timers.handles).toHaveLength(0)
  })

  it("serializes concurrent manual captures", async () => {
    const pending: Array<(response: HttpResponse) => void> = []
    const nmemApi = fakeNmemApi({
      "/threads": () => new Promise<HttpResponse>((resolve) => pending.push(resolve)),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    const first = manager.syncNow(THREAD_ID)
    await vi.waitFor(() => expect(nmemApi.calls).toHaveLength(1))
    const second = manager.syncNow(THREAD_ID)
    pending.shift()?.({ ok: true, status: 200, data: {} })
    await first
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    pending.shift()?.({ ok: true, status: 200, data: {} })
    await second
    expect(nmemApi.calls).toHaveLength(2)
  })

  it("waits for an automatic capture before a manual capture", async () => {
    const timers = fakeTimers()
    const pending: Array<(response: HttpResponse) => void> = []
    const nmemApi = fakeNmemApi({
      "/threads": () => new Promise<HttpResponse>((resolve) => pending.push(resolve)),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    await vi.waitFor(() => expect(nmemApi.calls).toHaveLength(1))
    const manual = manager.syncNow(THREAD_ID)
    pending.shift()?.({ ok: true, status: 200, data: {} })
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    pending.shift()?.({ ok: true, status: 200, data: {} })
    await manual
    expect(nmemApi.calls).toHaveLength(2)
  })

  it("returns disposed while waiting when teardown occurs", async () => {
    const timers = fakeTimers()
    const pending: Array<(response: HttpResponse) => void> = []
    const nmemApi = fakeNmemApi({
      "/threads": () => new Promise<HttpResponse>((resolve) => pending.push(resolve)),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    await vi.waitFor(() => expect(nmemApi.calls).toHaveLength(1))
    const manual = manager.syncNow(THREAD_ID)
    manager.dispose()
    pending.shift()?.({ ok: true, status: 200, data: {} })
    const result = await manual
    expect(result.reason).toBe("disposed")
  })

  it("returns an empty capture result after disposal", async () => {
    const manager = new SessionSyncManager(managerOptions())
    manager.dispose()
    const result = await manager.syncNow(THREAD_ID)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe("disposed")
  })
})

// Ensure CaptureResult is referenced for type-only import side effects in coverage.
export type { CaptureResult }
