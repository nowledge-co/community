/**
 * Session-capture orchestration.
 *
 * Owns the lifecycle of turning an Amp thread into a persisted Nowledge Mem
 * thread: reading the transcript, converting it, posting it (create-then-append
 * for idempotency), and deduplicating across rapid turn boundaries.
 *
 * The manager depends on an injected {@link NmemHttp}, a thread-message reader,
 * a source-app tag, a project path, and timer functions. None of those are
 * constructed here, so the whole class is unit-testable without a real Amp or
 * Mem instance.
 */

import type { NmemHttp } from "./http"
import { captureSignature, normalizeMessages, toThreadMessages } from "./messages"
import type { ThreadMessage } from "./messages"
import type { ThreadID } from "./types"

/** Injectable `setTimeout`. */
export type SetTimer = (handler: () => void, ms: number) => TimerHandle
/** Injectable `clearTimeout`. */
export type ClearTimer = (handle: TimerHandle) => void
/** Opaque handle returned by the injected `setTimeout`. */
export type TimerHandle = ReturnType<typeof setTimeout>

/** Reasons a capture run can be triggered. */
export type CaptureReason = "agent_end" | "manual_tool"

/** Injectable ports required to build a session sync manager. */
export interface SyncPorts {
  /** HTTP client used to persist threads. */
  readonly nmemApi: NmemHttp
  /** Reads the raw transcript for a thread. */
  readonly readThreadMessages: (threadId: ThreadID) => Promise<unknown[]>
  /** Injectable `setTimeout`. */
  readonly setTimer: SetTimer
  /** Injectable `clearTimeout`. */
  readonly clearTimer: ClearTimer
}

/** Construction options for the session sync manager. */
export interface SessionSyncManagerOptions extends SyncPorts {
  /** Source application tag stamped on persisted threads. */
  readonly sourceApp: string
  /** Absolute path of the active workspace, recorded as the thread project. */
  readonly projectPath: string
  /** Whether automatic (debounced) capture is enabled. */
  readonly autoSyncEnabled: boolean
  /** Debounce window (milliseconds) for automatic capture. */
  readonly autoSyncDebounceMs: number
  /** Ambient space id, recorded on append requests when set. */
  readonly ambientSpaceId: string | undefined
}

/** Per-thread state used for debounce, in-flight coalescing, and dedup. */
interface SyncState {
  /** Pending debounce timer handle, if a sync is scheduled. */
  timer: TimerHandle | undefined
  /** In-flight capture promise, if a sync is currently running. */
  inFlight: Promise<unknown> | undefined
  /** Flag set when a sync was requested while one was already running. */
  pending: boolean
  /** Messages supplied by pending automatic captures, if any. */
  pendingMessages: readonly unknown[] | undefined
  /** Signature of the last successfully captured transcript. */
  lastSignature: string | undefined
  /** Serialized manual-capture queue for this thread. */
  manualQueue: Promise<CaptureResult> | undefined
}

/** Result object returned by an explicit capture. */
export interface CaptureResult {
  /** Whether the capture succeeded. */
  readonly success?: boolean
  /** Whether the capture was skipped and why. */
  readonly skipped?: boolean
  /** Reason the capture was skipped, when applicable. */
  readonly reason?: string
  /** Error message, when the capture failed. */
  readonly error?: string
  /** Persisted thread id. */
  readonly threadId: string
  /** Number of messages persisted in this run. */
  readonly messagesSaved: number
  /** Title used for the persisted thread. */
  readonly title: string
}

/** Empty-message-list skip result. */
function skipped(reason: string, threadId: string): CaptureResult {
  return { skipped: true, reason, threadId, messagesSaved: 0, title: "" }
}

/**
 * Orchestrates capture of a single Amp thread into Nowledge Mem.
 *
 * One instance serves all threads for a plugin run. Per-thread state is kept in
 * a map keyed by thread id. Call {@link dispose} on plugin teardown to clear any
 * pending debounce timers.
 */
export class SessionSyncManager {
  private readonly ports: SyncPorts
  private readonly sourceApp: string
  private readonly projectPath: string
  private readonly autoSyncEnabled: boolean
  private readonly autoSyncDebounceMs: number
  private readonly ambientSpaceId: string | undefined
  private readonly states = new Map<ThreadID, SyncState>()
  private disposed = false

  /**
   * @param options - Construction options and injected ports.
   */
  public constructor(options: SessionSyncManagerOptions) {
    this.ports = options
    this.sourceApp = options.sourceApp
    this.projectPath = options.projectPath
    this.autoSyncEnabled = options.autoSyncEnabled
    this.autoSyncDebounceMs = options.autoSyncDebounceMs
    this.ambientSpaceId = options.ambientSpaceId
  }

  /**
   * Schedules a debounced capture for a thread.
   *
   * Repeated calls within the debounce window reset the timer so only the last
   * call fires. If automatic capture is disabled, this is a no-op.
   *
   * @param threadId - The thread to capture.
   * @param messages - Messages supplied by the host's `agent.end` event. When
   * omitted, the caller reads the complete thread transcript through the SDK.
   */
  public scheduleSync(threadId: ThreadID, messages?: readonly unknown[]): void {
    if (this.disposed || !this.autoSyncEnabled) return
    const state = this.stateFor(threadId)
    state.pendingMessages = mergeMessageBatches(state.pendingMessages, messages)
    if (state.timer !== undefined) {
      this.ports.clearTimer(state.timer)
    }
    state.timer = this.ports.setTimer(() => {
      state.timer = undefined
      const pendingMessages = state.pendingMessages
      state.pendingMessages = undefined
      void this.runAutoSync(threadId, pendingMessages)
    }, this.autoSyncDebounceMs)
  }

  /**
   * Runs an immediate capture, ignoring the debounce window and forcing a
   * re-upload even when the signature matches the last run.
   *
   * Participates in the per-thread in-flight guard so a manual capture and a
   * scheduled automatic capture for the same thread never run concurrently.
   * When a capture is already in-flight, the manual call waits for it to finish
   * (coalescing), then runs its own forced capture.
   *
   * Used by the manual `nowledge_mem_save_thread` tool and the
   * `nowledge-mem:save-thread` command.
   *
   * @param threadId - The thread to capture.
   * @returns The capture result, suitable for JSON-serialising back to the agent.
   */
  public syncNow(threadId: ThreadID): Promise<CaptureResult> {
    if (this.disposed) return Promise.resolve(skipped("disposed", this.stableThreadId(threadId)))
    const state = this.stateFor(threadId)
    const priorManual = state.manualQueue ?? Promise.resolve(skipped("manual_queue_start", this.stableThreadId(threadId)))
    const run = priorManual
      .catch(() => skipped("manual_queue_error", this.stableThreadId(threadId)))
      .then(async () => {
        if (this.disposed) return skipped("disposed", this.stableThreadId(threadId))
        while (state.inFlight !== undefined) {
          const previous = state.inFlight
          await previous.catch(() => undefined)
          // Teardown during an awaited prior capture is handled by the
          // surrounding disposal guard; this branch is a defensive race check.
          /* c8 ignore next */
          if (this.disposed) return skipped("disposed", this.stableThreadId(threadId))
          // Preserve a newer runner installed while this caller was waiting.
          /* c8 ignore next */
          if (state.inFlight === previous) state.inFlight = undefined
        }
        return this.captureThread(threadId, { force: true })
      })
    const guarded = run.finally(() => {
      // Defensive identity guard prevents stale promises clearing a newer queue.
      /* c8 ignore next */
      if (state.manualQueue !== guarded) return
      state.manualQueue = undefined
      if (!this.disposed && state.pending) {
        state.pending = false
        const pendingMessages = state.pendingMessages
        state.pendingMessages = undefined
        this.scheduleSync(threadId, pendingMessages)
      }
    })
    state.manualQueue = guarded
    return guarded
  }

  /**
   * Clears all pending debounce timers.
   *
   * Called from the plugin's `onDispose` hook so no timer fires after teardown.
   */
  public dispose(): void {
    this.disposed = true
    for (const state of this.states.values()) {
      if (state.timer !== undefined) {
        this.ports.clearTimer(state.timer)
        state.timer = undefined
      }
    }
    this.states.clear()
  }

  /**
   * Runs an automatic (non-forced) capture for a thread.
   *
   * Coalesces with an in-flight capture by setting the `pending` flag, then
   * re-schedules one final capture once the in-flight run completes.
   *
   * @param threadId - The thread to capture.
   * @param messages - Messages from the `agent.end` event that triggered this
   * capture, when available.
   */
  private async runAutoSync(threadId: ThreadID, messages?: readonly unknown[]): Promise<void> {
    const state = this.stateFor(threadId)
    if (state.inFlight !== undefined || state.manualQueue !== undefined) {
      state.pending = true
      state.pendingMessages = mergeMessageBatches(state.pendingMessages, messages)
      return
    }
    const run = this.captureThread(threadId, { force: false, messages })
      .catch(() => undefined)
    let guarded: Promise<CaptureResult | undefined>
    guarded = run.finally(() => {
      // Defensive identity guard for an externally replaced runner; normal
      // serialized execution always owns this state.
      /* c8 ignore next */
      if (state.inFlight !== guarded) return
      state.inFlight = undefined
      if (!this.disposed && state.pending) {
        state.pending = false
        const pendingMessages = state.pendingMessages
        state.pendingMessages = undefined
        this.scheduleSync(threadId, pendingMessages)
      }
    })
    state.inFlight = guarded
    await guarded
  }

  /**
   * Captures a thread, applying signature-based dedup unless `force` is set.
   *
   * @param threadId - The thread to capture.
   * @param options - Capture options controlling the force flag and an optional
   * host-supplied incremental message batch.
   * @returns The capture result.
   */
  private async captureThread(
    threadId: ThreadID,
    options: { force: boolean; messages?: readonly unknown[] },
  ): Promise<CaptureResult> {
    const stableThreadId = this.stableThreadId(threadId)

    const rawMessages = options.messages ?? await this.ports.readThreadMessages(threadId)
    const sdkMessages = normalizeMessages(rawMessages)
    if (sdkMessages.length === 0) {
      return skipped("no_messages", stableThreadId)
    }

    const threadMessages = toThreadMessages(sdkMessages, { sourceApp: this.sourceApp })
    if (threadMessages.length === 0) {
      return skipped("no_extractable_messages", stableThreadId)
    }
    if (!hasUserAndAssistant(threadMessages)) {
      return skipped("incomplete_turn", stableThreadId)
    }

    const signature = captureSignature(threadMessages)
    const state = this.stateFor(threadId)
    if (!options.force && state.lastSignature === signature) {
      return skipped("already_synced", stableThreadId)
    }

    const result = await this.persistThread(stableThreadId, threadMessages)
    if (result.error === undefined) {
      state.lastSignature = signature
    }
    return result
  }

  /**
   * Persists thread messages via create-then-append for idempotency.
   *
   * @param stableThreadId - The lowercased, source-prefixed thread id.
   * @param threadMessages - The converted thread messages to persist.
   * @returns The capture result.
   */
  private async persistThread(
    stableThreadId: string,
    threadMessages: readonly ThreadMessage[],
  ): Promise<CaptureResult> {
    const title = deriveTitle(threadMessages)
    const body = {
      thread_id: stableThreadId,
      title,
      messages: threadMessages,
      source: this.sourceApp,
      project: this.projectPath,
      workspace: this.projectPath,
    }

    let response = await this.ports.nmemApi("/threads", body)

    const conflictText = JSON.stringify(response.data)?.toLowerCase() ?? ""
    const threadAlreadyExists =
      response.status === 409
      || (response.status === 422
        && (conflictText.includes("already exists") || conflictText.includes("thread exists")))

    // Only fall back to append when the thread already exists. The current
    // server uses 422 for this condition while older deployments use 409.
    // Other errors (auth, server, permission) should surface the original
    // failure rather than doubling API calls with a doomed append.
    if (!response.ok && threadAlreadyExists) {
      const appendBody = {
        messages: threadMessages,
        deduplicate: true,
        idempotency_key: `${this.sourceApp}:live:${stableThreadId}`,
        ...(this.ambientSpaceId !== undefined ? { space_id: this.ambientSpaceId } : {}),
      }
      response = await this.ports.nmemApi(`/threads/${encodeURIComponent(stableThreadId)}/append`, appendBody)
    }

    if (!response.ok) {
      return {
        error: `Thread save failed (${response.status}): ${JSON.stringify(response.data)}`,
        threadId: stableThreadId,
        messagesSaved: 0,
        title,
      }
    }

    return {
      success: true,
      threadId: stableThreadId,
      messagesSaved: threadMessages.length,
      title,
    }
  }

  /**
   * Returns the per-thread state, creating it on first access.
   *
   * @param threadId - The thread id.
   * @returns The mutable state record for the thread.
   */
  private stateFor(threadId: ThreadID): SyncState {
    let state = this.states.get(threadId)
    if (state === undefined) {
      state = {
        timer: undefined,
        inFlight: undefined,
        pending: false,
        pendingMessages: undefined,
        lastSignature: undefined,
        manualQueue: undefined,
      }
      this.states.set(threadId, state)
    }
    return state
  }

  /**
   * Computes the lowercased, source-prefixed thread id used by Nowledge Mem.
   *
   * Lowercasing matches the import-service dedup convention.
   *
   * @param threadId - The raw Amp thread id.
   * @returns The stable thread id.
   */
  private stableThreadId(threadId: ThreadID): string {
    return `${this.sourceApp}-${threadId}`.toLowerCase()
  }
}

/**
 * Derives a human-readable title for a persisted thread.
 *
 * Prefers the first user message; falls back to the first message of any role;
 * finally falls back to a constant. Titles are truncated to 120 characters.
 *
 * @param messages - Thread messages to derive a title from.
 * @returns The derived title.
 */
function deriveTitle(messages: readonly ThreadMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user")
  // Defensive: deriveTitle runs only after hasUserAndAssistant confirms both
  // roles, so firstUser is always defined and source is never undefined. The
  // ?? fallback, optional chaining, and undefined-content branch keep the
  // function total but are unreachable in practice.
  /* c8 ignore start */
  const source = firstUser ?? messages[0]
  const content = source?.content
  if (content === undefined) {
    return "Amp Session"
  }
  /* c8 ignore stop */
  return content.length > 120 ? content.slice(0, 120) : content
}

/**
 * Checks whether a message list contains at least one user and one assistant
 * turn, so partial transcripts are not persisted as complete sessions.
 *
 * @param messages - Thread messages to check.
 * @returns `true` when both roles are present.
 */
function hasUserAndAssistant(messages: readonly ThreadMessage[]): boolean {
  let hasUser = false
  let hasAssistant = false
  for (const message of messages) {
    if (message.role === "user") hasUser = true
    else hasAssistant = true
  }
  return hasUser && hasAssistant
}

/**
 * Merges host-supplied incremental batches without dropping earlier debounced
 * or in-flight agent.end payloads. Amp documents agent.end messages as the
 * messages since agent.start, so they are not safe to replace wholesale.
 *
 * @param existing - Previously queued automatic messages.
 * @param next - New automatic messages from the host.
 * @returns A stable-order merged batch, or `undefined` when neither exists.
 */
function mergeMessageBatches(
  existing: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): readonly unknown[] | undefined {
  if (next === undefined) return existing
  if (existing === undefined || existing.length === 0) return next
  if (next.length === 0) return existing

  const merged: unknown[] = []
  const seen = new Set<string>()
  for (const message of [...existing, ...next]) {
    const key = messageKey(message)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(message)
  }
  return merged
}

/**
 * Returns a stable key for a raw SDK message before normalization. Prefer the
 * host message id; fall back to the serialized shape for defensive de-dupe.
 *
 * @param message - Raw SDK message-like value.
 * @returns A stable key for merge-time de-duplication.
 */
function messageKey(message: unknown): string {
  if (typeof message === "object" && message !== null && "id" in message) {
    const id = (message as { readonly id?: unknown }).id
    if (typeof id === "string" || typeof id === "number") {
      return `id:${String(id)}`
    }
  }
  return `json:${JSON.stringify(message)}`
}
