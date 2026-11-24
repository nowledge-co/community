import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { installHost } from './helpers/installed-host.mjs'

test('installed DSH exposes the Bridge notice and drains clean capture before exit', { skip: process.env.DSH_INSTALLED_HOST_TEST !== 'true' ? 'runs in the dedicated installed-host CI lane' : false, timeout: 180_000 }, async t => {
  const { root, env, cli, run, startMockLlmServer } = await installHost(t)
  const receipt = join(root, 'imports.jsonl')
  const commands = join(root, 'commands.jsonl')
  let model
  try {
    const stub = join(root, 'nmem-qa')
    await writeFile(stub, [
      `#!${process.execPath}`,
      'import {readFileSync,appendFileSync} from "node:fs"',
      'const args=process.argv.slice(2)',
      `appendFileSync(${JSON.stringify(commands)},JSON.stringify(args)+"\\n")`,
      'if(process.env.NMEM_API_KEY!=="synthetic-required-key") { process.stderr.write("missing expected fixture authentication"); process.exit(1) }',
      'if(args[1]==="context") console.log(JSON.stringify({working_memory:"Synthetic injected context"}))',
      'else if(args[1]==="t" && args[2]==="import") {',
      'const payload=JSON.parse(readFileSync(args[args.indexOf("--file")+1],"utf8"))',
      `appendFileSync(${JSON.stringify(receipt)},JSON.stringify(payload)+"\\n")`,
      'console.log(JSON.stringify({success:true,results:[{success:true,message_count:payload.messages.length}]}))',
      '} else { process.exitCode=1 }',
    ].join('\n'), { mode: 0o700 })
    // An extension-less script is CommonJS under a fresh profile; mark the
    // owned fixture root ESM so the stub uses exactly the current Node runtime.
    await writeFile(join(root, 'package.json'), '{"type":"module"}')
    const patch = join(root, 'qa.patch.yml')
    await writeFile(patch, `- id: session-title-llm\n  disabled: true\n- id: session-telemetry-otel\n  disabled: true\n- id: nowledge-mem-mcp\n  disabled: true\n- id: nowledge-mem\n  config:\n    cliPath: ${JSON.stringify(stub)}\n    contextOnSessionStart: true\n    recallOnPrompt: false\n    syncOnTurnEnd: true\n`)
    model = await startMockLlmServer({ sequence: ['tool_call_success', 'reasoning_success'], successText: 'Synthetic final reply.', reasoningText: 'Synthetic private reasoning.', toolName: 'bash', toolArguments: JSON.stringify({ description: 'Print synthetic marker', command: "printf 'Synthetic tool-only marker'" }) })
    const result = await run([cli, 'headless', '--patch', patch, '--json', '--approval-policy', 'never', 'Synthetic installed-host question.'], {
      ...env, DEEPSEEK_API_KEY: 'synthetic-only', DEEPSEEK_BASE_URL: model.baseURL,
      NMEM_API_URL: 'http://127.0.0.1:1', NMEM_MCP_URL: 'http://127.0.0.1:1/mcp', NMEM_API_KEY: 'synthetic-required-key',
      NMEM_BRIDGE_INBOX_ON_START: '1', NMEM_AGENT_CONTEXT: 'synthetic-private-context',
      HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1', NO_PROXY: '127.0.0.1,localhost', NODE_USE_ENV_PROXY: '1',
    })
    assert.equal(result.code, 0, result.stderr)
    const toolResult = result.stdout.trim().split('\n').map(line => JSON.parse(line))
      .find(event => event.type === 'tool_result')
    assert.equal(toolResult?.status, 'completed', JSON.stringify(toolResult))
    assert.match(toolResult.result, /Synthetic tool-only marker/u)
    assert.equal(model.requests.length, 2)
    for (const request of model.requests) {
      const messages = JSON.stringify(request.body.messages)
      assert.equal(messages.match(/<nowledge_bridge_startup>/gu)?.length, 1)
      assert.match(messages, /Synthetic injected context/u)
      assert.doesNotMatch(messages, /synthetic-private-context|synthetic-required-key/u)
    }
    assert.deepEqual((await readFile(commands, 'utf8')).trim().split('\n').map(JSON.parse).map(args => args[1]), ['context', 't'])
    const payloads = (await readFile(receipt, 'utf8')).trim().split('\n').map(JSON.parse)
    assert.equal(payloads.length, 1)
    assert.deepEqual(payloads[0].messages.map(row => [row.role, row.content]), [['user', 'Synthetic installed-host question.'], ['assistant', 'Synthetic final reply.']])
    assert.doesNotMatch(JSON.stringify(payloads), /Synthetic injected context|Synthetic private reasoning|Synthetic tool-only marker|nowledge_bridge_startup|synthetic-private-context/u)
  } finally {
    await model?.close()
  }
})
