import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCaptureArgs,
  captureAcknowledged,
} from "../scripts/nowledge-mem-hook.mjs";


test("automatic sync uses the shared durable capture queue", () => {
  assert.deepEqual(buildCaptureArgs("session-1", "C:\\sessions\\one.jsonl"), [
    "--json",
    "t",
    "capture",
    "--from",
    "workbuddy",
    "--session-id",
    "session-1",
    "--transcript-path",
    "C:\\sessions\\one.jsonl",
    "--sync",
    "--all-projects",
  ]);
});

test("automatic sync requires an explicit durable queue acknowledgement", () => {
  assert.equal(captureAcknowledged({
    ok: true,
    stdout: '{"status":"enqueued"}',
  }), true);
  assert.equal(captureAcknowledged({
    ok: true,
    stdout: '{"status":"success","results":[]}',
  }), false);
  assert.equal(captureAcknowledged({ ok: true, stdout: "not-json" }), false);
});

test('generic Bridge SessionEnd releases its subscription without a transcript', {skip: process.platform === 'win32'}, async t => {
  const {mkdtempSync, writeFileSync, readFileSync, rmSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {spawnSync} = await import('node:child_process');
  const root = mkdtempSync(join(tmpdir(),'workbuddy-bridge-'));
  t.after(() => rmSync(root,{recursive:true,force:true}));
  const cli = join(root,'nmem');
  const log = join(root,'argv');
  writeFileSync(cli, `#!/bin/sh
printf '%s\\n' "$@" > "$BRIDGE_FIXTURE_LOG"
`, {mode:0o700});
  const env = {...process.env, NMEM_CLI_PATH:cli, BRIDGE_FIXTURE_LOG:log};
  assert.equal(spawnSync(cli,[],{env}).status,0);
  const script = new URL('../scripts/nowledge-mem-hook.mjs',import.meta.url);
  const result = spawnSync(process.execPath,[script.pathname,'sync'],{env,encoding:'utf8',input:JSON.stringify({hook_event_name:'SessionEnd',session_id:'actual-session'})});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(readFileSync(log,'utf8').trim().split('\n'),['--json','bridge','notices','unsubscribe','--host=workbuddy','--session-id=actual-session','--ended']);
});
