import assert from 'node:assert/strict'
import test from 'node:test'
import { historyCommand } from '../src/history.js'
import { importSession, apply } from '../src/index.js'
import { readFile } from 'node:fs/promises'

function snapshot(id = 'old', cwd = '/synthetic') {
  const message = (id, text, source = { kind: 'user' }) => ({ id, content: [{ type: 'text', text }], source })
  return { session: { id, cwd }, events: [
    { seq: 0, type: 'user/message', data: message('injected', 'PRIVATE injected', { kind: 'plugin:test' }) },
    { seq: 1, type: 'user/message', data: message('q', 'Synthetic question') },
    { seq: 2, type: 'assistant/message', data: { message: { ...message('tool', 'PRIVATE tool narration'), content: [{ type: 'tool-call', arguments: 'PRIVATE arguments' }] } } },
    { seq: 3, type: 'assistant/message', data: { message: { ...message('a', 'Synthetic answer', { provider: 'test' }), content: [{ type: 'reasoning', text: 'PRIVATE reasoning' }, { type: 'text', text: 'Synthetic answer' }] }, stream: ['PRIVATE stream'] } },
  ] }
}

function fixture(overrides = {}) {
  const snapshots = new Map([['old', snapshot()], ['foreign', snapshot('foreign', '/other')]])
  const writes = [], reads = []
  const records = [...snapshots.values()].map(s => ({ persisted: true, header: s.session }))
  records.push({ persisted: false, header: { id: 'ephemeral', cwd: '/synthetic' } })
  records.push({ persisted: true, header: { id: 'child', cwd: '/synthetic', origin: 'subagent' } })
  records.push({ persisted: true, header: { id: 'private', cwd: '/synthetic', private: true } })
  const ctx = { sessionQuery: {
    listSessions: async () => records,
    readSession: async id => { reads.push(id); return snapshots.get(id) },
  }, ...overrides.ctx }
  let now = 0
  const owner = { header: { id: 'current', cwd: '/synthetic' } }
  const config = { sourceApp: 'deepseek-harness', maxThreadMessageChars: 1000 }
  const importer = overrides.importer ?? (async (_ctx, config, current) => { writes.push({ config, current }); return { count: 2 } })
  const definition = historyCommand(ctx, config, async () => ({ url: 'https://synthetic.invalid/remote-api', env: { NMEM_API_URL: 'https://synthetic.invalid/remote-api', NMEM_API_KEY: 'synthetic-secret' } }), importer, () => now)
  const run = (rawInput, session = owner, signal = new AbortController().signal) => definition.handler({ rawInput, agent: { session }, signal })
  return { run, writes, reads, snapshots, owner, config, definition, ctx, advance: n => { now += n } }
}

function token(preview) {
  assert.equal(preview.kind, 'success', preview.text)
  return preview.text.match(/apply ([a-f0-9]{32})/u)[1]
}

test('listing is metadata-only and limited to persisted top-level workspace sessions', async () => {
  const f = fixture()
  const listed = await f.run('list')
  assert.match(listed.text, /^old\n/u)
  assert.doesNotMatch(listed.text, /foreign|ephemeral|private|child/u)
  assert.equal(f.reads.length, 0)
  assert.equal(f.writes.length, 0)
})

test('preview is write-free, clean, frozen, scoped and one-use', async () => {
  const f = fixture()
  const preview = await f.run('preview exact%20space old')
  assert.match(preview.text, /exact Space ID: exact space/u)
  assert.equal(f.writes.length, 0)
  assert.doesNotMatch(preview.text, /synthetic-secret|PRIVATE/u)
  const approval = token(preview)
  f.snapshots.get('old').events.push({ seq: 4, type: 'user/message', data: { source: { kind: 'user' }, content: 'later activity' } })
  assert.equal((await f.run(`apply ${approval}`, { header: { cwd: '/synthetic' } })).kind, 'error')
  assert.equal((await f.run(`apply ${approval}`)).kind, 'success')
  assert.equal(f.writes.length, 1)
  assert.equal(f.writes[0].config.spaceId, 'exact space')
  assert.equal(f.writes[0].config.connectionEnv.NMEM_API_KEY, 'synthetic-secret')
  assert.doesNotMatch(JSON.stringify(f.writes[0].current), /PRIVATE|later activity/u)
  assert.equal((await f.run(`apply ${approval}`)).kind, 'error')
})

for (const selection of ['foreign', 'ephemeral', 'private', 'child', 'missing', 'old old']) {
  test(`preview refuses ${selection} without uploading anything`, async () => {
    const f = fixture()
    assert.equal((await f.run(`preview space ${selection}`)).kind, 'error')
    assert.equal(f.writes.length, 0)
  })
}

test('expired or cancelled previews never write', async () => {
  const f = fixture()
  let approval = token(await f.run('preview space old'))
  f.advance(600_000)
  assert.equal((await f.run(`apply ${approval}`)).kind, 'error')
  approval = token(await f.run('preview space old'))
  await f.run('cancel')
  assert.equal((await f.run(`apply ${approval}`)).kind, 'error')
  assert.equal(f.writes.length, 0)
})

test('failed reads invalidate prior preview and do not authorize partial selection', async () => {
  const f = fixture()
  const approval = token(await f.run('preview space old'))
  f.ctx.sessionQuery.readSession = async () => { throw new Error('PRIVATE path') }
  const failed = await f.run('preview space old')
  assert.equal(failed.kind, 'error')
  assert.doesNotMatch(failed.text, /PRIVATE/u)
  assert.equal((await f.run(`apply ${approval}`)).kind, 'error')
})

test('human cancel aborts an active apply and stops the remaining sessions', async () => {
  const started = Promise.withResolvers(), finished = Promise.withResolvers()
  let writes = 0
  const f = fixture({ importer: async (_ctx, _config, _snapshot, _cursor, signal) => {
    writes++
    started.resolve()
    await new Promise(resolve => { signal.addEventListener('abort', resolve, { once: true }) })
    finished.resolve()
    throw signal.reason
  } })
  f.snapshots.set('second', snapshot('second'))
  f.ctx.sessionQuery.listSessions = async () => [...f.snapshots.values()].map(s => ({ persisted: true, header: s.session }))
  const approval = token(await f.run('preview space old second'))
  const applying = f.run(`apply ${approval}`)
  await started.promise
  await f.run('cancel')
  await finished.promise
  assert.equal((await applying).kind, 'error')
  assert.equal(writes, 1)
})

test('shell import pins connection and Space; replay and longer capture keep native IDs', async () => {
  const rows = new Map(), ids = []
  const f = fixture({ importer: importSession })
  f.config.cliPath = 'nmem'
  f.ctx.shell = { resolve: r => r, execute: async request => {
    assert.equal(request.env.NMEM_API_URL, 'https://synthetic.invalid/remote-api')
    assert.equal(request.env.NMEM_API_KEY, 'synthetic-secret')
    assert.match(request.command, /--space-id space/u)
    ids.push(request.command.match(/--id (\S+)/u)[1])
    const match = request.command.match(/--file (?:'([^']+)'|(\S+))/u)
    const payload = JSON.parse(await readFile(match[1] ?? match[2], 'utf8'))
    for (const row of payload.messages) rows.set(row.metadata.external_id, row)
    return { result: async () => ({ exitCode: 0, stdout: { text: JSON.stringify({ success: true, results: [{ success: true, message_count: rows.size }] }) } }) }
  } }
  for (let i = 0; i < 2; i++) {
    const approval = token(await f.run('preview space old'))
    assert.equal((await f.run(`apply ${approval}`)).kind, 'success')
    assert.equal(rows.size, 2)
  }
  f.snapshots.get('old').events.push({ seq: 4, type: 'user/message', data: { id: 'q2', source: { kind: 'user' }, content: 'Next question' } })
  const approval = token(await f.run('preview space old'))
  await f.run(`apply ${approval}`)
  assert.equal(rows.size, 3)
  assert.deepEqual(new Set(ids), new Set(['deepseek-harness-old']))
})

test('older hosts without optional services still register capture and recall', () => {
  const listeners = new Map()
  apply({ on: (name, listener) => listeners.set(name, listener) })
  assert.ok(listeners.has('agent/pre-step'))
  assert.ok(listeners.has('session/event'))
})
