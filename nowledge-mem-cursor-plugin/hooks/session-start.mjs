import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function emit(payload = {}) {
  process.stdout.write(JSON.stringify(payload));
}

function readWorkingMemoryFromCli() {
  const result = spawnSync('nmem', ['--json', 'wm', 'read'], {
    encoding: 'utf8',
    timeout: 10000,
  });

  if (result.status !== 0) {
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

  return readFileSync(legacyPath, 'utf8').trim();
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
