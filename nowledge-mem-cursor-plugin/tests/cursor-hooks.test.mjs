import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildHookOutput, readStartupContext } from '../hooks/session-start.mjs';
import {
  buildLegacySaveArgs,
  buildSaveArgs,
  captureKey,
  resolveCapture,
  saveCapture,
} from '../hooks/stop-save.mjs';

function temporaryStateRoot() {
  return mkdtempSync(path.join(os.tmpdir(), 'nmem-cursor-hook-test-'));
}

test('sessionStart emits only the documented additional_context field', () => {
  const output = buildHookOutput({
    tag: 'nowledge_context_bundle',
    label: 'Context Bundle',
    content: 'Current context',
  });

  assert.deepEqual(Object.keys(output), ['additional_context']);
  assert.match(output.additional_context, /<nowledge_context_bundle>/);
  assert.match(output.additional_context, /Current context/);
});

test('sessionStart shares one ten-second budget across CLI fallbacks', () => {
  let elapsed = 0;
  const timeouts = [];
  readStartupContext({
    command: '/fake/nmem',
    now: () => elapsed,
    runNmem: (_args, options) => {
      timeouts.push(options.timeoutMs);
      elapsed += options.timeoutMs;
      return { ok: false, data: null };
    },
  });

  assert.deepEqual(timeouts, [6500, 3500]);
  assert.equal(timeouts.reduce((total, value) => total + value, 0), 10000);
});

test('stop capture resolves exact Cursor identity and builds scoped save args', () => {
  const env = {
    CURSOR_PROJECT_DIR: '/workspace/project',
    CURSOR_TRANSCRIPT_PATH: '/cursor/transcript.jsonl',
    NMEM_AGENT_ID: 'cursor-agent',
    NMEM_SPACE: 'engineering',
  };
  const capture = resolveCapture(
    {
      conversation_id: 'conversation-123',
      generation_id: 'generation-456',
      workspace_roots: ['/ignored/workspace'],
    },
    env,
    '/ignored/cwd',
  );

  assert.deepEqual(capture, {
    conversationId: 'conversation-123',
    generationId: 'generation-456',
    project: '/workspace/project',
    transcriptPath: '/cursor/transcript.jsonl',
  });
  assert.deepEqual(buildSaveArgs(capture, env), [
    't',
    'capture',
    '--from',
    'cursor',
    '--project',
    '/workspace/project',
    '--session-id',
    'conversation-123',
    '--transcript-path',
    '/cursor/transcript.jsonl',
    '--agent-id',
    'cursor-agent',
    '--space',
    'engineering',
  ]);
});

test('stop capture refuses to select a latest session without an exact conversation id', () => {
  assert.deepEqual(
    buildSaveArgs({ conversationId: '', project: '/workspace/project' }, {}),
    [],
  );
});

test('stop capture falls back to the legacy save command on an older CLI', async (context) => {
  const stateRoot = temporaryStateRoot();
  context.after(() => rmSync(stateRoot, { recursive: true, force: true }));
  const capture = {
    conversationId: 'conversation-legacy',
    generationId: 'generation-legacy',
    project: '/workspace/project',
    transcriptPath: '/cursor/transcript.jsonl',
  };
  const calls = [];

  const result = await saveCapture(capture, {
    command: '/fake/nmem',
    env: { NMEM_SPACE: 'engineering' },
    stateRoot,
    sleep: async () => {},
    runNmem: (args) => {
      calls.push(args);
      if (args.includes('capture')) {
        return { ok: false, data: null, stderr: 'error: unknown command: capture' };
      }
      return { ok: true, data: { results: [{ action: 'created' }] } };
    },
  });

  assert.deepEqual(result, { saved: true, reason: 'saved', attempts: 1 });
  assert.deepEqual(calls, [
    buildSaveArgs(capture, { NMEM_SPACE: 'engineering' }),
    buildLegacySaveArgs(capture, { NMEM_SPACE: 'engineering' }),
  ]);
  assert.ok(calls[1].includes('--truncate'));
  assert.ok(!calls[1].includes('--transcript-path'));
});

test('duplicate identity stays stable while the same generation transcript is flushing', () => {
  const first = captureKey({
    conversationId: 'conversation-123',
    generationId: 'generation-456',
    transcriptPath: '/cursor/transcript-before-flush.jsonl',
  });
  const second = captureKey({
    conversationId: 'conversation-123',
    generationId: 'generation-456',
    transcriptPath: '/cursor/transcript-after-flush.jsonl',
  });
  const nextGeneration = captureKey({
    conversationId: 'conversation-123',
    generationId: 'generation-789',
    transcriptPath: '/cursor/transcript-after-flush.jsonl',
  });

  assert.equal(first, second);
  assert.notEqual(first, nextGeneration);
});

test('stop capture retries transcript flush and suppresses duplicate delivery', async (context) => {
  const stateRoot = temporaryStateRoot();
  context.after(() => rmSync(stateRoot, { recursive: true, force: true }));
  const capture = {
    conversationId: 'conversation-retry',
    generationId: 'generation-retry',
    project: '/workspace/project',
    transcriptPath: '',
  };
  const delays = [];
  let attempts = 0;
  const options = {
    command: '/fake/nmem',
    env: {},
    stateRoot,
    sleep: async (delay) => delays.push(delay),
    runNmem: () => {
      attempts += 1;
      return {
        ok: true,
        data: attempts === 1 ? { status: 'success', results: [] } : { status: 'enqueued' },
      };
    },
  };

  const first = await saveCapture(capture, options);
  const second = await saveCapture(capture, options);

  assert.deepEqual(first, { saved: true, reason: 'saved', attempts: 2 });
  assert.deepEqual(second, { saved: false, reason: 'duplicate' });
  assert.deepEqual(delays, [0, 500]);
  assert.equal(attempts, 2);
});

test('failed capture releases its claim so a later stop can retry', async (context) => {
  const stateRoot = temporaryStateRoot();
  context.after(() => rmSync(stateRoot, { recursive: true, force: true }));
  const capture = {
    conversationId: 'conversation-failure',
    generationId: 'generation-failure',
    project: '/workspace/project',
    transcriptPath: '',
  };
  const baseOptions = {
    command: '/fake/nmem',
    env: {},
    stateRoot,
    sleep: async () => {},
  };

  const failed = await saveCapture(capture, {
    ...baseOptions,
    runNmem: () => {
      throw new Error('simulated CLI failure');
    },
  });
  const retried = await saveCapture(capture, {
    ...baseOptions,
    runNmem: () => ({ ok: true, data: { status: 'enqueued' } }),
  });

  assert.deepEqual(failed, { saved: false, reason: 'save-failed', attempts: 4 });
  assert.deepEqual(retried, { saved: true, reason: 'saved', attempts: 1 });
});
