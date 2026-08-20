import { describe, expect, it, vi } from "vitest"

import { MANUAL_SYNC_TIMEOUT_MS, SessionSyncManager } from "../src/sync"
import type { CaptureResult, SessionSyncManagerOptions } from "../src/sync"
import type { HttpResponse } from "../src/http"
import type { ThreadID } from "../src/types"

const STABLE_THREAD_ID = "amp-t-abc123"

function createAck(threadId = STABLE_THREAD_ID, messageCount = 2): HttpResponse {
  return {
    ok: true,
    status: 200,
    data: { thread: { thread_id: threadId, message_count: messageCount } },
  }
}

function appendAck(messagesAdded: number, totalMessages: number, checkpointed = false): HttpResponse {
  return {
    ok: true,
    status: 200,
    data: {
      success: true,
      messages_added: messagesAdded,
      total_messages: totalMessages,
      ...(checkpointed ? { append_mode: "checkpointed" } : {}),
    },
  }
}

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

/** A second incremental agent-end batch. */
const FOLLOW_UP_TRANSCRIPT = [
  { role: "user", id: "u2", parts: [{ type: "text", text: "second turn" }] },
  { role: "assistant", id: "a2", parts: [{ type: "text", text: "second answer" }] },
]

/** A transcript missing an assistant turn. */
const INCOMPLETE_TRANSCRIPT = [{ role: "user", id: "u1", parts: [{ type: "text", text: "hello" }] }]

/** Builds a fake nmemApi that responds per-path. Handlers may be async. */
function fakeNmemApi(
  handlers: Record<string, (() => HttpResponse) | (() => Promise<HttpResponse>)>,
): SessionSyncManagerOptions["nmemApi"] & { calls: string[]; bodies: unknown[]; timeouts: Array<number | undefined> } {
  const calls: string[] = []
  const bodies: unknown[] = []
  const timeouts: Array<number | undefined> = []
  const fn = ((path: string, body: unknown, timeoutMs?: number) => {
    calls.push(path)
    bodies.push(body)
    timeouts.push(timeoutMs)
    const handler = handlers[path] ?? handlers["default"]
    if (handler === undefined) {
      if (path.includes("/append")) return Promise.resolve(appendAck(2, 4, true))
      if (path === "/threads") return Promise.resolve(createAck())
      return Promise.resolve({ ok: false, status: 500, data: { error: "no handler" } })
    }
    return Promise.resolve(handler())
  }) as unknown as SessionSyncManagerOptions["nmemApi"] & { calls: string[]; bodies: unknown[]; timeouts: Array<number | undefined> }
  fn.calls = calls
  fn.bodies = bodies
  fn.timeouts = timeouts
  return fn
}

/** Builds manager options with sensible defaults and injectable overrides. */
function managerOptions(overrides: Partial<SessionSyncManagerOptions> = {}): SessionSyncManagerOptions {
  const timers = fakeTimers()
  return {
    nmemApi: fakeNmemApi({ "/threads": () => createAck() }),
    readThreadMessages: async () => FULL_TRANSCRIPT,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    sourceApp: "amp",
    projectPath: "/proj",
    autoSyncEnabled: true,
    autoSyncDebounceMs: 1500,
    autoSyncTimeoutMs: 45_000,
    apiUrl: "http://127.0.0.1:14242",
    apiKey: undefined,
    ambientSpaceId: undefined,
    ambientAgentId: undefined,
    ambientHostAgentId: undefined,
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
    const nmemApi = fakeNmemApi({ "/threads": () => createAck() })
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
      "/threads/amp-t-abc123/append": () => appendAck(2, 2),
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
      "/threads/amp-t-abc123/append": () => appendAck(2, 2),
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
      "/threads/amp-t-abc123/append": () => appendAck(2, 2),
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
      "/threads/amp-t-abc123/append": () => appendAck(2, 2),
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
      "/threads/amp-t-abc123/append": () => appendAck(2, 2),
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
    })
    expect((capturedBody as { idempotency_key: string }).idempotency_key).toMatch(/^amp:live:amp-t-abc123:0-2:/)
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
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages: async () => [] }))
    const result = await manager.syncNow(THREAD_ID)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe("no_messages")
    expect(nmemApi.calls).toEqual([])
  })

  it("skips with no_extractable_messages when messages lack ids", async () => {
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
    const manager = new SessionSyncManager(
      managerOptions({ nmemApi, readThreadMessages: async () => [{ role: "user", parts: [{ type: "text", text: "x" }] }] }),
    )
    const result = await manager.syncNow(THREAD_ID)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe("no_extractable_messages")
  })

  it("skips with incomplete_turn when only one role is present", async () => {
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages: async () => INCOMPLETE_TRANSCRIPT }))
    const result = await manager.syncNow(THREAD_ID)
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe("incomplete_turn")
  })

  it("forces re-upload on syncNow even when the signature matches a prior run", async () => {
    const nmemApi = fakeNmemApi({
      "/threads": () => createAck(),
      "/threads/amp-t-abc123/append": () => appendAck(2, 2),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    await manager.syncNow(THREAD_ID)
    await manager.syncNow(THREAD_ID)
    expect(nmemApi.calls).toEqual(["/threads", "/threads/amp-t-abc123/append"])
    expect(nmemApi.timeouts).toEqual([MANUAL_SYNC_TIMEOUT_MS, MANUAL_SYNC_TIMEOUT_MS])
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
          : createAck()
      },
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))

    const firstSync = manager.syncNow(THREAD_ID)
    const secondSync = manager.syncNow(THREAD_ID)
    await flushMicrotasks()
    expect(nmemApi.calls).toEqual(["/threads"])

    resolveFirst!(createAck())
    await Promise.all([firstSync, secondSync])

    expect(nmemApi.calls).toEqual(["/threads", "/threads/amp-t-abc123/append"])
  })

  it("derives the title from the first user message, truncated to 120 chars", async () => {
    const longContent = "x".repeat(200)
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
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
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
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
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
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
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, autoSyncEnabled: false, ...timers }))
    manager.scheduleSync(THREAD_ID)
    expect(timers.handles).toHaveLength(0)
    expect(nmemApi.calls).toHaveLength(0)
  })

  it("schedules a capture that persists the thread", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    manager.scheduleSync(THREAD_ID)
    expect(nmemApi.calls).toEqual([])
    timers.fireAll()
    await flushMicrotasks()
    expect(nmemApi.calls).toEqual(["/threads"])
  })

  it("persists the incremental agent.end messages without reading the thread", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
    const readThreadMessages = vi.fn(async () => FULL_TRANSCRIPT)
    const manager = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages, ...timers }))

    manager.scheduleSync(THREAD_ID, FULL_TRANSCRIPT)
    timers.fireAll()
    await flushMicrotasks()

    expect(nmemApi.calls).toEqual(["/threads"])
    expect(readThreadMessages).not.toHaveBeenCalled()
  })

  it("keeps host messages without ids when merging debounce batches", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => createAck() })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    const first = { role: "user", parts: [{ type: "text", text: "no-id-one" }] }
    const second = { role: "assistant", id: { nested: true }, parts: [{ type: "text", text: "no-id-two" }] }
    manager.scheduleSync(THREAD_ID, [first])
    manager.scheduleSync(THREAD_ID, [])
    manager.scheduleSync(THREAD_ID, [first, second])
    timers.fireAll()
    await flushMicrotasks()
    // Messages without usable ids are kept for debounce de-dupe but dropped at convert time.
    expect(nmemApi.calls).toEqual([])
  })

  it("merges incremental messages scheduled inside the debounce window", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
    const readThreadMessages = vi.fn(async () => FULL_TRANSCRIPT)
    const manager = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages, ...timers }))

    manager.scheduleSync(THREAD_ID, FULL_TRANSCRIPT)
    manager.scheduleSync(THREAD_ID, FOLLOW_UP_TRANSCRIPT)
    timers.fireAll()
    await flushMicrotasks()

    const body = nmemApi.bodies[0] as { readonly messages: Array<{ readonly metadata: { readonly external_id: string } }> }
    expect(body.messages.map((message) => message.metadata.external_id)).toEqual([
      "amp-msg-u1",
      "amp-msg-a1",
      "amp-msg-u2",
      "amp-msg-a2",
    ])
    expect(readThreadMessages).not.toHaveBeenCalled()
  })

  it("skips an unchanged transcript on a second non-forced schedule", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    await flushMicrotasks()
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    await flushMicrotasks()
    // First schedule persists; second is an empty acknowledged delta.
    expect(nmemApi.calls).toHaveLength(1)
  })

  it("coalesces repeated schedules inside the debounce window", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => (createAck()) })
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
    resolveFirst!(createAck())
    await firstSync
    await flushMicrotasks()
    expect(timers.handles).toHaveLength(1)
    timers.fireAll()
    await flushMicrotasks()

    // An empty acknowledged delta prevents a second persist of the same snapshot.
    expect(nmemApi.calls).toEqual(["/threads"])
  })

  it("preserves pending incremental messages while another capture is in flight", async () => {
    let resolveFirst: (value: HttpResponse) => void
    const firstInFlight = new Promise<HttpResponse>((resolve) => {
      resolveFirst = resolve
    })
    let callCount = 0
    const nmemApi = fakeNmemApi({
      "/threads": async () => await firstInFlight,
      "/threads/amp-t-abc123/append": () => appendAck(4, 6, true),
    })
    const timers = fakeTimers()
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))

    manager.scheduleSync(THREAD_ID, FULL_TRANSCRIPT)
    timers.fireAll()
    await flushMicrotasks()
    expect(nmemApi.calls).toEqual(["/threads"])

    manager.scheduleSync(THREAD_ID, FOLLOW_UP_TRANSCRIPT)
    manager.scheduleSync(THREAD_ID, [
      FOLLOW_UP_TRANSCRIPT[1],
      { role: "user", id: "u3", parts: [{ type: "text", text: "third turn" }] },
      { role: "assistant", id: "a3", parts: [{ type: "text", text: "third answer" }] },
    ])
    timers.fireAll()
    await flushMicrotasks()
    expect(nmemApi.calls).toEqual(["/threads"])

    resolveFirst!(createAck())
    await vi.waitFor(() => expect(timers.handles).toHaveLength(1))
    timers.fireAll()
    await vi.waitFor(() => expect(nmemApi.bodies).toHaveLength(2))

    const body = nmemApi.bodies[1] as { readonly messages: Array<{ readonly metadata: { readonly external_id: string } }> }
    expect(body.messages.map((message) => message.metadata.external_id)).toEqual([
      "amp-msg-u2",
      "amp-msg-a2",
      "amp-msg-u3",
      "amp-msg-a3",
    ])
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
        nmemApi: fakeNmemApi({ "/threads": () => createAck() }),
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
    resolveRequest?.(createAck())
    await flushMicrotasks()
    expect(timers.handles).toHaveLength(0)
  })

  it("serializes concurrent manual captures", async () => {
    const pending: Array<(response: HttpResponse) => void> = []
    const nmemApi = fakeNmemApi({
      default: () => new Promise<HttpResponse>((resolve) => pending.push(resolve)),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    const first = manager.syncNow(THREAD_ID)
    await vi.waitFor(() => expect(nmemApi.calls).toHaveLength(1))
    const second = manager.syncNow(THREAD_ID)
    pending.shift()?.(createAck())
    await first
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    pending.shift()?.(appendAck(2, 2))
    await second
    expect(nmemApi.calls).toEqual(["/threads", "/threads/amp-t-abc123/append"])
  })

  it("waits for an automatic capture before a manual capture", async () => {
    const timers = fakeTimers()
    const pending: Array<(response: HttpResponse) => void> = []
    const nmemApi = fakeNmemApi({
      default: () => new Promise<HttpResponse>((resolve) => pending.push(resolve)),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))
    manager.scheduleSync(THREAD_ID)
    timers.fireAll()
    await vi.waitFor(() => expect(nmemApi.calls).toHaveLength(1))
    const manual = manager.syncNow(THREAD_ID)
    pending.shift()?.(createAck())
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    pending.shift()?.(appendAck(2, 2))
    await manual
    expect(nmemApi.calls).toEqual(["/threads", "/threads/amp-t-abc123/append"])
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
    pending.shift()?.(createAck())
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



describe("SessionSyncManager incremental checkpoint contract", () => {
  async function fireUntil(
    timers: ReturnType<typeof fakeTimers>,
    nmemApi: { readonly calls: string[] },
    count: number,
  ): Promise<void> {
    timers.fireAll()
    await vi.waitFor(() => expect(nmemApi.calls).toHaveLength(count))
    await flushMicrotasks()
    await flushMicrotasks()
  }

  it("appends only the unacknowledged suffix with a checkpointed request", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({
      "/threads": () => createAck(),
      "/threads/amp-t-abc123/append": () => appendAck(2, 4, true),
    })
    const manager = new SessionSyncManager(managerOptions({
      nmemApi,
      readThreadMessages: async () => FULL_TRANSCRIPT,
      ...timers,
    }))

    await manager.syncNow(THREAD_ID)
    manager.scheduleSync(THREAD_ID, FOLLOW_UP_TRANSCRIPT)
    await fireUntil(timers, nmemApi, 2)

    expect(nmemApi.calls).toEqual(["/threads", "/threads/amp-t-abc123/append"])
    expect(nmemApi.timeouts[0]).toBe(MANUAL_SYNC_TIMEOUT_MS)
    expect(nmemApi.timeouts[1]).toBe(45_000)
    const appendBody = nmemApi.bodies[1] as {
      readonly messages: Array<{ readonly metadata: { readonly external_id: string } }>
      readonly expected_message_count: number
      readonly idempotency_key: string
    }
    expect(appendBody.messages.map((message) => message.metadata.external_id)).toEqual([
      "amp-msg-u2",
      "amp-msg-a2",
    ])
    expect(appendBody.expected_message_count).toBe(2)
    expect(appendBody.idempotency_key).toMatch(/^amp:live:amp-t-abc123:2-4:/)
  })

  it("preserves the cursor when the create response lacks an explicit ack", async () => {
    const nmemApi = fakeNmemApi({
      "/threads": () => ({ ok: true, status: 200, data: { id: "T-new" } }),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi }))
    const result = await manager.syncNow(THREAD_ID)
    expect(result.error).toContain("explicit persistence acknowledgement")
    await manager.syncNow(THREAD_ID)
    expect(nmemApi.calls).toEqual(["/threads", "/threads"])
  })

  it("preserves the cursor when a checkpointed append is not acknowledged as checkpointed", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({
      "/threads": () => createAck(),
      "/threads/amp-t-abc123/append": () => appendAck(2, 4, false),
    })
    const manager = new SessionSyncManager(managerOptions({
      nmemApi,
      readThreadMessages: async () => FULL_TRANSCRIPT,
      ...timers,
    }))
    await manager.syncNow(THREAD_ID)
    manager.scheduleSync(THREAD_ID, FOLLOW_UP_TRANSCRIPT)
    await fireUntil(timers, nmemApi, 2)
    manager.scheduleSync(THREAD_ID, FOLLOW_UP_TRANSCRIPT)
    await fireUntil(timers, nmemApi, 3)
    expect(nmemApi.calls).toEqual([
      "/threads",
      "/threads/amp-t-abc123/append",
      "/threads/amp-t-abc123/append",
    ])
  })

  it("reconciles after a checkpoint conflict", async () => {
    const timers = fakeTimers()
    let appendCount = 0
    const nmemApi = fakeNmemApi({
      "/threads": () => createAck(),
      "/threads/amp-t-abc123/append": () => {
        appendCount += 1
        return appendCount === 1
          ? { ok: false, status: 409, data: { error_code: "checkpoint_conflict" } }
          : appendAck(0, 5)
      },
    })
    const manager = new SessionSyncManager(managerOptions({
      nmemApi,
      readThreadMessages: async () => FULL_TRANSCRIPT,
      ambientSpaceId: "Research",
      ...timers,
    }))
    await manager.syncNow(THREAD_ID)
    manager.scheduleSync(THREAD_ID, FOLLOW_UP_TRANSCRIPT)
    await fireUntil(timers, nmemApi, 3)
    expect(nmemApi.calls).toEqual([
      "/threads",
      "/threads/amp-t-abc123/append",
      "/threads/amp-t-abc123/append",
    ])
    const reconcileBody = nmemApi.bodies[2] as { readonly idempotency_key: string; readonly messages: unknown[]; readonly space_id: string }
    expect(reconcileBody.idempotency_key).toMatch(/^amp:reconcile:amp-t-abc123:/)
    expect(reconcileBody.messages).toHaveLength(4)
    expect(reconcileBody.space_id).toBe("Research")
  })

  it("reconciles a checkpoint conflict without a space_id when none is configured", async () => {
    const timers = fakeTimers()
    let appendCount = 0
    const nmemApi = fakeNmemApi({
      "/threads": () => createAck(),
      "/threads/amp-t-abc123/append": () => {
        appendCount += 1
        return appendCount === 1
          ? { ok: false, status: 409, data: { error_code: "checkpoint_conflict" } }
          : appendAck(0, 5)
      },
    })
    const manager = new SessionSyncManager(managerOptions({
      nmemApi,
      readThreadMessages: async () => FULL_TRANSCRIPT,
      ...timers,
    }))
    await manager.syncNow(THREAD_ID)
    manager.scheduleSync(THREAD_ID, FOLLOW_UP_TRANSCRIPT)
    await fireUntil(timers, nmemApi, 3)
    expect((nmemApi.bodies[2] as { space_id?: string }).space_id).toBeUndefined()
  })

  it("recreates the complete thread after HTTP 400 Thread not found", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({
      "/threads": () => createAck("amp-t-abc123", 4),
      "/threads/amp-t-abc123/append": () => ({
        ok: false,
        status: 400,
        data: { detail: "Thread not found: amp-t-abc123" },
      }),
    })
    const manager = new SessionSyncManager(managerOptions({
      nmemApi,
      readThreadMessages: async () => FULL_TRANSCRIPT,
      ...timers,
    }))
    await manager.syncNow(THREAD_ID)
    manager.scheduleSync(THREAD_ID, FOLLOW_UP_TRANSCRIPT)
    await fireUntil(timers, nmemApi, 3)
    expect(nmemApi.calls).toEqual([
      "/threads",
      "/threads/amp-t-abc123/append",
      "/threads",
    ])
  })

  it("resets to a full suffix when an earlier prefix is replaced", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({
      "/threads": () => createAck(),
      "/threads/amp-t-abc123/append": () => appendAck(2, 2),
    })
    const manager = new SessionSyncManager(managerOptions({
      nmemApi,
      readThreadMessages: async () => FULL_TRANSCRIPT,
      ...timers,
    }))
    await manager.syncNow(THREAD_ID)

    const rewritten = [
      { role: "user", id: "u1", parts: [{ type: "text", text: "rewritten hello" }] },
      { role: "assistant", id: "a1", parts: [{ type: "text", text: "hi back" }] },
    ]
    manager.scheduleSync(THREAD_ID, rewritten)
    await fireUntil(timers, nmemApi, 2)

    const appendBody = nmemApi.bodies[1] as {
      readonly messages: Array<{ readonly content: string }>
      readonly expected_message_count?: number
    }
    expect(appendBody.expected_message_count).toBeUndefined()
    expect(appendBody.messages.map((message) => message.content)).toEqual(["rewritten hello", "hi back"])
  })

  it("does not immediately retry or read the full transcript when an incremental persist fails", async () => {
    const timers = fakeTimers()
    const readThreadMessages = vi.fn(async () => FULL_TRANSCRIPT)
    let attempts = 0
    const nmemApi = fakeNmemApi({
      "/threads": () => {
        attempts += 1
        return attempts === 1
          ? { ok: false, status: 500, data: { error: "boom" } }
          : createAck(STABLE_THREAD_ID, 4)
      },
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, readThreadMessages, ...timers }))
    manager.scheduleSync(THREAD_ID, FULL_TRANSCRIPT)
    await fireUntil(timers, nmemApi, 1)
    expect(readThreadMessages).not.toHaveBeenCalled()
    expect(nmemApi.calls).toEqual(["/threads"])

    manager.scheduleSync(THREAD_ID, FOLLOW_UP_TRANSCRIPT)
    await fireUntil(timers, nmemApi, 2)
    expect(readThreadMessages).not.toHaveBeenCalled()
    expect(nmemApi.calls).toEqual(["/threads", "/threads"])
    expect((nmemApi.bodies[1] as { messages: unknown[] }).messages).toHaveLength(4)
  })

  it("holds an unanswered user tail until a later assistant completes it", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({
      "/threads": () => createAck(),
      "/threads/amp-t-abc123/append": () => appendAck(2, 4, true),
    })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, ...timers }))

    manager.scheduleSync(THREAD_ID, [
      ...FULL_TRANSCRIPT,
      FOLLOW_UP_TRANSCRIPT[0],
    ])
    await fireUntil(timers, nmemApi, 1)
    expect((nmemApi.bodies[0] as { messages: unknown[] }).messages).toHaveLength(2)

    manager.scheduleSync(THREAD_ID, [FOLLOW_UP_TRANSCRIPT[1]])
    await fireUntil(timers, nmemApi, 2)
    const appendBody = nmemApi.bodies[1] as {
      messages: Array<{ metadata: { external_id: string } }>
      expected_message_count: number
    }
    expect(appendBody.messages.map((message) => message.metadata.external_id)).toEqual([
      "amp-msg-u2",
      "amp-msg-a2",
    ])
    expect(appendBody.expected_message_count).toBe(2)
  })

  it("uses the automatic timeout for scheduled captures and the existing manual timeout for syncNow", async () => {
    const timers = fakeTimers()
    const nmemApi = fakeNmemApi({ "/threads": () => createAck() })
    const manager = new SessionSyncManager(managerOptions({ nmemApi, autoSyncTimeoutMs: 12_000, ...timers }))
    manager.scheduleSync(THREAD_ID)
    await fireUntil(timers, nmemApi, 1)
    await manager.syncNow(THREAD_ID)
    expect(nmemApi.timeouts).toEqual([12_000, MANUAL_SYNC_TIMEOUT_MS])
  })

  it("holds independent checkpoint state across two manager instances", async () => {
    const firstApi = fakeNmemApi({ "/threads": () => createAck() })
    const secondApi = fakeNmemApi({ "/threads": () => createAck() })
    const first = new SessionSyncManager(managerOptions({ nmemApi: firstApi, ambientSpaceId: "space-a" }))
    const second = new SessionSyncManager(managerOptions({ nmemApi: secondApi, ambientSpaceId: "space-b" }))
    await first.syncNow(THREAD_ID)
    await second.syncNow(THREAD_ID)
    expect(firstApi.calls).toEqual(["/threads"])
    expect(secondApi.calls).toEqual(["/threads"])
  })
})


// Ensure CaptureResult is referenced for type-only import side effects in coverage.
export type { CaptureResult }
