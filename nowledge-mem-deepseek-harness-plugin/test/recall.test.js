import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldRecallForPrompt } from '../src/recall.js'

// Mirrors the trigger keywords in DEFAULT_PROMPT_RECALL_PATTERN closely enough
// to exercise both the content-bearing and bare-continuation-filler cases.
const PATTERN = /continue|remember|memory|decision|继续|记忆|决策/iu

// Regression for a resumed-after-interruption prompt (e.g. after a quota
// error) that is nothing but a bare "继续"/"continue": it must not trigger a
// memory search, because the prompt IS the search query, and a query with no
// content beyond the trigger word itself surfaces unrelated memories instead
// of anything about the interrupted turn.
test('a bare continuation prompt does not trigger recall', () => {
  assert.equal(shouldRecallForPrompt('继续', PATTERN), false)
  assert.equal(shouldRecallForPrompt('continue', PATTERN), false)
  assert.equal(shouldRecallForPrompt('  继续!  ', PATTERN), false)
  assert.equal(shouldRecallForPrompt('Continue.', PATTERN), false)
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
