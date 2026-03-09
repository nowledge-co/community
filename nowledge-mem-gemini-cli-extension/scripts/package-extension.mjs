import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(extensionRoot, 'dist');
const archiveName = 'nowledge-mem-gemini-cli-extension.tar.gz';
const archivePath = path.join(distDir, archiveName);
const stageDir = path.join(distDir, 'release-root');
const filesToShip = [
  'gemini-extension.json',
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'GEMINI.md',
  'commands',
  'skills',
  'hooks'
];
const requiredArchiveEntries = new Set([
  './gemini-extension.json',
  './package.json',
  './README.md',
  './CHANGELOG.md',
  './GEMINI.md',
  './commands/nowledge/read-working-memory.toml',
  './commands/nowledge/search-memory.toml',
  './commands/nowledge/distill-memory.toml',
  './commands/nowledge/save-thread.toml',
  './commands/nowledge/save-handoff.toml',
  './commands/nowledge/status.toml',
  './hooks/hooks.json',
  './hooks/session-start.mjs',
  './hooks/session-end.mjs',
  './skills/read-working-memory/SKILL.md',
  './skills/search-memory/SKILL.md',
  './skills/distill-memory/SKILL.md',
  './skills/save-thread/SKILL.md',
  './skills/save-handoff/SKILL.md'
]);

function run(command, args, cwd = extensionRoot, options = {}) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
}

async function fileSha256(filePath) {
  const contents = await readFile(filePath);
  return createHash('sha256').update(contents).digest('hex');
}

function verifyArchive(filePath) {
  const result = spawnSync('tar', ['-tzf', filePath], {
    cwd: extensionRoot,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const entries = new Set(
    result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );

  for (const requiredEntry of requiredArchiveEntries) {
    if (!entries.has(requiredEntry)) {
      console.error(`ERROR: release archive is missing ${requiredEntry}`);
      process.exit(1);
    }
  }
}

async function main() {
  run('node', ['scripts/validate-extension.mjs']);

  await rm(distDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });

  for (const relPath of filesToShip) {
    await cp(path.join(extensionRoot, relPath), path.join(stageDir, relPath), {
      recursive: true,
      force: true
    });
  }

  run('tar', ['-czf', archivePath, '-C', stageDir, '.']);
  verifyArchive(archivePath);

  const checksum = await fileSha256(archivePath);
  await writeFile(
    path.join(distDir, `${archiveName}.sha256`),
    `${checksum}  ${archiveName}\n`,
    'utf8'
  );

  console.log(`Created ${archivePath}`);
  console.log(`Created ${path.join(distDir, `${archiveName}.sha256`)}`);
}

await main();
