import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildThreadImportArgs,
  sessionThreadTitle,
} from '../src/thread-import.js'
import { hasContextBundle } from '../src/context.js'
import { flushBeforeImport } from '../src/session-flush.js'

function userEvent(seq, content, source = { kind: 'user' }) {
  return {
    type: 'user/message',
    seq,
    data: { content, source },
  }
}

function argumentValue(args, name) {
  const index = args.indexOf(name)
  return index < 0 ? undefined : args[index + 1]
}

test('keeps one session-scoped title and ignores every plugin-generated prompt', () => {
  const events = [
    userEvent(1, 'Injected context', { kind: 'plugin', plugin: 'nowledge-mem' }),
    userEvent(2, 'Other plugin context', { kind: 'plugin', plugin: 'other-plugin' }),
    userEvent(3, '\nOriginal session question\nmore detail'),
    { type: 'assistant/message', seq: 4 },
    userEvent(5, 'Later continuation prompt'),
  ]

  const title = sessionThreadTitle(
    events,
    'session-1',
    message => message.content,
    16_000,
  )

  assert.equal(title, 'Original session question')
  assert.notEqual(title, events.at(-1).data.content)

  const compactedTitle = sessionThreadTitle(
    [events.at(-1)],
    'session-1',
    message => message.content,
    16_000,
    title,
  )
  assert.equal(compactedTitle, 'Original session question')
})

test('rebuilds reconciliation arguments from the full payload', () => {
  const deltaPayload = {
    title: 'Later continuation prompt',
    messages: [{ role: 'user', content: 'Later continuation prompt' }],
  }
  const fullPayload = {
    title: 'Original session question',
    messages: [
      { role: 'user', content: 'Original session question' },
      { role: 'user', content: 'Later continuation prompt' },
    ],
  }

  const deltaArgs = buildThreadImportArgs({
    file: '/tmp/thread.json',
    sourceApp: 'deepseek-harness',
    sessionId: 'session-1',
    payload: deltaPayload,
    spaceId: 'space-1',
    agentId: 'agent-1',
    expectedMessageCount: 3,
  })
  const reconciliationArgs = buildThreadImportArgs({
    file: '/tmp/thread.json',
    sourceApp: 'deepseek-harness',
    sessionId: 'session-1',
    payload: fullPayload,
    spaceId: 'space-1',
    agentId: 'agent-1',
  })

  assert.equal(argumentValue(deltaArgs, '--title'), deltaPayload.title)
  assert.equal(argumentValue(deltaArgs, '--expected-message-count'), '3')
  assert.match(argumentValue(deltaArgs, '--idempotency-key'), /^deepseek-harness:session-1:3-4:/u)
  assert.equal(argumentValue(reconciliationArgs, '--title'), fullPayload.title)
  assert.equal(argumentValue(reconciliationArgs, '--expected-message-count'), undefined)
  assert.equal(argumentValue(reconciliationArgs, '--idempotency-key'), undefined)
  assert.equal(argumentValue(reconciliationArgs, '--space-id'), 'space-1')
  assert.equal(argumentValue(reconciliationArgs, '--agent-id'), 'agent-1')
})

test('checks the model-visible session projection after compaction', () => {
  const contextMessage = {
    source: { kind: 'plugin', plugin: 'nowledge-mem', form: 'snapshot' },
  }

  assert.equal(hasContextBundle({ deriveMessages: () => [contextMessage] }), true)
  assert.equal(hasContextBundle({ deriveMessages: () => [] }), false)
})

test('flushes DSH write-behind persistence before import and fails open', async () => {
  const calls = []
  const session = {}
  const ctx = { sessions: { flush: async value => calls.push(value) } }

  assert.equal(await flushBeforeImport(ctx, session, () => assert.fail('unexpected flush error')), true)
  assert.deepEqual(calls, [session])

  const error = new Error('storage unavailable')
  const reported = []
  const failingCtx = { sessions: { flush: async () => { throw error } } }
  assert.equal(await flushBeforeImport(failingCtx, session, value => reported.push(value)), false)
  assert.deepEqual(reported, [error])
})
