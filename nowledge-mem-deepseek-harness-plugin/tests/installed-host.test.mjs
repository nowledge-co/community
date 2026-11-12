import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { delimiter, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

test('installed DSH tool turn drains clean automatic capture before headless exit', { skip: process.env.DSH_INSTALLED_HOST_TEST !== 'true' ? 'runs in the dedicated installed-host CI lane' : false, timeout: 180_000 }, async () => {
  const packageRoot = fileURLToPath(new URL('..', import.meta.url))
  const hostRoot = process.env.DSH_TEST_HOST_ROOT ?? packageRoot
  const requireHost = createRequire(join(hostRoot, 'package.json'))
  const { startMockLlmServer } = await import(pathToFileURL(requireHost.resolve('@deepseek-ai/dsh-llm-mock-server')))
  const root = await mkdtemp(join(process.env.DSH_HOME, 'installed-'))
  const home = join(root, 'home'), dshHome = join(root, 'dsh'), receipt = join(root, 'imports.jsonl')
  await mkdir(home)
  const env = { PATH: join(hostRoot, 'node_modules/.bin') + delimiter + process.env.PATH, HOME: home, DSH_HOME: dshHome, CI: '1', LANG: 'C.UTF-8' }
  const cli = join(hostRoot, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
  const run = (args, environment, cwd = root) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: environment, timeout: 120_000 })
    let stdout = '', stderr = ''
    child.stdout.on('data', value => { stdout += value })
    child.stderr.on('data', value => { stderr += value })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
  let model
  try {
    const pack = await new Promise((resolve, reject) => {
      const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--json', '--pack-destination', root], { cwd: packageRoot, env })
      let stdout = '', stderr = ''
      child.stdout.on('data', value => { stdout += value })
      child.stderr.on('data', value => { stderr += value })
      child.on('error', reject)
      child.on('close', code => code === 0 ? resolve(JSON.parse(stdout)[0]) : reject(new Error(stderr)))
    })
    await new Promise((resolve, reject) => {
      const child = spawn('tar', ['-xzf', join(root, pack.filename), '-C', root], { env })
      child.on('error', reject)
      child.on('close', code => code === 0 ? resolve() : reject(new Error('artifact extraction failed')))
    })
    const installed = await run([cli, 'plugin', '--profile', 'headless', 'add', join(root, 'package')], env)
    assert.equal(installed.code, 0, installed.stderr)
    const stub = join(root, 'nmem-qa')
    await writeFile(stub, [
      `#!${process.execPath}`,
      'import {readFileSync,appendFileSync} from "node:fs"',
      'const args=process.argv.slice(2)',
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
      NMEM_API_URL: 'http://127.0.0.1:1', NMEM_MCP_URL: 'http://127.0.0.1:1/mcp', NMEM_API_KEY: '',
      HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1', NO_PROXY: '127.0.0.1,localhost', NODE_USE_ENV_PROXY: '1',
    })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /"type":"tool_result"/u)
    assert.equal(model.requests.length, 2)
    const payloads = (await readFile(receipt, 'utf8')).trim().split('\n').map(JSON.parse)
    assert.equal(payloads.length, 1)
    assert.deepEqual(payloads[0].messages.map(row => [row.role, row.content]), [['user', 'Synthetic installed-host question.'], ['assistant', 'Synthetic final reply.']])
    assert.doesNotMatch(JSON.stringify(payloads), /Synthetic injected context|Synthetic private reasoning|Synthetic tool-only marker/u)
  } finally {
    await model?.close()
    await rm(root, { recursive: true, force: true })
  }
})
