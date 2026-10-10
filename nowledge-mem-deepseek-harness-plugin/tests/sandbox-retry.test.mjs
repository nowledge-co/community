import assert from 'node:assert/strict'
import test from 'node:test'

import { runShellWithHostSandboxRetry } from '../src/sandbox-retry.js'

function sandboxUnavailable() {
  return Object.assign(new Error('sandbox unavailable'), { code: 'SANDBOX_UNAVAILABLE' })
}

function testContext({ policyService, policyServiceError, runResults, api = 'execute', failureStage = 'result' }) {
  const requests = []
  const warnings = []
  const ctx = {
    logger: {
      warn(message) {
        warnings.push(message)
      },
    },
    shell: {
      resolve(request) {
        return request
      },
    },
  }
  ctx.shell[api] = async function (request) {
    assert.equal(this, ctx.shell)
    requests.push(request)
    const result = runResults.shift()
    const complete = async () => {
      if (result instanceof Error) throw result
      return result
    }
    if (api === 'run' || (failureStage === 'execute' && result instanceof Error)) return await complete()
    return { result: complete }
  }
  if (policyService !== undefined || policyServiceError !== undefined) {
    ctx.get = key => {
      assert.equal(key, 'sandboxPolicy')
      if (policyServiceError !== undefined) throw policyServiceError
      return policyService
    }
  }
  return { ctx, requests, warnings }
}

test('does not resolve a privileged policy when the normal shell call succeeds', async () => {
  const success = { exitCode: 0, stdout: { text: 'ok' } }
  const fixture = testContext({
    policyServiceError: new Error('must not resolve'),
    runResults: [success],
  })

  const result = await runShellWithHostSandboxRetry(fixture.ctx, { command: 'nmem status' })

  assert.equal(result, success)
  assert.equal(fixture.requests.length, 1)
  assert.deepEqual(fixture.warnings, [])
})

test('skips the privileged retry when the host has no sandbox policy service', async () => {
  const fixture = testContext({ runResults: [sandboxUnavailable()] })

  const result = await runShellWithHostSandboxRetry(
    fixture.ctx,
    { command: 'nmem status' },
    undefined,
    true,
  )

  assert.equal(result, undefined)
  assert.equal(fixture.requests.length, 1)
  assert.match(fixture.warnings.at(-1), /host did not grant danger-full-access; skipping retry/)
})

test('skips the privileged retry when host policy resolution throws', async () => {
  const fixture = testContext({
    policyService: {
      resolve() {
        throw new Error('policy denied')
      },
    },
    runResults: [sandboxUnavailable()],
  })

  const result = await runShellWithHostSandboxRetry(
    fixture.ctx,
    { command: 'nmem status' },
    undefined,
    true,
  )

  assert.equal(result, undefined)
  assert.equal(fixture.requests.length, 1)
  assert.ok(fixture.warnings.some(message => message.includes('failed to resolve danger-full-access sandbox policy')))
  assert.match(fixture.warnings.at(-1), /host did not grant danger-full-access; skipping retry/)
})

test('skips the privileged retry when host policy service lookup throws', async () => {
  const fixture = testContext({
    policyServiceError: new Error('service unavailable'),
    runResults: [sandboxUnavailable()],
  })

  const result = await runShellWithHostSandboxRetry(
    fixture.ctx,
    { command: 'nmem status' },
    undefined,
    true,
  )

  assert.equal(result, undefined)
  assert.equal(fixture.requests.length, 1)
  assert.ok(fixture.warnings.some(message => message.includes('failed to access sandbox policy service')))
  assert.match(fixture.warnings.at(-1), /host did not grant danger-full-access; skipping retry/)
})

test('does not resolve a privileged policy without explicit plugin opt-in', async () => {
  const fixture = testContext({
    policyServiceError: new Error('must not resolve'),
    runResults: [sandboxUnavailable()],
  })

  const result = await runShellWithHostSandboxRetry(fixture.ctx, { command: 'nmem status' })

  assert.equal(result, undefined)
  assert.equal(fixture.requests.length, 1)
  assert.match(fixture.warnings.at(-1), /danger-full-access retry is not enabled; skipping retry/)
})

test('retries exactly once with a host-resolved sandbox policy', async () => {
  const policy = { mode: 'danger-full-access', workspaceRoot: '/workspace' }
  const session = { header: { id: 'session-1' } }
  const resolveCalls = []
  const success = { exitCode: 0, stdout: { text: 'ok' } }
  const fixture = testContext({
    policyService: {
      resolve(request) {
        resolveCalls.push(request)
        return policy
      },
    },
    runResults: [sandboxUnavailable(), success],
  })

  const result = await runShellWithHostSandboxRetry(
    fixture.ctx,
    { command: 'nmem status' },
    session,
    true,
  )

  assert.equal(result, success)
  assert.deepEqual(resolveCalls, [{ session, mode: 'danger-full-access' }])
  assert.equal(fixture.requests.length, 2)
  assert.equal(fixture.requests[0].sandboxPolicy, undefined)
  assert.equal(fixture.requests[1].sandboxPolicy, policy)
  assert.ok(fixture.warnings.some(message => message.includes('host-resolved danger-full-access policy')))
})

test('supports the legacy run API and its sandbox retry', async () => {
  const policy = { mode: 'danger-full-access' }
  const success = { exitCode: 0, stdout: { text: 'ok' } }
  const fixture = testContext({
    api: 'run',
    policyService: { resolve: () => policy },
    runResults: [sandboxUnavailable(), success],
  })

  assert.equal(await runShellWithHostSandboxRetry(fixture.ctx, { command: 'nmem status' }, undefined, true), success)
  assert.equal(fixture.requests.length, 2)
  assert.equal(fixture.requests[1].sandboxPolicy, policy)
})

test('retries sandbox errors raised while execute prepares the handle', async () => {
  const policy = { mode: 'danger-full-access' }
  const success = { exitCode: 0, stdout: { text: 'ok' } }
  const fixture = testContext({
    failureStage: 'execute',
    policyService: { resolve: () => policy },
    runResults: [sandboxUnavailable(), success],
  })

  assert.equal(await runShellWithHostSandboxRetry(fixture.ctx, { command: 'nmem status' }, undefined, true), success)
  assert.equal(fixture.requests.length, 2)
})

test('prefers execute and awaits the resolved handle result', async () => {
  const success = { exitCode: 0, stdout: { text: 'ok' } }
  const fixture = testContext({ runResults: [success] })
  fixture.ctx.shell.run = () => assert.fail('legacy run must not be used')
  const request = { command: 'nmem status', timeoutMs: 8_000 }
  const spec = { ...request, workdir: '/workspace', onExpiry: 'kill' }
  fixture.ctx.shell.resolve = value => {
    assert.equal(value, request)
    return spec
  }

  assert.equal(await runShellWithHostSandboxRetry(fixture.ctx, request), success)
  assert.deepEqual(fixture.requests, [spec])
  assert.deepEqual(fixture.warnings, [])
})

test('does not fall back to run or resolve a privileged policy on non-sandbox result failures', async () => {
  const fixture = testContext({
    policyServiceError: new Error('must not resolve'),
    runResults: [new Error('spawn failed')],
  })
  fixture.ctx.shell.run = () => assert.fail('must not repeat a failed execution')

  assert.equal(await runShellWithHostSandboxRetry(fixture.ctx, { command: 'nmem status' }, undefined, true), undefined)
  assert.equal(fixture.requests.length, 1)
  assert.match(fixture.warnings.at(-1), /nmem shell call failed: Error: spawn failed/)
})

test('warns when the host exposes neither supported shell API', async () => {
  const fixture = testContext({ runResults: [] })
  delete fixture.ctx.shell.execute

  assert.equal(await runShellWithHostSandboxRetry(fixture.ctx, { command: 'nmem status' }), undefined)
  assert.match(fixture.warnings.at(-1), /unsupported DSH shell contract/)
})
