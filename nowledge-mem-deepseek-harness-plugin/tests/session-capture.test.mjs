import assert from 'node:assert/strict'
import test from 'node:test'

import { captureSession } from '../src/session-capture.js'

function message(id, text, source = { kind: 'user' }) {
  return { id, source, content: [{ type: 'text', text }] }
}

function renderMessage(value) {
  return value.content.map(block => block.text ?? '').join('\n')
}

function sessionWith(events, current = true) {
  const session = {
    header: {
      id: 'session-1',
      cwd: '/workspace',
      parentSession: undefined,
      origin: 'web',
      agentPreset: 'default',
    },
  }
  if (current) session.snapshotEvents = () => events
  else session.events = events
  return session
}

const events = [
  {
    type: 'user/message',
    seq: 1,
    time: 1_800_000_000_000,
    data: message('user-1', 'Original question'),
  },
  {
    type: 'assistant/message',
    seq: 2,
    time: 1_800_000_001_000,
    data: {
      turn: 1,
      step: 1,
      message: message('assistant-1', 'First answer', {
        kind: 'assistant',
        provider: 'deepseek',
        model: 'deepseek-chat',
      }),
    },
  },
  {
    type: 'user/message',
    seq: 3,
    time: 1_800_000_002_000,
    data: message('user-2', 'Follow-up'),
  },
]

function capture(session, establishedTitle) {
  return captureSession(session, {
    sourceApp: 'deepseek-harness',
    pluginName: 'nowledge-mem',
    renderMessage,
    maxMessageChars: 16_000,
    establishedTitle,
  })
}

for (const [contract, current] of [['snapshotEvents', true], ['legacy events', false]]) {
  test(`${contract} captures the same ordered message payload`, () => {
    const result = capture(sessionWith(events, current)).deltaFrom(-1)
    assert.equal(result.payload.title, 'Original question')
    assert.deepEqual(result.payload.messages.map(value => [value.role, value.content]), [
      ['user', 'Original question'],
      ['assistant', 'First answer'],
      ['user', 'Follow-up'],
    ])
    assert.deepEqual(
      result.payload.messages.map(value => value.metadata.external_id),
      [
        'deepseek-harness:session-1:1:user-1',
        'deepseek-harness:session-1:2:assistant-1',
        'deepseek-harness:session-1:3:user-2',
      ],
    )
  })
}

test('delta, conflict reconciliation, and compaction reuse one current snapshot', () => {
  let calls = 0
  const session = sessionWith(events)
  session.snapshotEvents = () => {
    calls += 1
    return events
  }
  const attempt = capture(session, 'Original question')

  assert.deepEqual(attempt.deltaFrom(2).payload.messages.map(value => value.content), ['Follow-up'])
  assert.deepEqual(
    attempt.deltaFrom(-1).payload.messages.map(value => value.content),
    ['Original question', 'First answer', 'Follow-up'],
  )
  assert.equal(calls, 1)

  const compacted = capture(sessionWith([events[2]]), attempt.title)
  assert.equal(compacted.deltaFrom(2).reset, true)
  assert.equal(compacted.deltaFrom(2).payload.title, 'Original question')
})
