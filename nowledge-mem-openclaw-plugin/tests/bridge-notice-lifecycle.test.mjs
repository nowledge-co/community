import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import plugin from '../src/index.js';

test('generic Bridge cleanup works with capture disabled and allows resumed startup', {skip: process.platform === 'win32'}, t => {
  const root = mkdtempSync(join(tmpdir(), 'openclaw-bridge-'));
  const log = join(root, 'argv');
  const cli = join(root, 'nmem');
  const keys = ['NMEM_CLI_PATH', 'NMEM_AGENT_CONTEXT', 'NMEM_BRIDGE_INBOX_ON_START', 'NMEM_NO_MAILBOX_NOTICE', 'BRIDGE_FIXTURE_LOG'];
  const previous = keys.map(key => process.env[key]);
  t.after(() => { keys.forEach((key,i) => previous[i] === undefined ? delete process.env[key] : process.env[key] = previous[i]); rmSync(root,{recursive:true,force:true}); });
  Object.assign(process.env,{NMEM_CLI_PATH:cli, NMEM_AGENT_CONTEXT:'fixture', NMEM_BRIDGE_INBOX_ON_START:'1', NMEM_NO_MAILBOX_NOTICE:'0', BRIDGE_FIXTURE_LOG:log});
  writeFileSync(cli, `#!/bin/sh
printf '%s\\n' "$@" > "$BRIDGE_FIXTURE_LOG"
printf '%s' '{"notices":[]}'
`, {mode:0o700});
  assert.equal(spawnSync(cli, [], {env:process.env}).status,0);
  const hooks = new Map();
  plugin.register({id:plugin.id, logger:{info(){},debug(){},warn(){}}, runtime:{system:{}}, pluginConfig:{sessionDigest:false,sessionContext:false,corpusSupplement:false}, registerTool(){}, registerCommand(){}, registerCli(){}, registerContextEngine(){}, on(name, fn){hooks.set(name,[...(hooks.get(name)||[]),fn]);}});
  assert.equal(hooks.get('session_end').length, 1);
  const prompt = hooks.get('before_prompt_build').at(-1);
  const ctx = {sessionId:'actual-session', sessionKey:'agent:fixture:main'};
  assert.match(prompt({},ctx).prependContext, /Host session correlation/);
  assert.equal(prompt({},ctx), undefined);
  hooks.get('session_end')[0]({sessionId:ctx.sessionId},ctx);
  assert.deepEqual(readFileSync(log,'utf8').trim().split('\n'), ['--json','bridge','notices','unsubscribe','--host=openclaw','--session-id=actual-session','--ended']);
  assert.match(prompt({},ctx).prependContext, /Host session correlation/);
});
