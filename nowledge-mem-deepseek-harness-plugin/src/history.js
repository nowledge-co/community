import { randomBytes } from 'node:crypto'
import { transcriptMessage, transcriptText } from './transcript.js'
import { captureSession } from './session-capture.js'

const USAGE = '/mem-backfill list [offset] | preview <space-id> <session-id>… (max 10) | apply <token> | cancel'
const TTL = 10 * 60_000
const PAGE_SIZE = 50

function eligible(header, cwd) {
  return typeof cwd === 'string' && cwd !== '' && header?.cwd === cwd
    && header.origin !== 'subagent' && header.private !== true
}

function cleanSnapshot(snapshot, id, cwd) {
  if (snapshot?.session?.id !== id || !eligible(snapshot.session, cwd) || !Array.isArray(snapshot.events)) {
    throw new Error('session scope changed')
  }
  if (snapshot.events.length > 100_000) throw new Error('session exceeds event limit')
  const events = snapshot.events.flatMap(event => {
    const message = transcriptMessage(event)
    if (message === undefined) return []
    const text = transcriptText(message)
    if (text.trim() === '') return []
    const clean = { id: message.id, source: message.source, content: [{ type: 'text', text }] }
    return [{ ...event, data: event.type === 'user/message' ? clean : { turn: event.data.turn, step: event.data.step, message: clean } }]
  })
  // Do not retain stream/tool/reasoning fields from the original event object.
  const detached = {
    header: structuredClone(snapshot.session),
    events: events.map(({ seq, type, time, data }) => ({ seq, type, time, data })),
  }
  if (Buffer.byteLength(JSON.stringify(detached)) > 2 * 1024 * 1024) throw new Error('session exceeds size limit')
  return detached
}

/** Human-only native command; no model tool, filesystem scan or startup upload. */
export function historyCommand(ctx, config, resolveConnection, importSession, now = Date.now) {
  let plans = new WeakMap()
  const busy = new WeakSet()
  const controllers = new WeakMap(), active = new Map(), timers = new Set()
  const forget = owner => {
    const plan = plans.get(owner)
    if (plan !== undefined) { clearTimeout(plan.timer); timers.delete(plan.timer) }
    plans.delete(owner)
  }
  let disposed = false
  ctx.effect?.(() => () => {
    disposed = true
    plans = new WeakMap()
    for (const controller of active.keys()) controller.abort()
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    return Promise.allSettled(active.values())
  })
  return {
    name: 'mem-backfill',
    description: 'Preview and explicitly import selected DSH conversations into Mem',
    recordInput: false,
    input: { hint: USAGE },
    handler: async ({ agent, rawInput, signal: parentSignal }) => {
      const owner = agent.session
      const [action, ...args] = rawInput.trim().split(/\s+/u)
      if (disposed) return { kind: 'error', text: 'Backfill plugin is stopping.' }
      if (action === 'cancel') {
        forget(owner)
        controllers.get(owner)?.abort()
        return { kind: 'success', text: 'Pending preview discarded; no further sessions will be started by it.' }
      }
      if (busy.has(owner)) return { kind: 'error', text: 'A backfill operation is already running in this session.' }
      busy.add(owner)
      const controller = new AbortController()
      controllers.set(owner, controller)
      const retired = Promise.withResolvers()
      active.set(controller, retired.promise)
      const signal = AbortSignal.any([parentSignal, controller.signal])
      try {
        signal.throwIfAborted()
        if (now() >= (plans.get(owner)?.expiresAt ?? Infinity)) forget(owner)
        if (action === 'apply') {
          const plan = plans.get(owner)
          if (args.length !== 1 || plan === undefined || args[0] !== plan.token || now() >= plan.expiresAt) {
            return { kind: 'error', text: 'Missing, expired or mismatched preview; run preview again.' }
          }
          forget(owner) // consume before any write, including ambiguous failure
          const results = []
          for (const item of plan.sessions) {
            if (signal.aborted) { results.push({ id: item.id, failed: true, outcome: 'cancelled; remaining sessions not started' }); break }
            try {
              const result = await importSession(ctx, plan.config, item.snapshot, undefined, signal)
              results.push({ id: item.id, failed: result?.failed === true, outcome: result === undefined ? 'empty' : result.failed ? 'failed (inspect content-free plugin warning)' : `acknowledged (${result.count} stored messages)` })
            } catch { results.push({ id: item.id, failed: true, outcome: signal.aborted ? 'cancelled' : 'failed' }) }
          }
          return { kind: results.some(item => item.failed) ? 'error' : 'success', text: results.map(item => `${encodeURIComponent(item.id)}: ${item.outcome}`).join('\n') }
        }
        const records = await ctx.sessionQuery.listSessions(signal)
        signal.throwIfAborted()
        const cwd = owner.header.cwd
        const allowed = records.filter(record => record.persisted === true && eligible(record.header, cwd))
        if (action === 'list') {
          const offset = args.length === 0 ? 0 : Number(args[0])
          if (args.length > 1 || !Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) return { kind: 'error', text: USAGE }
          const page = allowed.slice(offset, offset + PAGE_SIZE)
          return { kind: 'success', text: `${page.map(record => encodeURIComponent(record.header.id)).join('\n') || 'No eligible persisted sessions in this workspace.'}\nNext offset: ${offset + page.length}; total eligible: ${allowed.length}.` }
        }
        if (action !== 'preview' || args.length < 2 || args.length > 11) return { kind: 'error', text: USAGE }
        forget(owner)
        const [spaceId, ...ids] = args.map(value => decodeURIComponent(value))
        if (spaceId.length > 1024 || ids.some(id => id.length > 1024) || new Set(ids).size !== ids.length) return { kind: 'error', text: 'Use one explicit Space ID and 1–10 distinct session IDs (max 1024 characters each).' }
        const sessions = []
        for (const id of ids) {
          signal.throwIfAborted()
          if (!allowed.some(record => record.header.id === id)) return { kind: 'error', text: 'Selection includes an unavailable, private, subagent or other-workspace session; nothing imported.' }
          try {
            const snapshot = cleanSnapshot(await ctx.sessionQuery.readSession(id), id, cwd)
            signal.throwIfAborted()
            const payload = captureSession(snapshot, { sourceApp: config.sourceApp, maxMessageChars: config.maxThreadMessageChars }).deltaFrom(-1)?.payload
            sessions.push({ id, snapshot, count: payload?.messages.length ?? 0, title: payload?.title ?? '(empty)' })
          } catch {
            return { kind: 'error', text: `Could not prepare selected session ${encodeURIComponent(id)}; nothing imported; retry a smaller or readable selection.` }
          }
        }
        const connection = await resolveConnection(signal)
        signal.throwIfAborted()
        const token = randomBytes(16).toString('hex')
        const plan = { token, sessions, expiresAt: now() + TTL, config: { ...config, spaceId, connectionEnv: connection.env } }
        plans.set(owner, plan)
        const timer = setTimeout(() => { if (plans.get(owner) === plan) plans.delete(owner); timers.delete(timer) }, TTL)
        plan.timer = timer
        timer.unref()
        timers.add(timer)
        return { kind: 'success', text: [
          `Preview only — no transcript written. Destination: ${connection.url}; exact Space ID: ${spaceId}.`,
          'Only selected persisted top-level sessions in this profile/workspace; human inputs and assistant replies, no tools/reasoning/injected context.',
          ...sessions.map(item => `${encodeURIComponent(item.id)}: ${item.count} messages; ${item.title}`),
          'Existing Threads are reconciled by native identity, never deleted, moved or cleaned. The frozen preview excludes later activity.',
          `To authorize this upload within 10 minutes: /mem-backfill apply ${token}`,
        ].join('\n') }
      } catch {
        return { kind: 'error', text: signal.aborted ? 'Backfill cancelled; no additional session started.' : 'Backfill unavailable; check host services and nmem connection, then preview again.' }
      } finally { busy.delete(owner); controllers.delete(owner); active.delete(controller); retired.resolve() }
    },
  }
}
