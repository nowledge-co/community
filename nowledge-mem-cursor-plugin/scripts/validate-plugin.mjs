import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const communityRoot = path.resolve(pluginRoot, '..');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string`);
  }
}

function normalizeNewlines(content) {
  return content.replace(/\r\n/g, '\n');
}

function parseFrontmatter(content) {
  const normalized = normalizeNewlines(content);
  if (!normalized.startsWith('---\n')) {
    return null;
  }

  const closingIndex = normalized.indexOf('\n---\n', 4);
  if (closingIndex === -1) {
    return null;
  }

  const fields = {};
  const block = normalized.slice(4, closingIndex);
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    fields[key] = value;
  }
  return fields;
}

async function assertNonEmpty(relPath) {
  const absPath = path.join(pluginRoot, relPath);
  const text = await readFile(absPath, 'utf8');
  if (text.trim() === '') {
    fail(`${relPath} must not be empty`);
  }
  return text;
}

async function validateFrontmatterFile(relPath, requiredKeys, label) {
  const text = await assertNonEmpty(relPath);
  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) {
    fail(`${label} file must include YAML frontmatter: ${relPath}`);
  }
  for (const key of requiredKeys) {
    if (!frontmatter[key] || frontmatter[key].length === 0) {
      fail(`${label} file must include "${key}" in frontmatter: ${relPath}`);
    }
  }
}

async function main() {
  const manifest = await readJson(path.join(pluginRoot, '.cursor-plugin', 'plugin.json'));
  const mcpConfig = await readJson(path.join(pluginRoot, 'mcp.json'));
  const marketplace = await readJson(path.join(communityRoot, '.cursor-plugin', 'marketplace.json'));
  const integrations = await readJson(path.join(communityRoot, 'integrations.json'));

  assertString(manifest.name, 'plugin.json name');
  assertString(manifest.version, 'plugin.json version');
  assertString(manifest.displayName ?? manifest.name, 'plugin.json displayName or name');
  assertString(manifest.description, 'plugin.json description');
  assertString(manifest.homepage, 'plugin.json homepage');
  assertString(manifest.repository, 'plugin.json repository');
  assertString(manifest.license, 'plugin.json license');

  if (manifest.name !== manifest.name.toLowerCase() || manifest.name.includes(' ')) {
    fail('plugin.json name must be lowercase and space-free');
  }
  if (manifest.name === 'nowledge-mem') {
    fail('plugin.json name must not reuse nowledge-mem; use a Cursor-specific package id to avoid collisions with imported Claude-oriented packages.');
  }

  if (!manifest.author || typeof manifest.author !== 'object') {
    fail('plugin.json author must be an object');
  }
  assertString(manifest.author.name, 'plugin.json author.name');

  if (manifest.logo !== undefined) {
    assertString(manifest.logo, 'plugin.json logo');
    if (path.isAbsolute(manifest.logo) || manifest.logo.includes('..')) {
      fail('plugin.json logo must be a relative in-package path');
    }
    await assertNonEmpty(manifest.logo);
  }

  if (manifest.keywords !== undefined) {
    if (!Array.isArray(manifest.keywords) || manifest.keywords.length === 0) {
      fail('plugin.json keywords must be a non-empty array when present');
    }
  }

  const requiredPaths = [
    '.cursor-plugin/plugin.json',
    'hooks/hooks.json',
    'hooks/nmem-runtime.mjs',
    'hooks/session-start.mjs',
    'hooks/stop-save.mjs',
    'mcp.json',
    'README.md',
    'CHANGELOG.md',
    'RELEASING.md',
    'rules/nowledge-mem.mdc',
    'skills/read-working-memory/SKILL.md',
    'skills/search-memory/SKILL.md',
    'skills/distill-memory/SKILL.md',
    'skills/save-thread/SKILL.md',
    'skills/save-handoff/SKILL.md',
    'scripts/validate-plugin.mjs',
    'tests/cursor-hooks.test.mjs'
  ];

  for (const relPath of requiredPaths) {
    await assertNonEmpty(relPath);
  }

  const legacyMcpPath = path.join(pluginRoot, '.mcp.json');
  try {
    await readFile(legacyMcpPath, 'utf8');
    fail('Legacy .mcp.json should not exist. Use mcp.json to match the Cursor plugin template.');
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }

  const ruleText = await assertNonEmpty('rules/nowledge-mem.mdc');
  if (!ruleText.includes('save-handoff')) {
    fail('rules/nowledge-mem.mdc must mention save-handoff');
  }
  if (!ruleText.includes('save-thread')) {
    fail('rules/nowledge-mem.mdc must explicitly clarify save-thread scope');
  }
  if (!ruleText.includes('`stop` hook') || !ruleText.includes('real current Cursor Agent transcript')) {
    fail('rules/nowledge-mem.mdc must describe automatic real transcript capture through the stop hook');
  }

  const staleClaims = [
    'does not expose `save-thread`',
    'does not yet expose a real Nowledge live session importer',
    'does not currently have a first-class Nowledge live session importer',
  ];
  const readmeText = await assertNonEmpty('README.md');
  for (const staleClaim of staleClaims) {
    if (ruleText.includes(staleClaim) || readmeText.includes(staleClaim)) {
      fail(`Cursor plugin still contains stale transcript-capture guidance: ${staleClaim}`);
    }
  }

  const hooks = await readJson(path.join(pluginRoot, 'hooks', 'hooks.json'));
  if (!hooks.hooks || typeof hooks.hooks !== 'object') {
    fail('hooks/hooks.json must contain a top-level "hooks" object');
  }
  const sessionStartHooks = hooks.hooks.sessionStart;
  if (!Array.isArray(sessionStartHooks) || sessionStartHooks.length === 0) {
    fail('hooks/hooks.json must define a sessionStart hook');
  }
  const sessionStartCommand = sessionStartHooks[0]?.command;
  if (sessionStartCommand !== 'node "${CURSOR_PLUGIN_ROOT}/hooks/session-start.mjs"') {
    fail('hooks/hooks.json sessionStart command must resolve from CURSOR_PLUGIN_ROOT');
  }
  if (sessionStartHooks[0]?.timeout !== 15) {
    fail('hooks/hooks.json sessionStart timeout must stay 15 seconds');
  }
  const stopHooks = hooks.hooks.stop;
  if (!Array.isArray(stopHooks) || stopHooks.length === 0) {
    fail('hooks/hooks.json must define a stop hook for real transcript capture');
  }
  if (stopHooks[0]?.command !== 'node "${CURSOR_PLUGIN_ROOT}/hooks/stop-save.mjs"') {
    fail('hooks/hooks.json stop command must resolve from CURSOR_PLUGIN_ROOT');
  }
  if (stopHooks[0]?.timeout !== 40) {
    fail('hooks/hooks.json stop timeout must stay 40 seconds');
  }

  if (!mcpConfig.mcpServers || !mcpConfig.mcpServers['nowledge-mem']) {
    fail('mcp.json must declare mcpServers.nowledge-mem');
  }
  const server = mcpConfig.mcpServers['nowledge-mem'];
  assertString(server.url, 'mcp.json mcpServers.nowledge-mem.url');
  if (server.type !== 'streamableHttp') {
    fail('mcp.json mcpServers.nowledge-mem.type must be streamableHttp');
  }

  await validateFrontmatterFile('rules/nowledge-mem.mdc', ['description'], 'rule');
  await validateFrontmatterFile('skills/read-working-memory/SKILL.md', ['name', 'description'], 'skill');
  await validateFrontmatterFile('skills/search-memory/SKILL.md', ['name', 'description'], 'skill');
  await validateFrontmatterFile('skills/distill-memory/SKILL.md', ['name', 'description'], 'skill');
  await validateFrontmatterFile('skills/save-thread/SKILL.md', ['name', 'description'], 'skill');
  await validateFrontmatterFile('skills/save-handoff/SKILL.md', ['name', 'description'], 'skill');

  if (!marketplace.plugins || !Array.isArray(marketplace.plugins)) {
    fail('community .cursor-plugin/marketplace.json must contain a plugins array');
  }
  const entry = marketplace.plugins.find((plugin) => plugin.name === manifest.name);
  if (!entry) {
    fail('community marketplace manifest must include this plugin by name');
  }
  const expectedSource = path.basename(pluginRoot);
  if (entry.source !== expectedSource && entry.source !== `./${expectedSource}`) {
    fail(`marketplace source for ${manifest.name} must be ${expectedSource} or ./${expectedSource}`);
  }

  const integration = integrations.integrations?.find((item) => item.id === 'cursor');
  if (!integration) {
    fail('integrations.json must include the cursor integration');
  }
  if (integration.version !== manifest.version) {
    fail('integrations.json cursor version must match plugin.json');
  }
  if (integration.transport !== 'mcp+hook' || integration.capabilities?.autoCapture !== true) {
    fail('integrations.json must advertise the Cursor MCP plus automatic hook capture contract');
  }
  if (integration.threadSave?.method !== 'hook+cli-native') {
    fail('integrations.json cursor threadSave.method must be hook+cli-native');
  }
  if (!Array.isArray(integration.skills) || !integration.skills.includes('save-thread')) {
    fail('integrations.json cursor skills must include save-thread');
  }

  console.log('Validated Cursor plugin manifest, capture hooks, skills, mcp.json, registry, and marketplace manifest.');
}

await main();
