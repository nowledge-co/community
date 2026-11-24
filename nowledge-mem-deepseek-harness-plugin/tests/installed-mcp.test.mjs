import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { installHost } from './helpers/installed-host.mjs'
import { gateModel, startMcpFixture } from './helpers/mcp-fixture.mjs'

const ping = 'mcp__nowledge_mem__ping'
const resources = ['list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource']

test('installed DSH MCP tools, resources and connection recovery', {
  skip: process.env.DSH_INSTALLED_MCP_TEST !== 'true' ? 'runs on the latest installed-host CI lane' : false,
  timeout: 300_000,
}, async t => {
  const host = await installHost(t)
  const patch = join(host.root, 'mcp-qa.patch.yml')
  const observer = join(host.root, 'mcp-lifecycle-observer.mjs')
  // Headless JSON mode does not export ordinary host logs to its process
  // streams. Observe the real supervisor without changing its behavior.
  await writeFile(observer, [
    'export function apply(ctx) {',
    '  ctx.logger.exporter({ levels: { default: Infinity }, export(message) {',
    '    const text = message.args.map(String).join(" ")',
    '    if (text.includes("mcp-client(nowledge_mem)")) {',
    '      if (text.includes("reconnected and re-synced tools")) process.stderr.write("NMEM_MCP_RECONNECTED\\n")',
    '      if (text.includes("timed out")) process.stderr.write("NMEM_MCP_STARTUP_TIMED_OUT\\n")',
    '    }',
    '  } })',
    '}',
  ].join('\n'))
  // Exercise the installed bundle's MCP row and its default timeouts unchanged.
  await writeFile(patch, `- id: session-title-llm\n  disabled: true\n- id: session-telemetry-otel\n  disabled: true\n- insert:\n    - id: mcp-lifecycle-observer\n      name: ${JSON.stringify(observer)}\n- id: nowledge-mem\n  config:\n    contextOnSessionStart: false\n    recallOnPrompt: false\n    syncOnTurnEnd: false\n`)
  const run = async (fixture, modelURL, observe) => {
    const result = await host.run([host.cli, 'headless', '--patch', patch, '--json', '--approval-policy', 'never', 'Read the synthetic memory fixture.'], {
      ...host.env, DEEPSEEK_API_KEY: 'synthetic-only', DEEPSEEK_BASE_URL: modelURL,
      NMEM_API_URL: 'http://127.0.0.1:1', NMEM_MCP_URL: fixture.url, NMEM_API_KEY: 'synthetic-required-key',
      HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1', NO_PROXY: '127.0.0.1,localhost', NODE_USE_ENV_PROXY: '1',
    }, observe)
    assert.equal(result.code, 0, result.stderr)
    assert.ok(fixture.state.requests.length > 0)
    for (const { headers } of fixture.state.requests) {
      assert.equal(headers.authorization, 'Bearer synthetic-required-key')
      assert.equal(headers['x-nmem-api-key'], 'synthetic-required-key')
      assert.equal(headers['x-nmem-tool-set'], 'external-agent')
      assert.equal(headers['x-nowledge-tool-schema-profile'], 'slim')
    }
    return { ...result, results: result.stdout.trim().split('\n').map(JSON.parse).filter(event => event.type === 'tool_result') }
  }
  const modelFor = async (t, toolName, args = {}, sequence = ['tool_call_success', 'success']) => {
    const model = await host.startMockLlmServer({ sequence, toolName, toolArguments: JSON.stringify(args), successText: 'Synthetic memory verified.' })
    t.after(() => model.close())
    return model
  }

  for (const [name, args, expected] of [
    [ping, {}, /Synthetic memory pong\./u],
    ['list_mcp_resources', { server: 'nowledge_mem' }, /memo:\/\/fixture/u],
    ['list_mcp_resource_templates', { server: 'nowledge_mem' }, /memo:\/\/fixture\/\{name\}/u],
    ['read_mcp_resource', { server: 'nowledge_mem', uri: 'memo://fixture' }, /Synthetic resource memory\./u],
  ]) {
    await t.test(`discovers and executes ${name}`, async t => {
      const fixture = await startMcpFixture(t)
      const model = await modelFor(t, name, args)
      const result = await run(fixture, model.baseURL)
      const offered = model.requests[0].body.tools.map(tool => tool.name)
      for (const tool of [ping, ...resources]) assert.ok(offered.includes(tool), `Missing ${tool}`)
      assert.equal(model.requests.length, 2)
      assert.equal(result.results.length, 1)
      assert.equal(result.results[0].status, 'completed', JSON.stringify(result.results))
      assert.match(result.results[0].result, expected)
      assert.match(JSON.stringify(model.requests[1].body.messages), expected)
    })
  }

  await t.test('surfaces an MCP error as a failed tool call', async t => {
    const fixture = await startMcpFixture(t, { rejectToolCalls: true })
    const model = await modelFor(t, ping)
    const result = await run(fixture, model.baseURL)
    assert.equal(result.results.length, 1)
    assert.equal(result.results[0].status, 'error', JSON.stringify(result.results))
    assert.match(result.results[0].result, /Synthetic memory failure/u)
  })

  await t.test('a dropped HTTP tool request does not prevent a later call', async t => {
    const fixture = await startMcpFixture(t, { dropToolCall: true })
    const model = await modelFor(t, ping, {}, ['tool_call_success', 'tool_call_success', 'success'])
    const result = await run(fixture, model.baseURL)
    assert.equal(fixture.state.dropped, 1)
    assert.equal(result.results.length, 2)
    assert.equal(result.results.at(-1).status, 'completed', JSON.stringify(result.results))
    assert.match(result.results.at(-1).result, /Synthetic memory pong/u)
  })

  await t.test('a stalled startup is bounded and reconnects within the same host', async t => {
    const fixture = await startMcpFixture(t, { mode: 'stall' })
    const model = await modelFor(t, 'read_mcp_resource', { server: 'nowledge_mem', uri: 'memo://fixture' })
    const lifecycle = new EventEmitter()
    let output = '', reconnected = false, startupElapsed
    const modelURL = await gateModel(t, model.baseURL, async () => {
      startupElapsed = performance.now() - fixture.state.requests[0].time
      assert.ok(startupElapsed >= 7_000 && startupElapsed < 25_000, `Startup took ${startupElapsed} ms`)
      // The first model request proves the host continued after the stalled
      // attempt. Release the server, then wait for the real supervisor receipt.
      const ready = once(lifecycle, 'reconnected', { signal: AbortSignal.timeout(20_000) })
      fixture.state.mode = 'healthy'
      await ready
    })
    const result = await run(fixture, modelURL, chunk => {
      output += chunk
      if (!reconnected && /NMEM_MCP_RECONNECTED/u.test(output)) {
        reconnected = true
        lifecycle.emit('reconnected')
      }
    })
    assert.ok(startupElapsed !== undefined)
    assert.ok(reconnected, result.stderr)
    assert.match(output, /NMEM_MCP_STARTUP_TIMED_OUT/u)
    assert.equal(result.results[0]?.status, 'completed', JSON.stringify(result.results))
    assert.match(result.results[0].result, /Synthetic resource memory/u)
    assert.ok(model.requests[1].body.tools.some(tool => tool.name === ping))
  })
})
