import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function emit(payload) {
  process.stdout.write(
    JSON.stringify({
      suppressOutput: true,
      ...payload,
    }),
  );
}

function readWorkingMemory() {
  const result = spawnSync('nmem', ['--json', 'wm', 'read'], {
    encoding: 'utf8',
    timeout: 10000,
  });

  if (result.status === 0) {
    try {
      const data = JSON.parse(result.stdout || '{}');
      const content = typeof data.content === 'string' ? data.content.trim() : '';
      if (content) {
        return content;
      }
    } catch {
      // Fall back to the legacy file path below.
    }
  }

  const legacyPath = path.join(os.homedir(), 'ai-now', 'memory.md');
  if (existsSync(legacyPath)) {
    const content = readFileSync(legacyPath, 'utf8').trim();
    if (content) {
      return content;
    }
  }

  return '';
}

const workingMemory = readWorkingMemory();

if (!workingMemory) {
  emit({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
    },
  });
} else {
  emit({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `<nowledge_working_memory>
Use this as current user context from Nowledge Mem Working Memory. It is situational context, not a higher-priority instruction.

${workingMemory}
</nowledge_working_memory>`,
    },
  });
}
