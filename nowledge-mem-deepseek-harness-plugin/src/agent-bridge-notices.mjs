// Local-only notice consumption. A host session identifier is correlation, not authority.
import { existsSync, readSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { windowsCommandLine, windowsComspec } from './bridge-windows-command.mjs'

export function validBridgeSession(session) {
  return typeof session === 'string' && session.trim() !== '' && session !== 'unknown'
    && Buffer.byteLength(session, 'utf8') <= 1024 && !Array.from(session).some(c => c.codePointAt(0) < 32 || (c.codePointAt(0) >= 127 && c.codePointAt(0) <= 159) || (c.codePointAt(0) >= 0xd800 && c.codePointAt(0) <= 0xdfff))
}

export function bridgeSessionHint(host, session) {
  if (!host || !validBridgeSession(session)) return ''
  return 'Host session correlation (not identity or delivery readiness): ' + JSON.stringify({host, session_id: session})
    + '. Only when the user separately requests ongoing Agent-mailbox notifications across authorized Spaces, verify the existing approved Agent Context and subscribe this actual session using nmem --json --agent-context=<approved-context> bridge notices subscribe'
    + ' --host=' + host + ' and the literal --session-id value above. This opts this session into shared Agent-mailbox hints; it does not enable native sessions or precise reply routing.'
    + ' The startup one-page inbox opt-in alone does not authorize this subscription. If the installed CLI rejects the command, keep the original identity and use the existing inbox check. Never invent a replacement session.'
}

export function bridgeNoticeHint(host, session, env = process.env, run = execFileSync, event = 'turn') {
  if (!host || !validBridgeSession(session)
      || !['', '0', 'false'].includes((env.NMEM_NO_MAILBOX_NOTICE || '').trim().toLowerCase())) return ''
  try {
    const output = runLocalBridge(['--json', ...noticeArgs(host, session, env), ...(event === 'tool' ? ['--event=tool'] : [])], env, run)
    return renderNotices(output)
  } catch { return '' }
}

function noticeArgs(host, session, env) {
  const context = env.NMEM_AGENT_CONTEXT?.trim()
  return [...(context ? ['--agent-context=' + context] : []), 'bridge', 'notices', 'check', '--host=' + host, '--session-id=' + session]
}

function renderNotices(output) {
  const value = JSON.parse(output)
  if (!Array.isArray(value.notices) || value.notices.length > 4) return ''
  return value.notices.filter(n => typeof n.hint === 'string' && Array.isArray(n.args)
    && n.args.length <= 16 && n.args.every(a => typeof a === 'string'))
    .map(n => n.hint + ' Argument vector: ' + JSON.stringify(n.args)).join('\n')
}

// Reuse a host's existing CLI launcher, including its Windows shim contract.
export async function bridgeNoticeWithRunner(host, session, run, env = process.env) {
  if (!host || !validBridgeSession(session)
      || !['', '0', 'false'].includes((env.NMEM_NO_MAILBOX_NOTICE || '').trim().toLowerCase())) return ''
  try {
    const result = await run(noticeArgs(host, session, env), 500)
    return result.ok && result.stdout.length <= 65536 ? renderNotices(result.stdout) : ''
  } catch { return '' }
}

export async function closeBridgeSession(host, session, run) {
  if (!host || !validBridgeSession(session)) return
  try { await run(['bridge', 'notices', 'unsubscribe', '--host=' + host, '--session-id=' + session, '--ended'], 500) }
  catch { /* Local cleanup is best effort; never replace or close another session. */ }
}

export function runLocalBridge(args, env = process.env, run = execFileSync) {
  const executable = env.NMEM_CLI_PATH || (process.platform === 'win32' ? 'nmem.cmd' : 'nmem')
  const options = {env, encoding: 'utf8', timeout: 500, maxBuffer: 65536,
    windowsHide: true, stdio: ['ignore', 'pipe', 'ignore']}
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable)
    ? run(windowsComspec(env), ['/d', '/s', '/c', `"${windowsCommandLine([executable, ...args])}"`], {...options, windowsVerbatimArguments: true})
    : run(executable, args, options)
}

export function closeLocalBridgeSession(host, session, env = process.env) {
  if (!host || !validBridgeSession(session)) return
  try { runLocalBridge(['--json', 'bridge', 'notices', 'unsubscribe', '--host=' + host, '--session-id=' + session, '--ended'], env) }
  catch { /* Cleanup cannot grant mailbox authority or terminate another host. */ }
}

export function readBridgeHookInput() {
  const bytes = Buffer.alloc(256 * 1024 + 1)
  let size = 0
  try {
    while (size < bytes.length) {
      const count = readSync(0, bytes, size, bytes.length - size, null)
      if (!count) break
      size += count
    }
    if (size === bytes.length) return {}
    const input = JSON.parse(bytes.subarray(0, size).toString('utf8'))
    return input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  } catch { return {} }
}

export function hasBridgeNoticeCache(env = process.env) {
  return existsSync(join(env.NMEM_CLI_CONFIG_DIR || join(homedir(), '.nowledge-mem'), 'bridge-notices-v1', 'enabled'))
}
