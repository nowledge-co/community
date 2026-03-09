import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function readHookInput() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const hookInput = readHookInput();
const cwd = typeof hookInput.cwd === 'string' && hookInput.cwd.trim()
  ? hookInput.cwd
  : process.cwd();
const sessionId = typeof hookInput.session_id === 'string' && hookInput.session_id.trim()
  ? hookInput.session_id
  : undefined;

const args = ['--json', 't', 'save', '--from', 'gemini-cli', '-p', cwd, '--truncate'];
if (sessionId) {
  args.push('--session-id', sessionId);
}

spawnSync('nmem', args, {
  encoding: 'utf8',
  timeout: 20000,
});

process.stdout.write(JSON.stringify({ suppressOutput: true }));
