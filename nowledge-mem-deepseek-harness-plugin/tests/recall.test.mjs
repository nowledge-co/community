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

test('English trigger keywords match whole words, not parts of other words', () => {
  for (const prompt of [
    'post the meme in the group chat',
    'welcome the new member',
    'draft a memo for the team',
    'run memcheck on the build',
    'bump the priority of this bug',
  ]) {
    assert.equal(shouldRecallForPrompt(prompt, DEFAULT_PATTERN), false, prompt)
  }
})

test('English trigger keywords still match their plural and verb forms', () => {
  for (const prompt of [
    'do you remember the fix?',
    'I remembered something about this',
    'search my memories',
    'what does Mem know about the parser?',
    'ask nowledge-mem first',
    'what were the decisions last week?',
    'list the plugins we tried',
    'previously we used a queue',
    'the regressions after the upgrade',
    'which threads mention the connector?',
    'it was released yesterday',
    'nothing recalled yet?',
  ]) {
    assert.equal(shouldRecallForPrompt(prompt, DEFAULT_PATTERN), true, prompt)
  }
})

test('Chinese trigger keywords match anywhere, next to English or Chinese text', () => {
  for (const prompt of ['我们之前怎么定的', '看看这个插件的历史', '查一下mem里有没有', '用Mem记一下']) {
    assert.equal(shouldRecallForPrompt(prompt, DEFAULT_PATTERN), true, prompt)
  }
  assert.equal(shouldRecallForPrompt('帮我算一下二加二', DEFAULT_PATTERN), false)
})
