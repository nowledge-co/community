import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { delimiter, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export async function installHost(t) {
  const packageRoot = fileURLToPath(new URL('../..', import.meta.url))
  const hostRoot = process.env.DSH_TEST_HOST_ROOT ?? packageRoot
  const requireHost = createRequire(join(hostRoot, 'package.json'))
  const { startMockLlmServer } = await import(pathToFileURL(requireHost.resolve('@deepseek-ai/dsh-llm-mock-server')))
  const root = await mkdtemp(join(process.env.DSH_HOME, 'installed-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const home = join(root, 'home'), dshHome = join(root, 'dsh')
  await mkdir(home)
  const env = { PATH: join(hostRoot, 'node_modules/.bin') + delimiter + process.env.PATH, HOME: home, DSH_HOME: dshHome, CI: '1', LANG: 'C.UTF-8' }
  const cli = join(hostRoot, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
  const processResult = (command, args, environment, cwd, observe = () => {}) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: environment, timeout: 120_000 })
    let stdout = '', stderr = ''
    child.stdout.on('data', value => { stdout += value; observe(String(value)) })
    child.stderr.on('data', value => { stderr += value; observe(String(value)) })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
  const run = (args, environment, observe) => processResult(process.execPath, args, environment, root, observe)
  const packed = await processResult(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--json', '--pack-destination', root], env, packageRoot)
  assert.equal(packed.code, 0, packed.stderr)
  const pack = JSON.parse(packed.stdout)[0]
  const extracted = await processResult('tar', ['-xzf', join(root, pack.filename), '-C', root], env, root)
  assert.equal(extracted.code, 0, extracted.stderr)
  const installed = await run([cli, 'plugin', '--profile', 'headless', 'add', join(root, 'package')], env)
  assert.equal(installed.code, 0, installed.stderr)
  return { root, env, cli, run, startMockLlmServer }
}
