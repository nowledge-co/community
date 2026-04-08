import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

async function readJson(relPath) {
  try {
    return JSON.parse(await readFile(path.join(pluginRoot, relPath), "utf8"));
  } catch (error) {
    fail(`${relPath} is missing or invalid JSON: ${error.message}`);
  }
}

async function assertNonEmpty(relPath) {
  const text = await readFile(path.join(pluginRoot, relPath), "utf8");
  if (!text.trim()) {
    fail(`${relPath} must not be empty`);
  }
  return text;
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${label} must be a non-empty string`);
  }
}

function assertVersionFloor(value, label) {
  assertString(value, label);
  if (!/^>=\d+\.\d+\.\d+(?:[-.][A-Za-z0-9.]+)?$/.test(value)) {
    fail(`${label} must use a semver floor like >=2026.4.5`);
  }
}

async function main() {
  const pkg = await readJson("package.json");
  const manifest = await readJson("openclaw.plugin.json");

  for (const relPath of [
    "package.json",
    "openclaw.plugin.json",
    "README.md",
    "CHANGELOG.md",
    "SKILL.md",
    "RELEASING.md",
    "src/index.js",
    "src/config.js",
    "src/hooks/capture.js",
    "src/hooks/recall.js",
    "skills/memory-guide/SKILL.md",
  ]) {
    await assertNonEmpty(relPath);
  }

  assertString(pkg.name, "package.json name");
  assertString(pkg.displayName, "package.json displayName");
  assertString(pkg.version, "package.json version");
  assertString(pkg.description, "package.json description");
  assertString(pkg.repository?.url, "package.json repository.url");
  assertString(pkg.repository?.directory, "package.json repository.directory");

  if (pkg.name !== "@nowledge/openclaw-nowledge-mem") {
    fail("package.json name must stay @nowledge/openclaw-nowledge-mem");
  }

  const openclaw = pkg.openclaw;
  if (!openclaw || typeof openclaw !== "object") {
    fail("package.json must include an openclaw block");
  }

  if (!Array.isArray(openclaw.extensions) || openclaw.extensions[0] !== "./src/index.js") {
    fail("package.json openclaw.extensions must include ./src/index.js");
  }

  assertString(openclaw.install?.npmSpec, "package.json openclaw.install.npmSpec");
  assertVersionFloor(openclaw.install?.minHostVersion, "package.json openclaw.install.minHostVersion");
  assertVersionFloor(openclaw.compat?.pluginApi, "package.json openclaw.compat.pluginApi");
  assertString(openclaw.build?.openclawVersion, "package.json openclaw.build.openclawVersion");

  if (openclaw.install.npmSpec !== pkg.name) {
    fail("package.json openclaw.install.npmSpec must match package.json name");
  }

  if (pkg.peerDependencies?.openclaw !== openclaw.install.minHostVersion) {
    fail("peerDependencies.openclaw must match openclaw.install.minHostVersion");
  }

  if (manifest.id !== "openclaw-nowledge-mem") {
    fail("openclaw.plugin.json id must stay openclaw-nowledge-mem");
  }
  assertString(manifest.name, "openclaw.plugin.json name");
  assertString(manifest.description, "openclaw.plugin.json description");
  assertString(manifest.version, "openclaw.plugin.json version");
  if (manifest.version !== pkg.version) {
    fail("package.json version and openclaw.plugin.json version must match");
  }
  if (manifest.kind !== "memory") {
    fail("openclaw.plugin.json kind must be memory");
  }
  if (!Array.isArray(manifest.skills) || !manifest.skills.includes("skills/memory-guide")) {
    fail("openclaw.plugin.json must expose skills/memory-guide");
  }

  const configSchema = manifest.configSchema?.properties;
  if (!configSchema || typeof configSchema !== "object") {
    fail("openclaw.plugin.json configSchema.properties must exist");
  }
  if (configSchema.sessionContext?.default !== false) {
    fail("sessionContext must default to false");
  }
  if (configSchema.sessionDigest?.default !== true) {
    fail("sessionDigest must default to true");
  }
  if (configSchema.corpusSupplement?.default !== false) {
    fail("corpusSupplement must default to false");
  }

  console.log("Validated OpenClaw plugin metadata, runtime files, and ClawHub publish contract.");
}

await main();
