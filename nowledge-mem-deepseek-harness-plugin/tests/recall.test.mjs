import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_PROMPT_RECALL_PATTERN, shouldRecallForPrompt } from '../src/recall.js'

const DEFAULT_PATTERN = new RegExp(DEFAULT_PROMPT_RECALL_PATTERN, 'iu')
const ALL_CONTINUATIONS_PATTERN = /continue|go on|keep going|carry on|继续|接着|繼續/iu

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
    assert.equal(shouldRecallForPrompt(prompt, ALL_CONTINUATIONS_PATTERN), false, prompt)
  }
})

test('the production trigger rejects its continuation-only matches', () => {
  for (const prompt of ['continue', 'Continue.', '继续', '“继续”']) {
    assert.equal(shouldRecallForPrompt(prompt, DEFAULT_PATTERN), false, prompt)
  }
})

test('a continuation word inside a substantive prompt still triggers recall', () => {
  assert.equal(shouldRecallForPrompt('继续讨论上次的方案', DEFAULT_PATTERN), true)
  assert.equal(shouldRecallForPrompt('continue implementing the retry logic', DEFAULT_PATTERN), true)
})

test('a content-bearing keyword unrelated to continuation still triggers recall', () => {
  assert.equal(shouldRecallForPrompt('what was the decision about the release?', DEFAULT_PATTERN), true)
  assert.equal(shouldRecallForPrompt('上次的决策是什么', DEFAULT_PATTERN), true)
})

test('empty or whitespace-only prompts do not trigger recall', () => {
  assert.equal(shouldRecallForPrompt('', DEFAULT_PATTERN), false)
  assert.equal(shouldRecallForPrompt('   ', DEFAULT_PATTERN), false)
})

test('a prompt matching no trigger keyword does not trigger recall', () => {
  assert.equal(shouldRecallForPrompt('fix the off-by-one in the paginator', DEFAULT_PATTERN), false)
})
