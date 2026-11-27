import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

// Evaluate only the packaged Cordis JS config with a synthetic environment.
const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
function config(env) {
  const marker = '      config: !!js >\n'
  assert.ok(patch.includes(marker), 'the MCP row must select its transport')
  return JSON.parse(JSON.stringify(runInNewContext(patch.split(marker)[1], { process: { env } })))
}
test('default DSH MCP follows the CLI and retains its bounded tool profile', () => {
  const { transport, command, args, env, url } = config({ OTHER_PROVIDER_SECRET: 'not-for-mem' })
  assert.deepEqual({ transport, command, args }, { transport: 'stdio', command: 'nmem', args: ['mcp'] })
  assert.deepEqual(env, { NMEM_MCP_APP: 'DeepSeek Harness', NMEM_MCP_PROFILE: 'external-agent' })
  assert.equal(url, undefined)
})
test('both explicit MCP URL settings still use direct remote HTTP', () => {
  for (const name of ['NMEM_MCP_URL', 'NOWLEDGE_MEM_MCP_URL']) {
    const result = config({ [name]: 'https://mem.invalid/custom-transport/', NMEM_API_KEY: 'synthetic' })
    assert.equal(result.transport, 'streamable-http')
    assert.equal(result.url, 'https://mem.invalid/custom-transport')
    assert.equal(result.headers.Authorization, 'Bearer synthetic')
    assert.equal(result.headers['X-Nmem-Tool-Set'], 'external-agent')
    assert.equal(result.headers['X-Nowledge-Tool-Schema-Profile'], 'slim')
  }
})
