import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session } from '@deepseek-ai/dsh-session'
import { assertV4RowAdmission } from '@deepseek-ai/dsh-session-format-v3-to-v4'
import { satisfies } from 'semver'

import { apply } from '../src/index.js'

function userMessage(text, source = { kind: 'user' }) {
  return createUserMessage({ content: [{ type: 'text', text }], source })
}

function shellResult(body) {
  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    aborted: false,
    stdout: { text: JSON.stringify(body) },
  }
}

function fixture(config = {}, api = 'execute') {
  const listeners = new Map()
  const requests = []
  const imports = []
  const flushes = []
  const warnings = []
  const importFinished = Promise.withResolvers()
  const session = Session.create('session-1')
  const ctx = {
    on: (event, listener) => listeners.set(event, listener),
    logger: { warn: message => warnings.push(message) },
    sessions: { flush: async value => flushes.push(value) },
    shell: { resolve: request => ({ ...request, onExpiry: 'kill' }) },
  }
  ctx.shell[api] = async request => {
    requests.push(request)
    const result = async () => {
      if (request.command.includes(' context ')) return shellResult({ working_memory: 'Current project context' })
      if (request.command.includes(' m search ')) return shellResult({
        memories: [{ id: 'memory-1', title: 'Prior decision', content: 'Use bounded shell execution.' }],
      })
      assert.match(request.command, / t import /u)
      assert.equal(flushes.at(-1), session)
      const file = request.command.match(/--file (?:'([^']+)'|(\S+))/u)
      assert.ok(file)
      const payload = JSON.parse(await readFile(file[1] ?? file[2], 'utf8'))
      imports.push(payload)
      importFinished.resolve()
      return shellResult({
        success: true,
        failed_count: 0,
        results: [{ success: true, message_count: payload.messages.length }],
      })
    }
    return api === 'execute' ? { result } : await result()
  }
  apply(ctx, config)
  const preStep = messages => listeners.get('agent/pre-step')(
    { agent: { session }, signal: new AbortController().signal },
    async () => ({ kind: 'enter', messages }),
  )
  return { session, requests, imports, warnings, importFinished: importFinished.promise, listeners, preStep }
}

for (const api of ['execute', 'run']) {
  test(`${api} injects context and recall that pass native v4 user and inbox admission`, async () => {
    const host = fixture({}, api)
    const prompt = userMessage('review the previous release decision')
    const decision = await host.preStep([prompt])

    assert.equal(decision.messages.length, 3)
    assert.equal(decision.messages[0], prompt)
    assert.deepEqual(decision.messages.slice(1).map(message => message.source), [
      {
        kind: 'plugin:nowledge-mem',
        form: 'snapshot',
        sections: [{ name: 'nowledge-mem-context', text: decision.messages[1].content[0].text }],
      },
      { kind: 'plugin:nowledge-mem', form: 'recall' },
    ])
    assert.equal(host.requests.length, 2)
    assert.equal(host.requests[0].timeoutMs, 8_000)
    assert.equal(host.requests[0].onExpiry, 'kill')
    for (const [seq, message] of decision.messages.entries()) {
      assert.doesNotThrow(() => assertV4RowAdmission({ type: 'user/message', seq, time: Date.now(), data: message }))
      host.session.append('user/message', message, { surfaceOp: 'append' })
    }
    assert.doesNotThrow(() => assertV4RowAdmission({
      type: 'agent/inbox/spliced', seq: 0, time: Date.now(),
      data: { target: 'next-step', start: 0, inserted: decision.messages },
    }))
    assert.deepEqual(host.session.deriveMessages(), decision.messages)
    assert.deepEqual(host.warnings, [])
  })
}

test('the official v4 validator rejects the pre-fix plugin wrapper', () => {
  assert.throws(() => assertV4RowAdmission({
    type: 'user/message', seq: 0, time: Date.now(),
    data: userMessage('Old context', { kind: 'plugin', plugin: 'nowledge-mem', form: 'snapshot' }),
  }), /format v4 message requires a producer-owned source kind/u)
})

test('does not duplicate a visible context snapshot and reinjects after compaction', async () => {
  const host = fixture({ recallOnPrompt: false })
  const prompt = userMessage('Original question')
  const first = await host.preStep([prompt])
  assert.equal(first.messages.length, 2)
  host.session.append('user/message', first.messages[1], { surfaceOp: 'append' })

  const second = await host.preStep([prompt])
  assert.deepEqual(second.messages, [prompt])
  assert.equal(host.requests.length, 1)

  host.session.append('user/message', prompt, {
    surfaceOp: { op: 'replace', startSeq: 0, endSeq: 0 },
    sourceEventSeqs: [0],
  })
  const third = await host.preStep([prompt])
  assert.equal(third.messages.length, 2)
  assert.equal(host.requests.length, 2)
})

for (const kind of ['plugin', 'plugin:nowledge-mem']) {
  test(`recall excludes own ${kind} messages from the query`, async () => {
    const host = fixture({ contextOnSessionStart: false })
    const source = kind === 'plugin'
      ? { kind, plugin: 'nowledge-mem', form: 'recall' }
      : { kind, form: 'recall' }
    const injected = userMessage('review irrelevant injected context', source)

    const plain = await host.preStep([userMessage('Calculate two plus two'), injected])
    assert.equal(plain.messages.length, 2)
    assert.equal(host.requests.length, 0)

    await host.preStep([userMessage('review the release decision'), injected])
    assert.equal(host.requests.length, 1)
    assert.match(host.requests[0].command, /m search 'review the release decision'/u)
    assert.doesNotMatch(host.requests[0].command, /irrelevant injected context/u)
  })
}

test('turn-end imports a real host session without own injections or an injected title', { timeout: 2_000 }, async () => {
  const host = fixture()
  const prompt = userMessage('review the previous release decision')
  const decision = await host.preStep([prompt])
  assert.equal(decision.messages.length, 3)
  // Startup context may precede the original question in the durable log.
  for (const message of [...decision.messages.slice(1), prompt]) {
    host.session.append('user/message', message, { surfaceOp: 'append' })
  }
  const event = host.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  host.listeners.get('session/event')(host.session, event)
  await host.importFinished
  await setImmediate()

  assert.equal(host.imports.length, 1)
  assert.equal(host.imports[0].title, 'review the previous release decision')
  assert.deepEqual(host.imports[0].messages.map(message => message.content), ['review the previous release decision'])
  assert.equal(host.requests.at(-1).env.NMEM_IMPORT_ORIGIN, 'deepseek-harness')
  assert.deepEqual(host.warnings, [])
})

test('peer ranges admit the tested host previews and preserve optional runtime peers', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  for (const [name, range] of Object.entries(manifest.peerDependencies)) {
    const versions = name === '@deepseek-ai/cordis'
      ? ['4.0.4', '4.0.5-alpha.1']
      : ['0.1.5-rc.2', '0.1.7-rc.1', '0.2.1-alpha.1']
    for (const version of versions) assert.equal(satisfies(version, range), true, `${name}@${version}`)
    assert.equal(manifest.peerDependenciesMeta[name].optional, true)
    assert.equal(satisfies(name === '@deepseek-ai/cordis' ? '5.0.0' : '0.3.0', range), false)
  }
})
