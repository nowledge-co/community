import assert from 'node:assert/strict'
import test from 'node:test'

import { hasContextBundle } from '../src/context.js'
import { flushBeforeImport } from '../src/session-flush.js'

test('checks the model-visible session projection after compaction', () => {
  const contextMessage = {
    source: { kind: 'plugin', plugin: 'nowledge-mem', form: 'snapshot' },
  }

  assert.equal(hasContextBundle({ deriveMessages: () => [contextMessage] }), true)
  assert.equal(hasContextBundle({ deriveMessages: () => [] }), false)
})

test('recognizes a migrated v4 context snapshot without confusing other producers or recall', () => {
  const session = source => ({ deriveMessages: () => [{ source }] })

  assert.equal(hasContextBundle(session({ kind: 'plugin:nowledge-mem', form: 'snapshot' })), true)
  assert.equal(hasContextBundle(session({ kind: 'plugin:nowledge-mem', form: 'recall' })), false)
  assert.equal(hasContextBundle(session({ kind: 'plugin:other-plugin', form: 'snapshot' })), false)
  assert.equal(hasContextBundle(session({ kind: 'runtime-context', form: 'snapshot' })), false)
  assert.equal(hasContextBundle(session({ kind: 'plugin:custom-mem', form: 'snapshot' }), 'custom-mem'), true)
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
