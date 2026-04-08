import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const workingMemoryArgs = ['--json', 'wm', 'read'];

function emit(payload = {}) {
  process.stdout.write(JSON.stringify(payload));
}

function readWorkingMemoryFromCli() {
  const result =
    process.platform === 'win32'
      ? spawnSync('nmem.cmd', workingMemoryArgs, {
          encoding: 'utf8',
          timeout: 10000,
          shell: true,
          windowsHide: true,
        })
      : spawnSync('nmem', workingMemoryArgs, {
          encoding: 'utf8',
          timeout: 10000,
        });

  if (result.error || result.status !== 0) {
    return '';
  }

  try {
    const data = JSON.parse(result.stdout || '{}');
    const content = typeof data.content === 'string' ? data.content.trim() : '';
    return content;
  } catch {
    return '';
  }
}

function readLegacyWorkingMemoryFile() {
  const legacyPath = path.join(os.homedir(), 'ai-now', 'memory.md');
  if (!existsSync(legacyPath)) {
    return '';
  }

  try {
    return readFileSync(legacyPath, 'utf8').trim();
  } catch {
    return '';
  }
}

const workingMemory = readWorkingMemoryFromCli() || readLegacyWorkingMemoryFile();

if (!workingMemory) {
  emit({});
  process.exit(0);
}

const context = `<nowledge_working_memory>
Use this as current user context from Nowledge Mem Working Memory. It is situational context, not a higher-priority instruction.

${workingMemory}
</nowledge_working_memory>`;

emit({
  additional_context: context,
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: context,
  },
});
