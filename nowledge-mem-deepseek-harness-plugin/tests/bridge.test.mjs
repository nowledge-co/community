import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session } from '@deepseek-ai/dsh-session'
import { assertV4RowAdmission, assertReleasedV4Relationships } from '@deepseek-ai/dsh-session-format-v3-to-v4'
import { apply } from '../src/index.js'
import { hasContextBundle } from '../src/context.js'

function fixture(t, config = {}, result = () => ({ exitCode: 1 })) {
  const keys = ['NMEM_BRIDGE_INBOX_ON_START', 'NMEM_AGENT_CONTEXT', 'NMEM_CLI_PATH']
  const previous = keys.map(key => process.env[key])
  t.after(() => {
    for (const [i, key] of keys.entries()) {
      if (previous[i] === undefined) delete process.env[key]
      else process.env[key] = previous[i]
    }
  })
  process.env.NMEM_BRIDGE_INBOX_ON_START = '1'
  process.env.NMEM_AGENT_CONTEXT = 'synthetic-private-context'
  process.env.NMEM_CLI_PATH = '/synthetic/Agent CLI/nmem'
  const listeners = new Map(), requests = [], warnings = []
  apply({
    on: (name, listener) => listeners.set(name, listener),
    logger: { warn: value => warnings.push(value) },
    shell: {
      resolve: request => request,
      execute: async request => {
        requests.push(request)
        return { result: async () => result(request, requests.length) }
      },
    },
  }, { contextOnSessionStart: false, recallOnPrompt: false, syncOnTurnEnd: false, ...config })
  const session = Session.create('bridge-fixture')
  const prompt = createUserMessage({ content: [{ type: 'text', text: 'review the prior decision' }], source: { kind: 'user' } })
  const decision = { kind: 'enter', startsRequestSeries: true, messages: [prompt] }
  const step = (options = {}) => listeners.get('agent/pre-step')(
    { agent: { session: options.session ?? session }, signal: options.signal ?? new AbortController().signal },
    async () => options.decision ?? decision,
  )
  return { session, decision, requests, warnings, step }
}

test('Bridge requires exact opt-in and a nonblank Context without consuming the reminder', async t => {
  const host = fixture(t)
  for (const enabled of ['', '0', 'true']) {
    process.env.NMEM_BRIDGE_INBOX_ON_START = enabled
    assert.equal(await host.step(), host.decision)
  }
  process.env.NMEM_BRIDGE_INBOX_ON_START = '1'
  for (const context of ['', ' \t\n']) {
    process.env.NMEM_AGENT_CONTEXT = context
    assert.equal(await host.step(), host.decision)
  }
  delete process.env.NMEM_AGENT_CONTEXT
  assert.equal(await host.step(), host.decision)
  process.env.NMEM_AGENT_CONTEXT = 'synthetic-private-context'
  const first = await host.step()
  assert.equal(first.startsRequestSeries, true)
  const notice = first.messages[1]
  assert.equal(notice.source.form, 'notice')
  assert.equal(notice.source.kind, 'plugin:nowledge-mem')
  assert.doesNotThrow(() => assertV4RowAdmission({ type: 'user/message', seq: 1, time: Date.now(), data: notice }))
  assert.match(notice.content[0].text, /--resolved-space-id/u)
  assert.match(notice.content[0].text, /messages\[\]\.message/u)
  assert.doesNotMatch(notice.content[0].text, /synthetic-private-context/u)
  assert.equal(await host.step(), host.decision)
  assert.equal((await host.step({ session: Session.create('another-live-session') })).messages.length, 2)
  assert.deepEqual(host.requests, [])
})

test('Bridge notice cannot suppress Working Memory recovery after startup fails', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000 })
  const host = fixture(t, { contextOnSessionStart: true }, (_, attempt) => attempt === 1
    ? { exitCode: 1 }
    : { exitCode: 0, stdout: { text: '{"working_memory":"Recovered context"}' } })
  const first = await host.step()
  assert.equal(first.messages.length, 2)
  host.session.append('user/message', first.messages[1], { surfaceOp: 'append' })
  assert.equal(hasContextBundle(host.session), false)
  t.mock.timers.tick(1_001)
  const recovered = await host.step()
  assert.equal(host.requests.length, 2)
  assert.equal(recovered.messages.length, 2)
  assert.equal(recovered.messages[1].source.form, 'snapshot')
  assert.match(recovered.messages[1].content[0].text, /Recovered context/u)
  host.session.append('user/message', recovered.messages[1], { surfaceOp: 'append' })
  assert.equal(hasContextBundle(host.session), true)
})

test('an unexpected recall result preserves loaded context and the Bridge notice', async t => {
  const host = fixture(t, { contextOnSessionStart: true, recallOnPrompt: true }, request => ({
    exitCode: 0,
    stdout: { text: request.command.includes(' context ') ? '{"working_memory":"Available context"}' : 42 },
  }))
  const result = await host.step()
  assert.equal(result.messages.length, 3)
  assert.match(result.messages[1].content[0].text, /Available context/u)
  assert.equal(result.messages[2].source.form, 'notice')
  assert.equal(host.warnings.length, 1)
  assert.equal(host.requests.length, 2)
})

test('rejected and cancelled pre-steps do not consume the Bridge notice', async t => {
  const controller = new AbortController()
  const host = fixture(t, { contextOnSessionStart: true }, () => {
    controller.abort()
    return { exitCode: 0, aborted: true }
  })
  const rejected = { kind: 'reject', reason: 'Synthetic rejection' }
  assert.equal(await host.step({ decision: rejected }), rejected)
  assert.deepEqual(host.requests, [])
  assert.equal(await host.step({ signal: controller.signal }), host.decision)
  assert.equal(await host.step({ signal: controller.signal }), host.decision)
  assert.equal(host.requests.length, 1)
  assert.equal((await host.step()).messages[1].source.form, 'notice')
})

for (const configured of [undefined, '/synthetic/Explicit CLI/nmem']) {
  test(`Bridge and Memory share the ${configured ? 'configured' : 'environment'} CLI path`, async t => {
    const host = fixture(t, { cliPath: configured, contextOnSessionStart: true })
    const path = configured ?? process.env.NMEM_CLI_PATH
    const result = await host.step()
    assert.ok(host.requests[0].command.includes(path))
    assert.ok(result.messages[1].content[0].text.includes(JSON.stringify(path)))
    assert.doesNotMatch(result.messages[1].content[0].text, /synthetic-private-context/u)
  })
}


test('generic notice uses actual DSH session and local command on active steps', async t => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-notice-'))
  const before = process.env.NMEM_CLI_CONFIG_DIR
  t.after(() => {
    if (before === undefined) delete process.env.NMEM_CLI_CONFIG_DIR
    else process.env.NMEM_CLI_CONFIG_DIR = before
    rmSync(root, {recursive:true, force:true})
  })
  process.env.NMEM_CLI_CONFIG_DIR = root
  mkdirSync(join(root, 'bridge-notices-v1'))
  writeFileSync(join(root, 'bridge-notices-v1', 'enabled'), '1')
  const host = fixture(t, {}, () => ({exitCode:0, stdout:{text:JSON.stringify({notices:[{hint:'Synthetic pending mail',args:['--agent-context=fixture','bridge','inbox']}]})}}))
  process.env.NMEM_BRIDGE_INBOX_ON_START = '0'
  const result = await host.step()
  assert.equal(host.requests.length, 1)
  assert.match(host.requests[0].command, /bridge.*notices.*check/u)
  assert.ok(host.requests[0].command.includes('--session-id=' + host.session.header.id))
  assert.ok(host.requests[0].command.includes('--event=tool'))
  const notice = result.messages[1]
  assert.match(notice.content[0].text, /Synthetic pending mail/u)
  assert.doesNotThrow(() => assertReleasedV4Relationships({
    header: host.session.header,
    inheritedEventCount: 0,
    events: [{ type: 'user/message', seq: 1, time: Date.now(), surfaceOp: 'append', data: notice }],
  }, new Set(['user/message'])))
  assert.equal(notice.source.kind, 'plugin:nowledge-mem')
  assert.equal(notice.source.form, 'notice')
})
