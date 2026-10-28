import assert from 'node:assert/strict'
import test from 'node:test'

import { captureSession } from '../src/session-capture.js'

function message(id, text, source = { kind: 'user' }) {
  return { id, source, content: [{ type: 'text', text }] }
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

test('skips all producer context rather than treating user-role context as human input', () => {
  const sources = [
    { kind: 'plugin', plugin: 'nowledge-mem', form: 'snapshot' },
    { kind: 'plugin', plugin: 'nowledge-mem', form: 'recall' },
    { kind: 'plugin:nowledge-mem', form: 'snapshot' },
    { kind: 'plugin:nowledge-mem', form: 'recall' },
    { kind: 'plugin', plugin: 'other-plugin', form: 'snapshot' },
    { kind: 'plugin:other-plugin', form: 'recall' },
    { kind: 'runtime', form: 'snapshot' },
    { kind: 'clock', form: 'notice' },
    { kind: 'skills', form: 'catalog' },
    { kind: 'user' },
  ]
  const injectedEvents = sources.map((source, seq) => ({
    type: 'user/message',
    seq,
    time: 1_800_000_000_000 + seq,
    data: message(`message-${seq}`, source.kind === 'user' ? 'Original question' : `Context ${seq}`, source),
  }))
  const result = capture(sessionWith(injectedEvents)).deltaFrom(-1)

  assert.equal(result.payload.title, 'Original question')
  assert.deepEqual(result.payload.messages.map(value => value.content), ['Original question'])
  assert.equal(result.acknowledgedSeq, 9)
})

test('eight conversational rounds do not become 523 tool/context messages', () => {
  const rows = []
  const push = (type, data) => rows.push({ type, data, seq: rows.length, time: 1_800_000_000_000 + rows.length })
  for (let i = 0; i < 13; i += 1) {
    push('user/message', message(`context-${i}`, `Context ${i}`, { kind: `plugin:context-${i}` }))
  }
  for (let turn = 0; turn < 8; turn += 1) {
    push('user/message', message(`user-${turn}`, `Question ${turn}`))
    const steps = turn === 0 ? 31 : 26
    const results = turn === 0 ? 36 : 35
    for (let step = 0; step < steps; step += 1) {
      push('assistant/message', { turn, step, message: {
        ...message(`call-${turn}-${step}`, 'Internal tool-step narration', { kind: 'model' }),
        content: [{ type: 'text', text: 'Internal tool-step narration' }, { type: 'tool-call', id: `call-${turn}-${step}`, name: 'shell', arguments: '{}' }],
      } })
    }
    for (let result = 0; result < results; result += 1) {
      push('tool/result', { turn, message: message(`result-${turn}-${result}`, 'Raw tool output', { kind: 'tool' }) })
    }
    push('assistant/message', { turn, step: steps, message: {
      ...message(`answer-${turn}`, `Answer ${turn}`, { kind: 'model' }),
      content: [{ type: 'reasoning', text: 'Private reasoning' }, { type: 'text', text: `Answer ${turn}` }],
    } })
  }
  assert.equal(rows.length, 523)
  const result = capture(sessionWith(rows)).deltaFrom(-1)
  assert.equal(result.payload.title, 'Question 0')
  assert.equal(result.payload.messages.length, 16)
  assert.deepEqual(result.payload.messages.map(value => value.content),
    Array.from({ length: 8 }, (_, turn) => [`Question ${turn}`, `Answer ${turn}`]).flat())
  assert.equal(result.acknowledgedSeq, 522)
  assert.equal(capture(sessionWith(rows)).deltaFrom(522), undefined)
})

test('filtered suffixes preserve raw sequence anchors and stable message identity', () => {
  const rows = [...events.slice(0, 2), {
    type: 'tool/result', seq: 3, time: 1_800_000_002_000,
    data: { message: message('tool-1', 'Tool output', { kind: 'tool' }) },
  }]
  const first = capture(sessionWith(rows)).deltaFrom(-1)
  assert.equal(first.acknowledgedSeq, 3)
  assert.equal(first.payload.messages.length, 2)
  assert.equal(capture(sessionWith(rows)).deltaFrom(3), undefined)
  rows.push({ ...events[2], seq: 4 })
  const suffix = capture(sessionWith(rows), first.payload.title).deltaFrom(3)
  assert.equal(suffix.reset, false)
  assert.equal(suffix.payload.title, first.payload.title)
  assert.deepEqual(suffix.payload.messages.map(value => value.metadata.external_id), ['deepseek-harness:session-1:4:user-2'])
  const replay = capture(sessionWith(rows)).deltaFrom(-1)
  assert.deepEqual(replay.payload.messages.slice(0, 2), first.payload.messages)
})

test('omits reasoning-only, unknown producer and tool-only messages without content heuristics', () => {
  const rows = [
    { type: 'user/message', seq: 0, time: 1_800_000_000_000, data: message('context', 'Instructions', { kind: 'unknown-context' }) },
    { type: 'assistant/message', seq: 1, time: 1_800_000_001_000, data: { message: {
      ...message('thinking', '', { kind: 'model' }), content: [{ type: 'reasoning', text: 'Hidden' }],
    } } },
  ]
  assert.equal(capture(sessionWith(rows)).deltaFrom(-1), undefined)
  rows.push({ type: 'user/message', seq: 2, time: 1_800_000_002_000,
    data: message('real', 'Explain <system-reminder> and tool calls') })
  const result = capture(sessionWith(rows)).deltaFrom(-1)
  assert.equal(result.payload.title, 'Explain <system-reminder> and tool calls')
  assert.equal(result.payload.messages[0].content, result.payload.title)
})
