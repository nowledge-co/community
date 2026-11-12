import assert from 'node:assert/strict'
import test from 'node:test'
import * as plugin from '../src/index.js'
import { readFile } from 'node:fs/promises'

for (const spaceField of ['id', 'space_id']) {
test(`native 0.2.2-rc.2 command/query preview/apply with ${spaceField} roster`, { skip: process.env.DSH_HISTORY_NATIVE_TEST !== 'true' ? 'qualified in the explicit latest-host CI lane' : false }, async () => {
  const { Context, Service } = await import('@deepseek-ai/cordis')
  const { default: SessionStore } = await import('@deepseek-ai/dsh-session')
  const { default: CommandRuntime } = await import('@deepseek-ai/dsh-commands')
  const { default: SessionQuery } = await import('@deepseek-ai/dsh-session-query')
  const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
  const ctx = new Context()
  const fibers = []
  const mount = async plugin => { const fiber = ctx.plugin(plugin); fibers.push(fiber); await fiber }
  try {
    await mount(SessionStore)
    await mount(CommandRuntime)
    const owner = ctx.sessions.create('current-qa', { meta: { cwd: '/synthetic' } })
    const history = ctx.sessions.create('old-qa', { meta: { cwd: '/synthetic' } })
    history.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'Synthetic history question' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
    class FixturePersistence extends Service {
      constructor(inner) { super(inner, 'sessionPersistence') }
      async list() { return ctx.sessions.list().map(session => ({ header: session.header, revision: 'synthetic' })) }
    }
    await mount(FixturePersistence)
    await mount(SessionQuery)
    let writes = 0
    class FixtureAgents extends Service { constructor(inner) { super(inner, 'agents') } }
    class FixtureShell extends Service {
      constructor(inner) { super(inner, 'shell') }
      resolve(request) { return request }
      async execute(request) {
        let body
        if (request.command.includes('config mcp show')) {
          body = { apiUrl: 'http://127.0.0.1:1', apiKeyConfigured: false }
        } else if (request.command.includes('spaces list')) {
          assert.equal(request.env.NMEM_API_URL, 'http://127.0.0.1:1')
          assert.equal(request.env.NMEM_SPACE, '')
          body = { spaces: [{ [spaceField]: 'exact-space' }] }
        } else {
          assert.match(request.command, /--space-id exact-space/u)
          assert.equal(request.env.NMEM_API_URL, 'http://127.0.0.1:1')
          const match = request.command.match(/--file (?:'([^']+)'|(\S+))/u)
          const payload = JSON.parse(await readFile(match[1] ?? match[2], 'utf8'))
          assert.deepEqual(payload.messages.map(row => row.content), ['Synthetic history question'])
          writes++
          body = { success: true, results: [{ success: true, message_count: 1 }] }
        }
        return { result: async () => ({ exitCode: 0, stdout: { text: JSON.stringify(body) } }) }
      }
    }
    await mount(FixtureAgents)
    await mount(FixtureShell)
    const pluginFiber = ctx.plugin(plugin, { syncOnTurnEnd: false, contextOnSessionStart: false, recallOnPrompt: false })
    fibers.push(pluginFiber)
    await pluginFiber
    const agent = { id: owner.id, session: owner }
    const run = text => ctx.commands.execute(agent, `/mem-backfill ${text}`, [], new AbortController().signal)
    assert.match((await run('list')).result.text, /old-qa/u)
    assert.equal((await run('preview unknown-space old-qa')).result.kind, 'error')
    assert.equal(writes, 0)
    const preview = (await run('preview exact-space old-qa')).result
    assert.equal(preview.kind, 'success', preview.text)
    assert.equal(writes, 0)
    const token = preview.text.match(/apply ([a-f0-9]{32})/u)[1]
    assert.equal((await run(`apply ${token}`)).result.kind, 'success')
    assert.equal(writes, 1)
    const commandRuns = owner.snapshotEvents().filter(event => event.type === 'command/run')
    assert.ok(commandRuns.length > 0)
    assert.ok(commandRuns.every(event => event.data.args === undefined))
    await pluginFiber.dispose()
    assert.equal(ctx.commands.find(agent, 'mem-backfill'), undefined)
  } finally { for (const fiber of fibers.reverse()) await fiber.dispose() }
})
}
