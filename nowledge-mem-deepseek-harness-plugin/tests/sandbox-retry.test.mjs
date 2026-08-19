import assert from 'node:assert/strict'
import test from 'node:test'

import { runShellWithHostSandboxRetry } from '../src/sandbox-retry.js'

function sandboxUnavailable() {
  return Object.assign(new Error('sandbox unavailable'), { code: 'SANDBOX_UNAVAILABLE' })
}

function testContext({ policyService, policyServiceError, runResults }) {
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
      async run(request) {
        requests.push(request)
        const result = runResults.shift()
        if (result instanceof Error) throw result
        return result
      },
    },
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
