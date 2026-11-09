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

// https://github.com/nowledge-co/mem/issues/9940: recall carries the source-conversation date.
test('recall text dates each memory by event or source conversation, not import time', async () => {
  const { renderRecallText: render } = await import('../src/index.js')
  const text = render('软考哪天考', {
    memories: [
      { title: '软考', content: '中项已考完', date: '2026-10-24' },
    ],
  }, 8000)
  assert.match(text, /date=2026-10-24/)
  assert.match(text, /Today is \d{4}-\d{2}-\d{2}/)
})
