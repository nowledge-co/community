import { createHash } from 'node:crypto'

export function boundText(text, maxChars) {
  if (text.length <= maxChars) return text
  if (maxChars <= 1) return text.slice(0, Math.max(0, maxChars))
  return `${text.slice(0, maxChars - 1)}...`
}

export function sessionThreadTitle(
  events,
  sessionId,
  pluginName,
  renderMessage,
  maxMessageChars,
  establishedTitle,
) {
  if (typeof establishedTitle === 'string' && establishedTitle !== '') return establishedTitle
  for (const event of events) {
    if (event.type !== 'user/message') continue
    const message = event.data
    if (message?.source?.kind === 'plugin' && message.source.plugin === pluginName) continue
    const content = boundText(renderMessage(message).trim(), maxMessageChars)
    const firstLine = content.split(/\r?\n/u).find(line => line.trim() !== '')?.trim()
    if (firstLine !== undefined) return boundText(firstLine, 80)
  }
  return `DeepSeek Harness ${sessionId}`
}

export function stableThreadId(sessionId) {
  const safe = sessionId.replace(/[^A-Za-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '')
  return `deepseek-harness-${safe === '' ? 'session' : safe}`
}

export function buildThreadImportArgs({
  file,
  sourceApp,
  sessionId,
  payload,
  spaceId,
  agentId,
  expectedMessageCount,
}) {
  const args = [
    '--json',
    't',
    'import',
    '--file',
    file,
    '--source',
    sourceApp,
    '--id',
    stableThreadId(sessionId),
    '--title',
    payload.title,
  ]
  if (spaceId !== undefined) args.push('--space-id', spaceId)
  if (agentId !== undefined) args.push('--agent-id', agentId)
  if (expectedMessageCount === undefined) return args

  const batchFingerprint = createHash('sha256')
    .update(JSON.stringify(payload.messages))
    .digest('hex')
  args.push('--expected-message-count', String(expectedMessageCount))
  args.push(
    '--idempotency-key',
    `deepseek-harness:${sessionId}:${expectedMessageCount}-${expectedMessageCount + payload.messages.length}:${batchFingerprint}`,
  )
  return args
}
