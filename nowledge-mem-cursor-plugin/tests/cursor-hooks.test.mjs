import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildHookOutput, readStartupContext } from '../hooks/session-start.mjs';
import {
  buildSaveArgs,
  captureKey,
  resolveCapture,
  saveCapture,
} from '../hooks/stop-save.mjs';

function temporaryStateRoot() {
  return mkdtempSync(path.join(os.tmpdir(), 'nmem-cursor-hook-test-'));
}

test('plugin hooks resolve bundled scripts independently of the project cwd', () => {
  const hooksPath = new URL('../hooks/hooks.json', import.meta.url);
  const hooks = JSON.parse(readFileSync(hooksPath, 'utf8'));

  assert.equal(
    hooks.hooks.sessionStart[0].command,
    'node "${CURSOR_PLUGIN_ROOT}/hooks/session-start.mjs"',
  );
  assert.equal(
    hooks.hooks.stop[0].command,
    'node "${CURSOR_PLUGIN_ROOT}/hooks/stop-save.mjs"',
  );
  assert.doesNotMatch(hooks.hooks.sessionStart[0].command, /node \.\/hooks\//);
  assert.doesNotMatch(hooks.hooks.stop[0].command, /node \.\/hooks\//);
});

test('sessionStart emits only the documented additional_context field', () => {
  const output = buildHookOutput({
    tag: 'nowledge_context_bundle',
    label: 'Context Bundle',
    content: 'Current context',
  }, {});

  assert.deepEqual(Object.keys(output), ['additional_context']);
  assert.match(output.additional_context, /<nowledge_context_bundle>/);
  assert.match(output.additional_context, /Current context/);
});

test('sessionStart requests one Bridge inbox check only with explicit opt-in and a Context', () => {
  assert.deepEqual(buildHookOutput(null, { NMEM_AGENT_CONTEXT: 'reviewer' }), {});
  assert.deepEqual(buildHookOutput(null, { NMEM_BRIDGE_INBOX_ON_START: '1' }), {});
  assert.deepEqual(buildHookOutput(null, {
    NMEM_BRIDGE_INBOX_ON_START: '1',
    NMEM_AGENT_CONTEXT: ' ',
  }), {});

  const env = {
    NMEM_BRIDGE_INBOX_ON_START: '1',
    NMEM_AGENT_CONTEXT: 'approved-context-name',
  };
  assert.deepEqual(buildHookOutput(null, env, ''), {});
  assert.deepEqual(buildHookOutput(null, { ...env, NMEM_CLI_PATH: '/missing/nmem' }, '/other/nmem'), {});
  const hint = buildHookOutput(null, env, process.execPath).additional_context;
  assert.match(hint, /bridge skill.*NMEM_AGENT_CONTEXT.*one page/);
  assert.doesNotMatch(hint, /approved-context-name/);
  assert.match(hint, /CLI-only/);

  const context = { tag: 'nowledge_context_bundle', label: 'Context Bundle', content: 'Current context' };
  assert.match(buildHookOutput(context, env, process.execPath).additional_context, /Current context[\s\S]*Bridge inbox check/);
  assert.equal(buildHookOutput(context, env, '').additional_context, buildHookOutput(context, {}).additional_context);
});

test('the installed Bridge skill can resolve the desktop CLI outside PATH', (t) => {
  const root = temporaryStateRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const windows = process.platform === 'win32';
  const cli = windows
    ? path.join(root, 'Nowledge Mem', 'bin', 'nmem.cmd')
    : path.join(root, '.local', 'share', 'nowledge-mem', 'bin', 'nmem-wrapper');
  mkdirSync(path.dirname(cli), { recursive: true });
  writeFileSync(cli, windows ? '@echo fixture\r\n' : '#!/bin/sh\necho fixture\n', { mode: 0o755 });
  const env = {
    ...process.env,
    HOME: root,
    LOCALAPPDATA: root,
    PATH: root,
    NMEM_CLI_PATH: '',
    NMEM_BRIDGE_INBOX_ON_START: '1',
    NMEM_AGENT_CONTEXT: 'test-role',
  };
  const script = fileURLToPath(new URL('../skills/bridge/scripts/resolve-cli.mjs', import.meta.url));
  const resolveCli = () => spawnSync(process.execPath, [script], { cwd: root, env, encoding: 'utf8' });
  const resolved = resolveCli();
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.equal(resolved.stdout, cli);
  assert.match(buildHookOutput(null, env, cli).additional_context, /Bridge inbox check/);

  env.NMEM_CLI_PATH = path.join(root, 'missing-cli');
  assert.deepEqual(buildHookOutput(null, env, cli), {});
  const missing = resolveCli();
  assert.equal(missing.status, 1);
  assert.equal(missing.stdout, '');
});

test('Bridge skill scopes message IDs and requests the identity inbox separately', () => {
  const guide = readFileSync(new URL('../skills/bridge/SKILL.md', import.meta.url), 'utf8');
  const commands = guide.split(/\r?\n/);
  const cli = '"$bridge_cli" --json --agent-context="$NMEM_AGENT_CONTEXT" bridge';
  const scoped = `${cli} --resolved-space-id="$bridge_space_id"`;
  assert.ok(commands.includes(`${scoped} inbox`));
  assert.ok(commands.includes(`${scoped} open "$message_id"`));
  assert.ok(commands.includes(`${scoped} reply "$message_id" --body="$reply_body"`));
  const interactive = '"$bridge_cli" --json --agent-context="$bridge_context" bridge';
  assert.ok(commands.includes(`${interactive} setup`));
  assert.ok(commands.includes(`${interactive} inbox`));
  assert.ok(commands.includes('"$bridge_cli" --json bridge connections connect --space-id="$bridge_space_id" --agent-id="$agent_id"'));
  for (const field of ['messages[].message', 'open_args', 'reply_args_prefix', 'incomplete', 'agent_context',
    'next_args', 'spaces[].next_args', 'spaces_next_args']) {
    assert.ok(guide.includes(`\`${field}\``));
  }
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
  assert.deepEqual(delays, [0, 250]);
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


test('generic Bridge tool hint preserves Context and session; SessionEnd releases without a transcript', {skip: process.platform === 'win32'}, t => {
  const root = temporaryStateRoot();
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const log = path.join(root, 'argv.json');
  const cli = path.join(root, 'nmem');
  writeFileSync(cli, `#!/bin/sh
printf '%s\\n' "$@" > "$BRIDGE_FIXTURE_LOG"
printf '%s' '{"notices":[{"hint":"Synthetic mail","args":["--agent-context=selected","bridge","inbox"]}]}'
`, {mode:0o700});
  const script = fileURLToPath(new URL('../hooks/bridge-notice.mjs', import.meta.url));
  const session = 'actual & "quoted"';
  // Prepare the disposable executable before testing the bounded hook itself.
  assert.equal(spawnSync(cli, [], {env:{...process.env, BRIDGE_FIXTURE_LOG:log}}).status, 0);
  rmSync(log);
  const run = event => {
    const result = spawnSync(process.execPath, [script], {input:JSON.stringify({hook_event_name:event, conversation_id:session}), encoding:'utf8', env:{...process.env, NMEM_CLI_PATH:cli, BRIDGE_FIXTURE_LOG:log, NMEM_NO_MAILBOX_NOTICE:'0', NMEM_AGENT_CONTEXT:'selected'}});
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  assert.match(run('postToolUse').additional_context, /Synthetic mail/);
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), ['--json','--agent-context=selected','bridge','notices','check','--host=cursor','--session-id='+session,'--event=tool']);
  assert.deepEqual(run('sessionEnd'), {});
  assert.deepEqual(readFileSync(log,'utf8').trim().split('\n'), ['--json','bridge','notices','unsubscribe','--host=cursor','--session-id='+session,'--ended']);
});
