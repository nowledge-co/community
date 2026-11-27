import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { installHost } from './helpers/installed-host.mjs'
import { startMcpFixture } from './helpers/mcp-fixture.mjs'

// Release proof: put the candidate or GA nmem on PATH beside the installed DSH
// SDK and select DSH_INSTALLED_MCP_BRIDGE_TEST=true. The workspace is synthetic.
test('installed DSH uses stdio without changing its tool profile', {
  skip: process.env.DSH_INSTALLED_MCP_BRIDGE_TEST !== 'true' ? 'requires the qualified nmem executable' : false,
}, async t => {
  const host = await installHost(t)
  const fixture = await startMcpFixture(t, { bearerOnly: true })
  const model = await host.startMockLlmServer({ sequence: ['tool_call_success', 'success'],
    toolName: 'mcp__nowledge_mem__ping', toolArguments: '{}', successText: 'Verified.' })
  t.after(() => model.close())
  const patch = join(host.root, 'stdio-qa.yml')
  await writeFile(patch, '- id: session-title-llm\n  disabled: true\n- id: session-telemetry-otel\n  disabled: true\n- id: nowledge-mem\n  config:\n    contextOnSessionStart: false\n    recallOnPrompt: false\n    syncOnTurnEnd: false\n')
  const result = await host.run([host.cli, 'headless', '--patch', patch, '--json', '--approval-policy', 'never', 'Read the synthetic memory.'], {
    ...host.env, DEEPSEEK_API_KEY: 'synthetic-only', DEEPSEEK_BASE_URL: model.baseURL,
    NMEM_API_URL: new URL(fixture.url).origin, NMEM_API_KEY: 'synthetic-required-key',
    HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1', NO_PROXY: '127.0.0.1,localhost',
  })
  assert.equal(result.code, 0, result.stderr)
  const tools = result.stdout.split('\n').filter(Boolean).map(JSON.parse).filter(e => e.type === 'tool_result')
  assert.equal(tools.length, 1)
  assert.equal(tools[0].status, 'completed')
  assert.match(tools[0].result, /Synthetic memory pong/u)
  assert.ok(fixture.state.requests.length > 0)
  for (const { headers } of fixture.state.requests) {
    assert.equal(headers.authorization, 'Bearer synthetic-required-key')
    assert.equal(headers['x-nmem-tool-set'], 'external-agent')
    assert.equal(headers['x-nowledge-tool-schema-profile'], 'slim')
  }
})
