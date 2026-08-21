/**
 * Session-capture orchestration.
 *
 * Owns the lifecycle of turning an Amp thread into a persisted Nowledge Mem
 * thread: reading the transcript, converting it, posting an incremental
 * checkpointed suffix, and isolating cursor state by destination lane.
 *
 * The manager depends on an injected {@link NmemHttp}, a thread-message reader,
 * a source-app tag, a project path, and timer functions. None of those are
 * constructed here, so the whole class is unit-testable without a real Amp or
 * Mem instance.
 */

import type { HttpResponse, NmemHttp } from "./http"
import { normalizeMessages, toThreadMessages } from "./messages"
import type { ThreadMessage } from "./messages"
import {
  appendAcknowledgedRemoteCount,
  createAcknowledgedRemoteCount,
  isCheckpointConflictResponse,
  isCheckpointedAppendAck,
  isThreadAlreadyExistsResponse,
  recreateMissingThread,
  selectAcknowledgedDelta,
  sessionSyncLaneKey,
  type AcknowledgedCursor,
} from "./session-delta"
import type { ThreadID } from "./types"

/** Injectable `setTimeout`. */
export type SetTimer = (handler: () => void, ms: number) => TimerHandle
/** Injectable `clearTimeout`. */
export type ClearTimer = (handle: TimerHandle) => void
/** Opaque handle returned by the injected `setTimeout`. */
export type TimerHandle = ReturnType<typeof setTimeout>

/** Reasons a capture run can be triggered. */
export type CaptureReason = "agent_end" | "manual_tool"

/** Existing timeout for explicit manual thread saves. */
export const MANUAL_SYNC_TIMEOUT_MS = 120_000

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
  /** HTTP timeout (milliseconds) for automatic capture. */
  readonly autoSyncTimeoutMs: number
  /** Resolved Mem API URL, used to isolate destination-lane cursor state. */
  readonly apiUrl: string
  /** Optional API key, used to isolate destination-lane cursor state. */
  readonly apiKey: string | undefined
  /** Ambient space id, recorded on append requests when set. */
  readonly ambientSpaceId: string | undefined
  /** Ambient AI Identity, used to isolate destination-lane cursor state. */
  readonly ambientAgentId: string | undefined
  /** Optional host-agent alias, used to isolate destination-lane cursor state. */
  readonly ambientHostAgentId: string | undefined
}

/** Per-thread state used for debounce, in-flight coalescing, and checkpoints. */
interface SyncState {
  /** Raw Amp thread id associated with this destination-lane state. */
  readonly threadId: ThreadID
  /** Pending debounce timer handle, if a sync is scheduled. */
  timer: TimerHandle | undefined
  /** In-flight capture promise, if a sync is currently running. */
  inFlight: Promise<unknown> | undefined
  /** Flag set when a sync was requested while one was already running. */
  pending: boolean
  /** Messages supplied by pending automatic captures, if any. */
  pendingMessages: readonly unknown[] | undefined
  /** Accumulated automatic-turn snapshot used to select suffixes. */
  localSnapshot: ThreadMessage[] | undefined
  /** Whether the remote thread is known to exist. */
  created: boolean
  /** Last cursor acknowledged by an explicit persist response. */
  acknowledged: AcknowledgedCursor | undefined
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
  /** Persist action that succeeded, when applicable. */
  readonly action?: "created" | "appended" | "reconciled"
  /** Whether the persist reset the local checkpoint. */
  readonly checkpointReset?: boolean
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
 * a map keyed by destination lane. Call {@link dispose} on plugin teardown to
 * flush pending captures and clear their debounce timers.
 */
export class SessionSyncManager {
  private readonly ports: SyncPorts
  private readonly sourceApp: string
  private readonly projectPath: string
  private readonly autoSyncEnabled: boolean
  private readonly autoSyncDebounceMs: number
  private readonly autoSyncTimeoutMs: number
  private readonly apiUrl: string
  private readonly apiKey: string | undefined
  private readonly ambientSpaceId: string | undefined
  private readonly ambientAgentId: string | undefined
  private readonly ambientHostAgentId: string | undefined
  private readonly states = new Map<string, SyncState>()
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
    this.autoSyncTimeoutMs = options.autoSyncTimeoutMs
    this.apiUrl = options.apiUrl
    this.apiKey = options.apiKey
    this.ambientSpaceId = options.ambientSpaceId
    this.ambientAgentId = options.ambientAgentId
    this.ambientHostAgentId = options.ambientHostAgentId
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
   * full-snapshot persist even when the current suffix is empty.
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
        return this.captureThread(threadId, { force: true, timeoutMs: MANUAL_SYNC_TIMEOUT_MS })
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

  /** Flushes pending captures and waits for active work during teardown. */
  public async dispose(): Promise<void> {
    this.disposed = true
    const flushes: Promise<unknown>[] = []
    for (const state of this.states.values()) {
      const shouldFlush = state.timer !== undefined || state.pending
      if (state.timer !== undefined) {
        this.ports.clearTimer(state.timer)
        state.timer = undefined
      }
      const pendingMessages = state.pendingMessages
      state.pending = false
      state.pendingMessages = undefined
      flushes.push((async () => {
        await Promise.allSettled(
          [state.inFlight, state.manualQueue].filter((run) => run !== undefined),
        )
        if (shouldFlush) {
          await this.captureThread(state.threadId, {
            force: false,
            messages: pendingMessages,
            timeoutMs: this.autoSyncTimeoutMs,
          })
        }
      })())
    }
    await Promise.allSettled(flushes)
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
    const run = this.captureThread(threadId, {
      force: false,
      messages,
      timeoutMs: this.autoSyncTimeoutMs,
    })
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
   * Captures a thread, applying checkpointed suffix upload unless `force` is set.
   *
   * Automatic `agent.end` batches are merged into a local snapshot so the
   * checkpoint cursor can see the complete prefix. Manual saves read the full
   * SDK transcript. An automatic failure preserves that snapshot and cursor for
   * a later lifecycle event rather than retrying immediately.
   *
   * @param threadId - The thread to capture.
   * @param options - Capture options controlling force, timeout, and an optional
   * host-supplied incremental message batch.
   * @returns The capture result.
   */
  private async captureThread(
    threadId: ThreadID,
    options: { force: boolean; timeoutMs: number; messages?: readonly unknown[] },
  ): Promise<CaptureResult> {
    const incremental = !options.force
    const rawMessages = options.messages ?? await this.ports.readThreadMessages(threadId)
    const result = await this.persistSnapshot(threadId, rawMessages, {
      force: options.force,
      incremental,
      timeoutMs: options.timeoutMs,
    })
    return result
  }

  /**
   * Converts, filters, and persists a raw snapshot or incremental batch.
   *
   * @param threadId - The thread to capture.
   * @param rawMessages - Raw SDK messages.
   * @param options - Persist options.
   * @returns The capture result.
   */
  private async persistSnapshot(
    threadId: ThreadID,
    rawMessages: readonly unknown[],
    options: { force: boolean; incremental: boolean; timeoutMs: number },
  ): Promise<CaptureResult> {
    const stableThreadId = this.stableThreadId(threadId)
    const sdkMessages = normalizeMessages(rawMessages)
    if (sdkMessages.length === 0) {
      return skipped("no_messages", stableThreadId)
    }

    const incoming = toThreadMessages(sdkMessages, { sourceApp: this.sourceApp })
    if (incoming.length === 0) {
      return skipped("no_extractable_messages", stableThreadId)
    }

    const state = this.stateFor(threadId)
    const snapshot = options.incremental
      ? mergeThreadMessages(state.localSnapshot, incoming)
      : incoming
    if (options.incremental) {
      // Keep even an unanswered user tail (and keep it across persist errors),
      // so a later agent.end batch can complete and upload that turn.
      state.localSnapshot = snapshot
    }
    const threadMessages = options.incremental
      ? throughLastAssistant(snapshot)
      : snapshot
    if (!hasUserAndAssistant(threadMessages)) {
      return skipped("incomplete_turn", stableThreadId)
    }

    const result = await this.persistThread(stableThreadId, threadMessages, {
      force: options.force,
      timeoutMs: options.timeoutMs,
      state,
    })
    if (!options.incremental && result.error === undefined) {
      state.localSnapshot = threadMessages
    }
    return result
  }

  /**
   * Persists thread messages via create-then-checkpointed-append.
   *
   * The local cursor advances only after an explicit create or checkpoint
   * acknowledgement. Same-length replacements reset to a full replay; HTTP 400
   * `Thread not found` recreates the complete snapshot.
   *
   * @param stableThreadId - The lowercased, source-prefixed thread id.
   * @param threadMessages - The converted thread messages to persist.
   * @param options - Persist options including the per-lane state and timeout.
   * @returns The capture result.
   */
  private async persistThread(
    stableThreadId: string,
    threadMessages: readonly ThreadMessage[],
    options: { force: boolean; timeoutMs: number; state: SyncState },
  ): Promise<CaptureResult> {
    const title = deriveTitle(threadMessages)
    const state = options.state
    const delta = selectAcknowledgedDelta(
      threadMessages,
      options.force ? undefined : state.acknowledged,
      (message) => message.metadata.external_id,
      threadMessageFingerprint,
    )
    if (delta.messages.length === 0) {
      return skipped("already_synced", stableThreadId)
    }

    const createBody = {
      thread_id: stableThreadId,
      title,
      messages: threadMessages,
      source: this.sourceApp,
      project: this.projectPath,
      workspace: this.projectPath,
    }

    let response: HttpResponse = state.created
      ? { ok: false, status: 409, data: { detail: "thread already created locally" } }
      : await this.ports.nmemApi("/threads", createBody, options.timeoutMs)
    let action: "created" | "appended" | "reconciled" = state.created ? "appended" : "created"
    let checkpointed = false
    let persistedMessages = delta.messages.length

    if (!response.ok && isThreadAlreadyExistsResponse(response.status, response.data)) {
      state.created = true
      response = await this.ports.nmemApi(
        `/threads/${encodeURIComponent(stableThreadId)}/append`,
        {
          messages: delta.messages,
          deduplicate: true,
          idempotency_key: `${this.sourceApp}:live:${stableThreadId}:${delta.start}-${delta.end}:${delta.next.prefixFingerprint}`,
          ...(state.acknowledged !== undefined && !delta.reset
            ? { expected_message_count: state.acknowledged.remoteCount }
            : {}),
          ...(this.ambientSpaceId !== undefined ? { space_id: this.ambientSpaceId } : {}),
        },
        options.timeoutMs,
      )
      checkpointed = state.acknowledged !== undefined && !delta.reset
      action = "appended"
    }

    if (!response.ok && checkpointed && isCheckpointConflictResponse(response.data)) {
      response = await this.ports.nmemApi(
        `/threads/${encodeURIComponent(stableThreadId)}/append`,
        {
          messages: threadMessages,
          deduplicate: true,
          idempotency_key: `${this.sourceApp}:reconcile:${stableThreadId}:${delta.next.prefixFingerprint}`,
          ...(this.ambientSpaceId !== undefined ? { space_id: this.ambientSpaceId } : {}),
        },
        options.timeoutMs,
      )
      checkpointed = false
      persistedMessages = threadMessages.length
      action = "reconciled"
    }

    const recovered = await recreateMissingThread(response, async () => {
      state.created = false
      return this.ports.nmemApi("/threads", createBody, options.timeoutMs)
    })
    if (recovered.recreated) {
      response = recovered.response
      action = "created"
      checkpointed = false
      persistedMessages = threadMessages.length
    }

    if (!response.ok) {
      return {
        error: `Thread save failed (${response.status}): ${JSON.stringify(response.data)}`,
        threadId: stableThreadId,
        messagesSaved: 0,
        title,
      }
    }

    const remoteCount = action === "created"
      ? createAcknowledgedRemoteCount(response.data, stableThreadId)
      : appendAcknowledgedRemoteCount(response.data)
    if (remoteCount === undefined) {
      return {
        error: "Thread save did not include an explicit persistence acknowledgement; cursor was preserved",
        threadId: stableThreadId,
        messagesSaved: 0,
        title,
      }
    }
    if (checkpointed && !isCheckpointedAppendAck(response.data)) {
      return {
        error: "Thread append was not acknowledged as checkpointed; cursor was preserved",
        threadId: stableThreadId,
        messagesSaved: 0,
        title,
      }
    }

    state.created = true
    state.acknowledged = { ...delta.next, remoteCount }
    return {
      success: true,
      action,
      checkpointReset: delta.reset,
      threadId: stableThreadId,
      messagesSaved: persistedMessages,
      title,
    }
  }

  /**
   * Returns the per-lane state, creating it on first access.
   *
   * @param threadId - The thread id.
   * @returns The mutable state record for the destination lane.
   */
  private stateFor(threadId: ThreadID): SyncState {
    const key = sessionSyncLaneKey(
      String(threadId),
      this.apiUrl,
      this.apiKey,
      this.ambientSpaceId,
      this.ambientAgentId,
      this.ambientHostAgentId,
    )
    let state = this.states.get(key)
    if (state === undefined) {
      state = {
        threadId,
        timer: undefined,
        inFlight: undefined,
        pending: false,
        pendingMessages: undefined,
        localSnapshot: undefined,
        created: false,
        acknowledged: undefined,
        manualQueue: undefined,
      }
      this.states.set(key, state)
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

/** Returns the prefix ending at the last answered assistant turn. */
function throughLastAssistant(messages: readonly ThreadMessage[]): ThreadMessage[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") return messages.slice(0, index + 1)
  }
  return []
}

/**
 * Fingerprints a converted thread message without volatile timestamps.
 *
 * Amp fills missing SDK timestamps at convert time, so including `timestamp`
 * would treat every recapture of the same turn as a prefix replacement.
 *
 * @param message - Converted thread message.
 * @returns A stable content-bound fingerprint.
 */
function threadMessageFingerprint(message: ThreadMessage): string {
  return JSON.stringify({
    role: message.role,
    content: message.content,
    external_id: message.metadata.external_id,
    agent: message.metadata.agent,
    model: message.metadata.model,
  })
}

/**
 * Merges a newly converted incremental batch onto the acknowledged local
 * snapshot. Existing external ids keep their position and are replaced when
 * the host rewrites a message in place.
 *
 * @param existing - Previously acknowledged local snapshot.
 * @param incoming - Newly converted incremental messages.
 * @returns The merged snapshot in stable order.
 */
function mergeThreadMessages(
  existing: readonly ThreadMessage[] | undefined,
  incoming: readonly ThreadMessage[],
): ThreadMessage[] {
  if (existing === undefined || existing.length === 0) return [...incoming]
  const merged = [...existing]
  const indexById = new Map(merged.map((message, index) => [message.metadata.external_id, index]))
  for (const message of incoming) {
    const index = indexById.get(message.metadata.external_id)
    if (index === undefined) {
      indexById.set(message.metadata.external_id, merged.length)
      merged.push(message)
    } else {
      merged[index] = message
    }
  }
  return merged
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
