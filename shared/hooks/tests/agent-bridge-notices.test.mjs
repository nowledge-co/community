import test from 'node:test'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { bridgeNoticeHint, bridgeSessionHint, validBridgeSession, bridgeNoticeWithRunner, closeBridgeSession } from '../agent-bridge-notices.mjs'

test('opaque host session stays one argument and check is local-only', () => {
  let calls = 0
  const session = 'session; echo "wrong"'
  const hint = bridgeNoticeHint('pi', session, {NMEM_CLI_PATH: '/fixture/nmem'}, (executable, args, options) => {
    calls++
    assert.equal(executable, '/fixture/nmem')
    assert.deepEqual(args, ['--json', 'bridge', 'notices', 'check', '--host=pi', '--session-id=' + session])
    assert.equal(options.shell, undefined)
    assert.equal(options.maxBuffer, 65536)
    return JSON.stringify({notices: [{hint: 'Fresh mail', args: ['--agent-context=approved', 'bridge', 'inbox']}]})
  })
  assert.equal(calls, 1)
  assert.match(hint, /Fresh mail/)
})

test('missing and placeholder sessions never reach the CLI', () => {
  for (const session of [undefined, '', ' ', 'unknown', 'bad\nvalue', '\ud800', 'x'.repeat(1025), '\u754c'.repeat(342)]) {
    assert.equal(validBridgeSession(session), false)
    assert.equal(bridgeSessionHint('pi', session), '')
    assert.equal(bridgeNoticeHint('pi', session, {}, () => { throw new Error('must not run') }), '')
  }
})

test('old CLI, disabled notices and malformed output fail quietly without fallback commands', () => {
  let calls = 0
  const run = () => { calls++; throw new Error('unknown subcommand') }
  assert.equal(bridgeNoticeHint('pi', 'real', {NMEM_NO_MAILBOX_NOTICE: '1'}, run), '')
  assert.equal(calls, 0)
  assert.equal(bridgeNoticeHint('pi', 'real', {}, run), '')
  assert.equal(calls, 1)
  for (const output of ['null', '{}', '{"notices":{}}', '{"notices":[null]}']) {
    assert.equal(bridgeNoticeHint('pi', 'real', {}, () => output), '')
  }
})


test('host runner owns Windows execution for notices and actual session cleanup', async () => {
  const calls = []
  const session = 'opaque & "quoted"'
  const run = async (args, timeout) => { calls.push({args, timeout}); return {ok: true, stdout: '{"notices":[]}'} }
  await bridgeNoticeWithRunner('pi', session, run, {})
  await closeBridgeSession('pi', session, run)
  assert.deepEqual(calls, [
    {args: ['bridge', 'notices', 'check', '--host=pi', '--session-id=' + session], timeout: 500},
    {args: ['bridge', 'notices', 'unsubscribe', '--host=pi', '--session-id=' + session, '--ended'], timeout: 500},
  ])
})


test('selected Context fences both JS check paths while cleanup releases the actual session', async () => {
  const env = {NMEM_AGENT_CONTEXT:'context-a', NMEM_CLI_PATH:'/fixture/nmem.exe'}
  const expected = ['--agent-context=context-a', 'bridge', 'notices', 'check', '--host=pi', '--session-id=shared-session']
  let selected = 0
  bridgeNoticeHint('pi', 'shared-session', env, (_executable, args) => {
    assert.deepEqual(args, ['--json', ...expected]); selected++
    return '{"notices":[]}'
  })
  await bridgeNoticeWithRunner('pi', 'shared-session', async args => {
    assert.deepEqual(args, expected); selected++
    return {ok:true, stdout:'{"notices":[]}'}
  }, env)
  assert.equal(selected, 2)
})


test('Droid exec-form hook preserves actual session correlation without Python', async () => {
  const {readFileSync} = await import('node:fs')
  const {spawnSync} = await import('node:child_process')
  const root = new URL('../../../nowledge-mem-droid-plugin/hooks/', import.meta.url)
  const config = JSON.parse(readFileSync(new URL('hooks.json', root), 'utf8'))
  for (const event of ['SessionStart','UserPromptSubmit','SessionEnd']) {
    const hook = config.hooks[event].flatMap(group => group.hooks).find(hook => hook.args?.[0]?.endsWith('/bridge-notice.mjs'))
    assert.equal(hook.command, 'node')
    assert.deepEqual(hook.args, ['${DROID_PLUGIN_ROOT}/hooks/bridge-notice.mjs'])
  }
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('bridge-notice.mjs', root))], {input:JSON.stringify({hook_event_name:'SessionStart',session_id:'actual-droid-session'}), encoding:'utf8', env:{...process.env,NMEM_BRIDGE_INBOX_ON_START:'1',NMEM_AGENT_CONTEXT:'fixture'}})
  assert.equal(result.status,0,result.stderr)
  assert.match(JSON.parse(result.stdout).hookSpecificOutput.additionalContext, /actual-droid-session/)
})
