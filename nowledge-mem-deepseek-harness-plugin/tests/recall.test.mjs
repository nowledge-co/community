import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldRecallForPrompt } from '../src/recall.js'

// Mirrors the default trigger closely enough to exercise content-bearing and
// continuation-only prompts without importing the DSH runtime dependencies.
const PATTERN = /continue|remember|memory|decision|继续|记忆|决策/iu

test('a bare continuation prompt does not trigger recall', () => {
  for (const prompt of [
    '继续',
    '繼續',
    '接着',
    'continue',
    'go on',
    'keep going',
    'carry on',
    '  继续!  ',
    'Continue.',
    '“continue”',
    '(继续)',
    'continue:',
  ]) {
    assert.equal(shouldRecallForPrompt(prompt, PATTERN), false, prompt)
  }
})

test('a continuation word inside a substantive prompt still triggers recall', () => {
  assert.equal(shouldRecallForPrompt('继续讨论上次的方案', PATTERN), true)
  assert.equal(shouldRecallForPrompt('continue implementing the retry logic', PATTERN), true)
})

test('a content-bearing keyword unrelated to continuation still triggers recall', () => {
  assert.equal(shouldRecallForPrompt('what was the decision about the release?', PATTERN), true)
  assert.equal(shouldRecallForPrompt('上次的决策是什么', PATTERN), true)
})

test('empty or whitespace-only prompts do not trigger recall', () => {
  assert.equal(shouldRecallForPrompt('', PATTERN), false)
  assert.equal(shouldRecallForPrompt('   ', PATTERN), false)
})

test('a prompt matching no trigger keyword does not trigger recall', () => {
  assert.equal(shouldRecallForPrompt('fix the off-by-one in the paginator', PATTERN), false)
})
