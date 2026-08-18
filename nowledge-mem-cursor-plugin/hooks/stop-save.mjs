import { createHash } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  envValue,
  findNmemCommand,
  runNmemJson,
  withStartupScopeArgs,
} from './nmem-runtime.mjs';

const ATTEMPT_DELAYS_MS = [0, 500, 1500, 3000];
const ATTEMPT_TIMEOUT_MS = 8000;
const INTERNAL_BUDGET_MS = 30000;
const CLAIM_STALE_MS = 90000;
const LOG_MAX_BYTES = 1024 * 1024;

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function workspaceRoot(payload) {
  if (!Array.isArray(payload.workspace_roots)) {
    return '';
  }
  const root = payload.workspace_roots.find((value) => typeof value === 'string' && value.trim());
  return root ? root.trim() : '';
}

export function resolveCapture(payload, env = process.env, cwd = process.cwd()) {
  return {
    conversationId: firstString(payload.conversation_id, payload.session_id),
    generationId: firstString(payload.generation_id),
    project: firstString(envValue('CURSOR_PROJECT_DIR', env), workspaceRoot(payload), cwd),
    transcriptPath: firstString(payload.transcript_path, envValue('CURSOR_TRANSCRIPT_PATH', env)),
  };
}

export function buildSaveArgs(capture, env = process.env) {
  if (!capture.conversationId || !capture.project) {
    return [];
  }

  const args = [
    't',
    'capture',
    '--from',
    'cursor',
    '--project',
    capture.project,
    '--session-id',
    capture.conversationId,
  ];
  if (capture.transcriptPath) {
    args.push('--transcript-path', capture.transcriptPath);
  }
  return withStartupScopeArgs(args, env);
}

export function buildLegacySaveArgs(capture, env = process.env) {
  if (!capture.conversationId || !capture.project) {
    return [];
  }

  return withStartupScopeArgs([
    't',
    'save',
    '--from',
    'cursor',
    '--truncate',
    '--project',
    capture.project,
    '--session-id',
    capture.conversationId,
  ], env);
}

function transcriptFingerprint(transcriptPath) {
  if (!transcriptPath) {
    return '';
  }
  try {
    const stat = statSync(transcriptPath);
    return `${stat.size}:${Math.floor(stat.mtimeMs)}`;
  } catch {
    return transcriptPath;
  }
}

export function captureKey(capture) {
  const eventIdentity = capture.generationId || transcriptFingerprint(capture.transcriptPath);
  const identity = [capture.conversationId, eventIdentity].join('\0');
  return createHash('sha256').update(identity).digest('hex');
}

function defaultStateRoot(env) {
  return envValue('NMEM_CURSOR_HOOK_STATE_DIR', env) ||
    path.join(os.homedir(), '.cursor', 'nowledge-mem', 'hooks');
}

function cleanupStaleClaims(stateRoot, now) {
  try {
    for (const name of readdirSync(stateRoot)) {
      if (!name.endsWith('.lock')) {
        continue;
      }
      const claimPath = path.join(stateRoot, name);
      try {
        if (now - statSync(claimPath).mtimeMs > CLAIM_STALE_MS) {
          unlinkSync(claimPath);
        }
      } catch {
        // Another hook may have removed this claim concurrently.
      }
    }
  } catch {
    // Claim cleanup is best effort.
  }
}

export function acquireClaim(key, options = {}) {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const stateRoot = options.stateRoot ?? defaultStateRoot(env);
  let descriptor;
  try {
    mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
    cleanupStaleClaims(stateRoot, now);
    const claimPath = path.join(stateRoot, `${key}.lock`);
    const completedPath = path.join(stateRoot, `${key}.done`);
    try {
      statSync(completedPath);
      return { acquired: false, claimPath: '', completedPath, stateRoot };
    } catch {
      // No completed marker means this event still needs capture.
    }
    descriptor = openSync(claimPath, 'wx', 0o600);
    writeFileSync(descriptor, `${now}\n`, 'utf8');
    closeSync(descriptor);
    descriptor = undefined;
    return { acquired: true, claimPath, completedPath, stateRoot };
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Descriptor cleanup is best effort.
      }
    }
    if (error && error.code === 'EEXIST') {
      return { acquired: false, claimPath: '', stateRoot };
    }
    return { acquired: true, claimPath: '', stateRoot };
  }
}

function completeClaim(claim) {
  if (!claim?.completedPath) {
    return;
  }
  try {
    writeFileSync(claim.completedPath, `${Date.now()}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Completed markers are best effort; the persisted thread remains source of truth.
  }
}

function releaseClaim(claim) {
  if (!claim?.claimPath) {
    return;
  }
  try {
    unlinkSync(claim.claimPath);
  } catch {
    // Claim release is best effort.
  }
}

function logEvent(event, options = {}) {
  const env = options.env ?? process.env;
  const stateRoot = options.stateRoot ?? defaultStateRoot(env);
  const logPath = envValue('NMEM_CURSOR_HOOK_LOG', env) || path.join(stateRoot, 'stop-save.log');
  try {
    mkdirSync(path.dirname(logPath), { recursive: true, mode: 0o700 });
    try {
      if (statSync(logPath).size > LOG_MAX_BYTES) {
        writeFileSync(logPath, '', { encoding: 'utf8', mode: 0o600 });
      }
    } catch {
      // A missing log file is expected on first use.
    }
    appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    // Hook logging must never block Cursor.
  }
}

function saveResultHasThread(result) {
  return result.ok && (
    result.data?.status === 'enqueued' ||
    (Array.isArray(result.data?.results) && result.data.results.length > 0)
  );
}

function captureCommandUnsupported(result) {
  const detail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.toLowerCase();
  return [
    'unknown command: capture',
    "unrecognized subcommand 'capture'",
    'unrecognized subcommand "capture"',
    "invalid value 'capture'",
  ].some((marker) => detail.includes(marker));
}

const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

export async function saveCapture(capture, options = {}) {
  const env = options.env ?? process.env;
  const args = buildSaveArgs(capture, env);
  const legacyArgs = buildLegacySaveArgs(capture, env);
  const command = options.command ?? findNmemCommand(env);
  if (args.length === 0 || !command) {
    const reason = args.length === 0 ? 'missing-identity' : 'cli-unavailable';
    logEvent({ event: 'skipped', reason }, { env, stateRoot: options.stateRoot });
    return { saved: false, reason };
  }

  const claim = acquireClaim(captureKey(capture), {
    env,
    now: options.now,
    stateRoot: options.stateRoot,
  });
  if (!claim.acquired) {
    return { saved: false, reason: 'duplicate' };
  }

  const run = options.runNmem ?? runNmemJson;
  const sleep = options.sleep ?? wait;
  const clock = options.clock ?? Date.now;
  const deadline = clock() + INTERNAL_BUDGET_MS;
  let saved = false;
  try {
    for (let attempt = 0; attempt < ATTEMPT_DELAYS_MS.length; attempt += 1) {
      const remainingBeforeDelay = deadline - clock();
      if (remainingBeforeDelay <= 0) {
        break;
      }
      await sleep(Math.min(ATTEMPT_DELAYS_MS[attempt], remainingBeforeDelay));
      const remaining = deadline - clock();
      if (remaining <= 0) {
        break;
      }
      let result;
      try {
        result = run(args, {
          command,
          env,
          timeoutMs: Math.min(ATTEMPT_TIMEOUT_MS, remaining),
        });
      } catch {
        result = { ok: false, data: null };
      }
      if (captureCommandUnsupported(result)) {
        const legacyRemaining = deadline - clock();
        if (legacyRemaining <= 0) {
          continue;
        }
        try {
          result = run(legacyArgs, {
            command,
            env,
            timeoutMs: Math.min(ATTEMPT_TIMEOUT_MS, legacyRemaining),
          });
        } catch {
          result = { ok: false, data: null };
        }
      }
      if (saveResultHasThread(result)) {
        saved = true;
        completeClaim(claim);
        return { saved: true, reason: 'saved', attempts: attempt + 1 };
      }
    }
  } finally {
    releaseClaim(claim);
  }

  logEvent(
    { event: 'failed', conversation_id: capture.conversationId, attempts: ATTEMPT_DELAYS_MS.length },
    { env, stateRoot: claim.stateRoot },
  );
  return { saved: false, reason: 'save-failed', attempts: ATTEMPT_DELAYS_MS.length };
}

async function readHookInput(stream = process.stdin) {
  let input = '';
  for await (const chunk of stream) {
    input += chunk;
  }
  try {
    const payload = JSON.parse(input || '{}');
    return payload && typeof payload === 'object' ? payload : {};
  } catch {
    return {};
  }
}

export async function main() {
  try {
    const payload = await readHookInput();
    await saveCapture(resolveCapture(payload));
  } catch {
    // Transcript capture is best effort and must never block Cursor.
  }
  process.stdout.write('{}\n');
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entrypoint) {
  await main();
}
