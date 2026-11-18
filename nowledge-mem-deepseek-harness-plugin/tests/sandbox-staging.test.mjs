import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { importSession, shellQuote } from '../src/index.js'

// Match the upstream workspace-write mount namespace. Availability is checked
// explicitly: many CI kernels disable unprivileged user namespaces entirely.
const profile = ['--ro-bind', '/', '/', '--dev', '/dev', '--unshare-pid', '--proc', '/proc', '--die-with-parent', '--tmpfs', '/tmp', '--']
const available = process.platform === 'linux' && spawnSync('bwrap', [...profile, '/bin/true']).status === 0

test('workspace-write bwrap hides host tmp but can read the actual staged import', { skip: available ? false : 'requires Linux bwrap with permitted user namespaces' }, async () => {
  const hidden = await mkdtemp(join(tmpdir(), 'dsh-hidden-'))
  try {
    const hiddenFile = join(hidden, 'payload.json')
    await writeFile(hiddenFile, '{}')
    assert.notEqual(spawnSync('bwrap', [...profile, '/bin/test', '-r', hiddenFile]).status, 0)
    let attempts = 0
    const ctx = { shell: { resolve: r => r, execute: async request => {
      attempts++
      const match = request.command.match(/--file (?:'([^']+)'|(\S+))/u)
      const file = match[1] ?? match[2]
      const run = spawnSync('bwrap', [...profile, '/bin/sh', '-c', `cat ${shellQuote(file)}`], { encoding: 'utf8' })
      assert.equal(run.status, 0, run.stderr)
      const payload = JSON.parse(run.stdout)
      assert.equal(payload.messages[0].content, 'synthetic sandbox question')
      return { result: async () => ({ exitCode: 0, stdout: { text: JSON.stringify({ success: true, results: [{ success: true, message_count: 1 }] }) } }) }
    } } }
    const current = { header: { id: 'sandbox-qa' }, events: [{ seq: 0, type: 'user/message', data: { id: 'q', source: { kind: 'user' }, content: 'synthetic sandbox question' } }] }
    const result = await importSession(ctx, { cliPath: 'nmem', sourceApp: 'deepseek-harness', maxThreadMessageChars: 1000 }, current)
    assert.equal(result.count, 1)
    assert.equal(attempts, 1)
  } finally { await rm(hidden, { recursive: true, force: true }) }
})
