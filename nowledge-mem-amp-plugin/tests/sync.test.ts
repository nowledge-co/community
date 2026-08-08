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

/** Fake timer pair that records handles and defers handlers until fired. */
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

  it("falls back to append when create returns non-ok", async () => {
    const nmemApi = fakeNmemApi({
      "/threads": () => ({ ok: false, status: 409, data: { error: "exists" } }),
      "/threads/amp-t-abc123/append": () => ({ ok: true, status: 200, data: { appended: true } }),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ambientSpaceId: "Research" }))
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

    expect(capturedBody).toMatchObject({ space_id: "Research", idempotency_key: "amp:live:amp-t-abc123" })
  })

  it("returns an error result when both create and append fail", async () => {
    const nmemApi = fakeNmemApi({
      "/threads": () => ({ ok: false, status: 409, data: { error: "exists" } }),
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

  it("skips with incomplete_turn when no user turn exists", async () => {
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

  it("waits for an in-flight capture before running a forced one", async () => {
    let resolveFirst: (value: HttpResponse) => void
    const firstInFlight = new Promise<HttpResponse>((resolve) => {
      resolveFirst = resolve
    })
    const nmemApi = fakeNmemApi({
      "/threads": async () => firstInFlight,
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages: async () => FULL_TRANSCRIPT }))

    // Start an automatic capture via scheduleSync (non-forced, sets inFlight).
    const timers = fakeTimers()
    // Use internal scheduling to set inFlight without a separate manager.
    // We use syncNow which now checks inFlight - but we need inFlight set first.
    // Use the runAutoSync path via scheduleSync with the deferred timers.
    const managerWithTimers = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages: async () => FULL_TRANSCRIPT, ...timers }))
    managerWithTimers.scheduleSync(THREAD_ID)
    timers.fireAll()
    // Now inFlight is set (waiting on firstInFlight). Call syncNow.
    const syncNowPromise = managerWithTimers.syncNow(THREAD_ID)
    // Resolve the in-flight capture.
    resolveFirst!({ ok: true, status: 200, data: {} })
    await flushMicrotasks()
    // syncNow should now run its own forced capture.
    const result = await syncNowPromise
    expect(result.success).toBe(true)
    // Two captures: one automatic, one forced.
    expect(nmemApi.calls).toHaveLength(2)
  })

  it("does not fall back to append for non-409 errors", async () => {
    const nmemApi = fakeNmemApi({
      "/threads": () => ({ ok: false, status: 500, data: { error: "server error" } }),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    const result = await manager.syncNow(THREAD_ID)
    expect(result.success).toBeUndefined()
    expect(result.error).toContain("500")
    // Only the create was attempted, not append.
    expect(nmemApi.calls).toEqual(["/threads"])
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
    // scheduleSync stores the handler; fire it to start the async capture.
    manager.scheduleSync(THREAD_ID)
    expect(timers.handles).toHaveLength(1)
    timers.fireAll()
    await flushMicrotasks()
    expect(nmemApi.calls).toEqual(["/threads"])
  })

  it("clears a pending timer when scheduleSync is called again within the debounce window", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    // Two schedules before firing: the second clears the first timer.
    manager.scheduleSync(THREAD_ID)
    manager.scheduleSync(THREAD_ID)
    // Only one handle remains (the second replaced the first).
    expect(timers.handles).toHaveLength(1)
    timers.fireAll()
    await flushMicrotasks()
    expect(nmemApi.calls).toEqual(["/threads"])
  })

  it("skips an unchanged transcript on a second non-forced schedule", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => ({ ok: true, status: 200, data: {} }) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    // First schedule: fire and flush to persist and set lastSignature.
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    await flushMicrotasks()
    await flushMicrotasks()
    // Second schedule: same transcript, deduped by signature.
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    await flushMicrotasks()
    await flushMicrotasks()
    expect(nmemApi.calls).toHaveLength(1)
  })

  it("coalesces overlapping captures via the pending flag", async () => {
    let resolveFirst: (value: HttpResponse) => void
    const firstInFlight = new Promise<HttpResponse>((resolve) => {
      resolveFirst = resolve
    })
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({
      "/threads": async () => firstInFlight,
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages: async () => FULL_TRANSCRIPT, ...timers }))

    // Start an automatic capture by scheduling and firing the timer.
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    // The capture is now in-flight (waiting on firstInFlight).
    // Schedule another while in-flight: the pending flag should be set.
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    // Allow the first to complete; the pending flag triggers one more schedule.
    resolveFirst!({ ok: true, status: 200, data: {} })
    await flushMicrotasks()
    // The pending schedule fires its timer; fire it and flush.
    timers.fireAll()
    await flushMicrotasks()

    // The first capture persisted; the second was coalesced and deduped.
    expect(nmemApi.calls).toHaveLength(1)
  })
})

describe("SessionSyncManager.dispose", () => {
  it("clears pending timers and clears state", () => {
    let setCount = 0
    let clearedCount = 0
    const manager = new SessionSyncManager(
      managerOptions({
        autoSyncEnabled: true,
        setTimer: (handler) => {
          setCount += 1
          // Do NOT fire; leave it pending so dispose clears it.
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
    // After dispose, a new schedule allocates a fresh handle (state was cleared).
    manager.scheduleSync(THREAD_ID)
    expect(setCount).toBe(2)
  })
})

// Ensure CaptureResult is referenced for type-only import side effects in coverage.
export type { CaptureResult }
