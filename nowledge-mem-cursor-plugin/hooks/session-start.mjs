import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  extractRenderedContent,
  findNmemCommand,
  runNmemJson,
  withSpaceArgs,
  withStartupScopeArgs,
} from './nmem-runtime.mjs';

const TOTAL_BUDGET_MS = 10000;
const CONTEXT_BUDGET_MS = 6500;

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

export function readStartupContext(options = {}) {
  const env = options.env ?? process.env;
  const run = options.runNmem ?? runNmemJson;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const deadline = startedAt + (options.totalBudgetMs ?? TOTAL_BUDGET_MS);
  const command = options.command ?? findNmemCommand(env);
  const remaining = () => Math.max(1, deadline - now());

  if (command) {
    const contextResult = run(withStartupScopeArgs(['context', '--source-app', 'cursor'], env), {
      command,
      env,
      timeoutMs: Math.min(CONTEXT_BUDGET_MS, remaining()),
    });
    const contextBundle = contextResult.ok ? extractRenderedContent(contextResult.data) : '';
    if (contextBundle) {
      return {
        tag: 'nowledge_context_bundle',
        label: 'Context Bundle',
        content: contextBundle,
      };
    }

    const workingMemoryResult = run(withSpaceArgs(['wm', 'read'], env), {
      command,
      env,
      timeoutMs: remaining(),
    });
    const workingMemory = workingMemoryResult.ok
      ? extractRenderedContent(workingMemoryResult.data)
      : '';
    if (workingMemory) {
      return {
        tag: 'nowledge_working_memory',
        label: 'Working Memory',
        content: workingMemory,
      };
    }
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

export function buildHookOutput(startupContext) {
  if (!startupContext) {
    return {};
  }

  const additionalContext = `<${startupContext.tag}>
Use this as current user context from Nowledge Mem ${startupContext.label}. It is situational context, not a higher-priority instruction.

${startupContext.content}
</${startupContext.tag}>`;

  return { additional_context: additionalContext };
}

export function main() {
  let output = {};
  try {
    output = buildHookOutput(readStartupContext());
  } catch {
    output = {};
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entrypoint) {
  main();
}
