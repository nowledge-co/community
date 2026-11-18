/**
 * Prompt-time recall trigger. Pulled out of index.js because it has no
 * dependency on the DSH SDK, unlike everything else in that file -- keeping
 * it dependency-free lets it be unit tested without the DSH peer packages.
 */

// The trigger pattern list mixes two different things: content-bearing
// keywords (memory, decision, connector, ...) and bare continuation fillers
// (continue, 继续, ...). The prompt that triggers recall is ALSO the literal
// search query sent to `nmem m search` -- a prompt that is nothing but
// "继续"/"continue" (e.g. resuming after a quota error or any other
// interruption) matches the trigger but is a near-content-free query, so the
// search surfaces whatever happens to score highest globally instead of
// anything related to the interrupted turn. Exclude that case explicitly
// rather than trying to make an empty query search well.
const CONTINUATION_ONLY_PATTERN = /^[\s\p{P}]*(?:continue|go on|keep going|carry on|继续|接着|繼續)[\s\p{P}]*$/iu

// English keywords are whole words, with the plural and verb forms a prompt
// would use: as bare substrings, `mem` fired on "meme", "member" and "memo",
// and `prior` on "priority". Chinese has no spaces between words, so Chinese
// keywords stay substrings.
const ENGLISH_PROMPT_RECALL_WORDS = [
  'remember(?:s|ed|ing)?',
  'memor(?:y|ies)',
  'mem',
  'nowledge',
  'contexts?',
  'previous(?:ly)?',
  'prior',
  'histor(?:y|ies)',
  'continue[sd]?',
  'recall(?:s|ed|ing)?',
  'decisions?',
  'release[sd]?',
  'regressions?',
  'connectors?',
  'plugins?',
  'threads?',
]

const CHINESE_PROMPT_RECALL_WORDS = [
  '记忆',
  '上下文',
  '继续',
  '之前',
  '历史',
  '决策',
  '发布',
  '回归',
  '插件',
  '连接器',
]

export const DEFAULT_PROMPT_RECALL_PATTERN = [
  String.raw`\b(?:${ENGLISH_PROMPT_RECALL_WORDS.join('|')})\b`,
  ...CHINESE_PROMPT_RECALL_WORDS,
].join('|')

export function shouldRecallForPrompt(prompt, pattern) {
  const trimmed = prompt.trim()
  if (trimmed === '' || CONTINUATION_ONLY_PATTERN.test(trimmed)) return false
  pattern.lastIndex = 0
  return pattern.test(trimmed)
}
