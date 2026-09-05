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
