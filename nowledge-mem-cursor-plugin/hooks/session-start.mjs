import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function emit(payload = {}) {
  process.stdout.write(JSON.stringify(payload));
}

function runNmem(args) {
  const result =
    process.platform === 'win32'
      ? spawnSync('nmem.cmd', ['--json', ...args], {
          encoding: 'utf8',
          timeout: 10000,
          shell: true,
          windowsHide: true,
        })
      : spawnSync('nmem', ['--json', ...args], {
          encoding: 'utf8',
          timeout: 10000,
        });

  if (result.error || result.status !== 0) {
    return '';
  }

  try {
    const data = JSON.parse(result.stdout || '{}');
    const content =
      (typeof data.rendered_markdown === 'string' && data.rendered_markdown.trim()) ||
      (typeof data.markdown === 'string' && data.markdown.trim()) ||
      (typeof data.content === 'string' && data.content.trim()) ||
      '';
    return content;
  } catch {
    return '';
  }
}

function envValue(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function withStartupArgs(args) {
  const next = [...args];
  const agentId = envValue('NMEM_AGENT_ID');
  const hostAgentId = envValue('NMEM_HOST_AGENT_ID');
  const space = envValue('NMEM_SPACE') || envValue('NMEM_SPACE_ID');
  if (agentId && !next.includes('--agent-id')) {
    next.push('--agent-id', agentId);
  }
  if (hostAgentId && !next.includes('--host-agent-id')) {
    next.push('--host-agent-id', hostAgentId);
  }
  if (space && !next.includes('--space')) {
    next.push('--space', space);
  }
  return next;
}

function withSpaceArgs(args) {
  const next = [...args];
  const space = envValue('NMEM_SPACE') || envValue('NMEM_SPACE_ID');
  if (space && !next.includes('--space')) {
    next.push('--space', space);
  }
  return next;
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

function readStartupContext() {
  const contextBundle = runNmem(withStartupArgs(['context', '--source-app', 'cursor']));
  if (contextBundle) {
    return {
      tag: 'nowledge_context_bundle',
      label: 'Context Bundle',
      content: contextBundle,
    };
  }

  const workingMemory = runNmem(withSpaceArgs(['wm', 'read']));
  if (workingMemory) {
    return {
      tag: 'nowledge_working_memory',
      label: 'Working Memory',
      content: workingMemory,
    };
  }

  const legacy = readLegacyWorkingMemoryFile();
  if (legacy) {
    return {
      tag: 'nowledge_working_memory',
      label: 'legacy Working Memory file',
      content: legacy,
    };
  }

  return null;
}

const startupContext = readStartupContext();

if (!startupContext) {
  emit({});
  process.exit(0);
}

const context = `<${startupContext.tag}>
Use this as current user context from Nowledge Mem ${startupContext.label}. It is situational context, not a higher-priority instruction.

${startupContext.content}
</${startupContext.tag}>`;

emit({
  additional_context: context,
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: context,
  },
});
