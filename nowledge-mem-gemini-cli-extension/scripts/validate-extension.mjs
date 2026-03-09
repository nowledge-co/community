import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(extensionRoot, 'gemini-extension.json');
const packageJsonPath = path.join(extensionRoot, 'package.json');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

async function readJson(filePath) {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string`);
  }
}

async function main() {
  const manifest = await readJson(manifestPath);
  const packageJson = await readJson(packageJsonPath);
  const extensionDirName = path.basename(extensionRoot);

  assertString(manifest.name, 'manifest.name');
  assertString(manifest.version, 'manifest.version');
  assertString(manifest.description, 'manifest.description');

  if (manifest.name !== extensionDirName) {
    fail(`manifest.name must match directory name (${extensionDirName})`);
  }

  if (manifest.version !== packageJson.version) {
    fail(`manifest.version (${manifest.version}) must match package.json version (${packageJson.version})`);
  }

  if (manifest.contextFileName !== 'GEMINI.md') {
    fail('manifest.contextFileName must be GEMINI.md');
  }

  if (manifest.settings !== undefined && !Array.isArray(manifest.settings)) {
    fail('manifest.settings must be an array when present');
  }

  const requiredPaths = [
    'GEMINI.md',
    'README.md',
    'CHANGELOG.md',
    'RELEASING.md',
    'commands/nowledge/read-working-memory.toml',
    'commands/nowledge/search-memory.toml',
    'commands/nowledge/distill-memory.toml',
    'commands/nowledge/save-thread.toml',
    'commands/nowledge/save-handoff.toml',
    'commands/nowledge/status.toml',
    'hooks/hooks.json',
    'hooks/session-start.mjs',
    'hooks/session-end.mjs',
    'skills/read-working-memory/SKILL.md',
    'skills/search-memory/SKILL.md',
    'skills/distill-memory/SKILL.md',
    'skills/save-thread/SKILL.md',
    'skills/save-handoff/SKILL.md',
    'scripts/validate-extension.mjs',
    'scripts/package-extension.mjs',
    `release-notes/${manifest.version}.md`
  ];

  for (const relPath of requiredPaths) {
    const absPath = path.join(extensionRoot, relPath);
    try {
      const text = await readFile(absPath, 'utf8');
      if (text.trim() === '') {
        fail(`${relPath} must not be empty`);
      }

      if (relPath === 'hooks/hooks.json') {
        const hooksConfig = JSON.parse(text);
        if (
          !hooksConfig ||
          typeof hooksConfig !== 'object' ||
          typeof hooksConfig.hooks !== 'object' ||
          hooksConfig.hooks === null ||
          Array.isArray(hooksConfig.hooks)
        ) {
          fail('hooks/hooks.json must contain a top-level "hooks" object');
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        fail(`${relPath} must contain valid JSON`);
      }
      fail(`missing required file: ${relPath}`);
    }
  }

  console.log('Validated Gemini extension manifest, version alignment, and required release files.');
}

await main();
