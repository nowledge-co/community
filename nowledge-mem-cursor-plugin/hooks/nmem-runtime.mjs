import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

export function envValue(name, env = process.env) {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function pathCandidates(env) {
  const pathValue = envValue('PATH', env);
  if (!pathValue) {
    return [];
  }

  const names = process.platform === 'win32' ? ['nmem.exe', 'nmem.cmd', 'nmem.bat'] : ['nmem'];
  return pathValue
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((directory) => names.map((name) => path.join(directory, name)));
}

function knownCandidates(env) {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return [
      envValue('LOCALAPPDATA', env) && path.join(envValue('LOCALAPPDATA', env), 'Nowledge Mem', 'bin', 'nmem.cmd'),
      envValue('LOCALAPPDATA', env) && path.join(envValue('LOCALAPPDATA', env), 'Programs', 'Nowledge Mem', 'nmem.cmd'),
      envValue('APPDATA', env) && path.join(envValue('APPDATA', env), 'Nowledge Mem', 'bin', 'nmem.cmd'),
      envValue('ProgramFiles', env) && path.join(envValue('ProgramFiles', env), 'Nowledge Mem', 'nmem.cmd'),
    ].filter(Boolean);
  }

  return [
    path.join(home, '.local', 'share', 'nowledge-mem', 'bin', 'nmem-wrapper'),
    '/usr/local/bin/nmem',
    path.join(home, '.local', 'bin', 'nmem'),
    '/opt/homebrew/bin/nmem',
    '/usr/bin/nmem',
  ];
}

export function findNmemCommand(env = process.env) {
  const configured = envValue('NMEM_CLI_PATH', env);
  const candidates = [configured, ...pathCandidates(env), ...knownCandidates(env)].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || '';
}

export function runNmemJson(args, options = {}) {
  const env = options.env ?? process.env;
  const command = options.command || findNmemCommand(env);
  if (!command) {
    return {
      ok: false,
      data: null,
      stdout: '',
      stderr: '',
      status: null,
      error: new Error('nmem CLI not found'),
    };
  }

  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? 10000));
  const useShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
  const maxBuffer = Math.max(1, Math.floor(options.maxBuffer ?? DEFAULT_MAX_BUFFER_BYTES));
  const result = spawnSync(command, ['--json', ...args], {
    encoding: 'utf8',
    env,
    maxBuffer,
    shell: useShell,
    timeout: timeoutMs,
    windowsHide: true,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  if (result.error || result.status !== 0) {
    return {
      ok: false,
      data: null,
      stdout,
      stderr,
      status: result.status,
      error: result.error ?? null,
    };
  }

  try {
    return {
      ok: true,
      data: JSON.parse(stdout || '{}'),
      stdout,
      stderr,
      status: result.status,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      stdout,
      stderr,
      status: result.status,
      error,
    };
  }
}

export function extractRenderedContent(data) {
  if (!data || typeof data !== 'object') {
    return '';
  }

  return (
    (typeof data.rendered_markdown === 'string' && data.rendered_markdown.trim()) ||
    (typeof data.markdown === 'string' && data.markdown.trim()) ||
    (typeof data.content === 'string' && data.content.trim()) ||
    ''
  );
}

export function withStartupScopeArgs(args, env = process.env) {
  const next = [...args];
  const agentId = envValue('NMEM_AGENT_ID', env);
  const hostAgentId = envValue('NMEM_HOST_AGENT_ID', env);
  const space = envValue('NMEM_SPACE', env) || envValue('NMEM_SPACE_ID', env);

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

export function withSpaceArgs(args, env = process.env) {
  const next = [...args];
  const space = envValue('NMEM_SPACE', env) || envValue('NMEM_SPACE_ID', env);
  if (space && !next.includes('--space')) {
    next.push('--space', space);
  }
  return next;
}
