#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const technicalId = process.argv[2] ?? '';
if (!/^plugin_asdk_app_[a-f0-9]{32}$/.test(technicalId)) {
  console.error('Expected the real OpenAI technical ID: plugin_asdk_app_…');
  process.exit(2);
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(packageRoot, '.codex-plugin', 'plugin.json');
const appPath = resolve(packageRoot, '.app.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

manifest.apps = './.app.json';
await writeFile(
  appPath,
  `${JSON.stringify({ apps: { 'nowledge-mem': { id: technicalId } } }, null, 2)}\n`,
  'utf8',
);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Wired ${technicalId} into ${appPath}`);
