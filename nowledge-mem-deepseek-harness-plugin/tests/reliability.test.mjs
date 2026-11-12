import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, blocksToText, buildThreadImportPayload, importSession } from '../src/index.js'
import { readFile, access, stat } from 'node:fs/promises'
import { importResultAcknowledgement } from '../src/session-delta.js'
import { createSyncQueue } from '../src/sync-queue.js'
import { stableThreadId } from '../src/thread-import.js'

const user = text => ({ id: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] })
const assistant = { id: 'reply', source: { provider: 'test', model: 'test' }, content: [{ type: 'text', text: 'reply' }] }
const event = (seq, type, data, time = 0) => ({ seq, type, data, time })
const session = events => ({ header: { id: 'qa-session', cwd: '/synthetic' }, events, deriveMessages: () => [] })

test('malformed events cannot poison later valid conversation rows', () => {
  const events = [null, event(0, 'assistant/message', undefined), event(1, 'assistant/message', { message: { content: 'plain reply' } }), event(2, 'user/message', user('bad time'), 'invalid'), event(3, 'user/message', user('later good')), event(4, 'assistant/message', { message: assistant })]
  const payload = buildThreadImportPayload(session(events), 1000)
  assert.ok(payload.messages.some(message => message.content === 'later good'))
  assert.ok(payload.messages.some(message => message.content === 'reply'))
})

test('malformed blocks and missing tool content are harmless', () => {
  assert.equal(blocksToText(undefined), '')
  assert.doesNotThrow(() => blocksToText([null, { type: 'tool-result' }]))
})

test('opaque session identifiers do not collapse while safe historical IDs remain stable', () => {
  for (const [left, right] of [['a b', 'a-b'], ['x/y', 'x-y'], ['session#1', 'session-1'], ['---', '']]) {
    assert.notEqual(stableThreadId(left), stableThreadId(right))
  }
  assert.equal(stableThreadId('session-1'), 'deepseek-harness-session-1')
})

function host(config = {}, result = { exitCode: 1, signal: null, stdout: { text: '' } }) {
  const listeners = new Map(), requests = [], warnings = []
  const ctx = {
    on: (name, listener) => listeners.set(name, listener),
    logger: { warn: message => warnings.push(message) },
    shell: { resolve: value => value, execute: async value => { requests.push(value); return { result: async () => result } } },
  }
  apply(ctx, { syncOnTurnEnd: false, recallOnPrompt: false, ...config })
  const current = session([])
  return { requests, warnings, step: decision => listeners.get('agent/pre-step')({ agent: { session: current }, signal: new AbortController().signal }, async () => decision) }
}

test('invalid optional recall pattern does not disable context and capture registration', () => {
  assert.doesNotThrow(() => host({ promptRecallPattern: '[' }))
})

test('context failure backs off per session and reports a content-free diagnostic', async () => {
  const probe = host()
  for (let i = 0; i < 5; i++) await probe.step({ kind: 'enter', messages: [] })
  assert.equal(probe.requests.length, 1)
  assert.equal(probe.warnings.length, 1)
})

test('cancelled pre-step does not back off a healthy context load on the next turn', async () => {
  const listeners = new Map(), controller = new AbortController()
  let calls = 0
  const ctx = {
    on: (name, listener) => listeners.set(name, listener),
    shell: { resolve: r => r, execute: async () => ({ result: async () => {
      calls++
      if (calls === 1) { controller.abort(); return { exitCode: 0, aborted: true, stdout: { text: '' } } }
      return { exitCode: 0, stdout: { text: '{"context":"synthetic"}' } }
    } }) },
  }
  apply(ctx, { recallOnPrompt: false, syncOnTurnEnd: false })
  const current = session([]), decision = { kind: 'enter', messages: [] }
  const step = signal => listeners.get('agent/pre-step')({ agent: { session: current }, signal }, async () => decision)
  assert.equal(await step(controller.signal), decision)
  const next = await step(new AbortController().signal)
  assert.equal(calls, 2)
  assert.equal(next.messages.length, 1)
})

test('injection preserves host decision metadata', async () => {
  const probe = host({}, { exitCode: 0, signal: null, stdout: { text: '{"context":"synthetic"}' } })
  const decision = await probe.step({ kind: 'enter', startsRequestSeries: true, messages: [] })
  assert.equal(decision.startsRequestSeries, true)
})

test('nmem credential is explicitly forwarded across the host credential scrub', async () => {
  const previous = process.env.NMEM_API_KEY
  process.env.NMEM_API_KEY = 'synthetic-nmem-only-key'
  try {
    const probe = host()
    await probe.step({ kind: 'enter', messages: [] })
    assert.equal(probe.requests[0].env.NMEM_API_KEY, 'synthetic-nmem-only-key')
    assert.equal(Object.hasOwn(probe.requests[0].env, 'AZURE_OPENAI_API_KEY'), false)
    assert.doesNotMatch(probe.requests[0].command, /synthetic-nmem-only-key/u)
  } finally {
    if (previous === undefined) delete process.env.NMEM_API_KEY
    else process.env.NMEM_API_KEY = previous
  }
})

test('pinned connection key and explicit empty auth override the ambient key', async () => {
  const previous = process.env.NMEM_API_KEY
  process.env.NMEM_API_KEY = 'synthetic-ambient-key'
  try {
    for (const key of ['synthetic-pinned-key', '']) {
      const ctx = { shell: { resolve: request => request, execute: async request => {
        assert.equal(request.env.NMEM_API_KEY, key)
        return { result: async () => ({ exitCode: 0, stdout: { text: '{"success":true,"results":[{"success":true,"message_count":1}]}' } }) }
      } } }
      const current = session([event(0, 'user/message', user('Synthetic pinned-auth question'))])
      const result = await importSession(ctx, { ...importConfig, connectionEnv: { NMEM_API_KEY: key } }, current)
      assert.equal(result.count, 1)
    }
  } finally {
    if (previous === undefined) delete process.env.NMEM_API_KEY
    else process.env.NMEM_API_KEY = previous
  }
})

test('recall treats flag-like human input as one positional query', async () => {
  const probe = host({ contextOnSessionStart: false, recallOnPrompt: true })
  await probe.step({ kind: 'enter', messages: [user('-memory')] })
  assert.match(probe.requests[0].command, /m search -n 8 -- -memory$/u)
})

test('process and semantic failures have content-free reasons', () => {
  const result = { exitCode: 0, stdout: { text: '{"success":false,"error":"private transcript"}' } }
  for (const [overrides, reason] of [
    [{ timedOut: true }, 'timeout'], [{ aborted: true }, 'aborted'],
    [{ signal: 'SIGTERM' }, 'signal'], [{ exitCode: 1 }, 'nonzero-exit'],
    [{ stdout: { text: 'private transcript' } }, 'invalid-json'], [{}, 'rejected'],
  ]) {
    assert.deepEqual(importResultAcknowledgement({ ...result, ...overrides }, false), { status: 'failed', reason })
  }
})

const importConfig = { cliPath: 'nmem', sourceApp: 'deepseek-harness', importOrigin: 'deepseek-harness', maxThreadMessageChars: 1000 }
const conflict = { exitCode: 1, stdout: { text: JSON.stringify({ results: [{ error_code: 'checkpoint_conflict' }] }) } }

test('initial FULL conflict is diagnosed without destructive or identical immediate retry', async () => {
  const requests = [], warnings = [], files = []
  const ctx = {
    logger: { warn: message => warnings.push(message) },
    shell: { resolve: request => request, execute: async request => {
      requests.push(request)
      const file = request.command.match(/--file (?:'([^']+)'|(\S+))/u)
      files.push(file[1] ?? file[2])
      assert.ok(files.at(-1).startsWith(process.env.DSH_HOME))
      if (process.platform !== 'win32') assert.equal((await stat(files.at(-1))).mode & 0o777, 0o600)
      const payload = JSON.parse(await readFile(files.at(-1), 'utf8'))
      assert.equal(payload.messages[0].content, 'synthetic input')
      assert.match(request.command, /--title=-synthetic/u)
      return { result: async () => conflict }
    } },
  }
  const current = session([event(0, 'user/message', user('synthetic input'))])
  const result = await importSession(ctx, importConfig, current, { seq: -1, count: 0, title: '-synthetic' })
  // With a cursor, one checkpointed attempt may reconcile once to FULL.
  assert.equal(requests.length, 2)
  assert.equal(result.failed, true)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /full-reconciliation-conflict/u)
  for (const file of files) await assert.rejects(access(file))
  requests.length = 0
  await importSession(ctx, importConfig, current)
  assert.equal(requests.length, 1)
})

test('queued turn-end failures back off rather than FULL-send on every notification', async () => {
  const requests = [], warnings = []
  const ctx = {
    logger: { warn: message => warnings.push(message) },
    shell: { resolve: request => request, execute: async request => { requests.push(request); return { result: async () => conflict } } },
  }
  let now = 0
  const enqueue = createSyncQueue((current, cursor) => importSession(ctx, importConfig, current, cursor), () => assert.fail('unexpected exception'), () => now)
  const current = session([event(0, 'user/message', user('synthetic input'))])
  await Promise.all(Array.from({ length: 5 }, () => enqueue(current)))
  assert.match(warnings[0], /full-reconciliation-conflict/u)
  assert.equal(requests.length, 1)
  now = 1000
  await enqueue(current)
  assert.equal(requests.length, 2)
  now = 2000
  await enqueue(current)
  assert.equal(requests.length, 2)
})

test('plugin teardown drains already queued turn capture before returning', async () => {
  const listeners = new Map(), disposers = [], entered = Promise.withResolvers(), flush = Promise.withResolvers()
  let imports = 0
  const ctx = {
    on: (name, listener) => listeners.set(name, listener),
    effect: setup => disposers.push(setup()),
    sessions: { flush: async () => { entered.resolve(); await flush.promise } },
    shell: { resolve: request => request, execute: async () => {
      imports++
      return { result: async () => ({ exitCode: 0, stdout: { text: '{"success":true,"results":[{"success":true,"message_count":1}]}' } }) }
    } },
  }
  apply(ctx, { contextOnSessionStart: false, recallOnPrompt: false })
  const current = session([event(0, 'user/message', user('Synthetic shutdown question'))])
  listeners.get('session/event')(current, { type: 'turn/end' })
  await entered.promise
  const disposing = Promise.all(disposers.map(dispose => dispose()))
  flush.resolve()
  await disposing
  assert.equal(imports, 1)
})
