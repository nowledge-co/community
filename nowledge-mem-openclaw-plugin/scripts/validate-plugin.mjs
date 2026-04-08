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
  let text;
  try {
    text = await readFile(path.join(pluginRoot, relPath), "utf8");
  } catch (error) {
    fail(`${relPath} is missing or unreadable: ${error.message}`);
  }
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

function assertBoolean(value, label) {
  if (typeof value !== "boolean") {
    fail(`${label} must be a boolean`);
  }
}

function assertVersionFloor(value, label) {
  assertString(value, label);
  if (!/^>=\d+\.\d+\.\d+(?:[-.][A-Za-z0-9.]+)?$/.test(value)) {
    fail(`${label} must use a semver floor like >=2026.4.5`);
  }
}

function assertSameJsonValue(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} must equal ${JSON.stringify(expected)}`);
  }
}

async function main() {
  const pkg = await readJson("package.json");
  const manifest = await readJson("openclaw.plugin.json");
  const changelog = await assertNonEmpty("CHANGELOG.md");

  for (const relPath of [
    "package.json",
    "openclaw.plugin.json",
    "README.md",
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
  assertBoolean(openclaw.release?.publishToClawHub, "package.json openclaw.release.publishToClawHub");
  assertBoolean(openclaw.release?.publishToNpm, "package.json openclaw.release.publishToNpm");

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
  const changelogVersionMatch = changelog.match(/^##\s+\[?v?(\d+\.\d+\.\d+(?:[-+][^\]\s]+)?)\]?/m);
  if (!changelogVersionMatch) {
    fail("CHANGELOG.md must contain a top release header with a semver version");
  }
  if (changelogVersionMatch[1] !== pkg.version) {
    fail("CHANGELOG.md top release version must match package.json and openclaw.plugin.json");
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

  const expectedConfigSchema = {
    sessionContext: { type: "boolean", default: false },
    sessionDigest: { type: "boolean", default: true },
    digestMinInterval: { type: "integer", default: 300, minimum: 0, maximum: 86400 },
    maxContextResults: { type: "integer", default: 5, minimum: 1, maximum: 20 },
    recallMinScore: { type: "integer", default: 0, minimum: 0, maximum: 100 },
    maxThreadMessageChars: { type: "integer", default: 800, minimum: 200, maximum: 20000 },
    captureExclude: { type: "array", default: [], itemsType: "string" },
    captureSkipMarker: { type: "string", default: "#nmem-skip" },
    corpusSupplement: { type: "boolean", default: false },
    corpusMaxResults: { type: "integer", default: 5, minimum: 1, maximum: 20 },
    corpusMinScore: { type: "integer", default: 0, minimum: 0, maximum: 100 },
    apiUrl: { type: "string", default: "" },
    apiKey: { type: "string", default: "" },
  };

  for (const key of Object.keys(configSchema)) {
    if (!(key in expectedConfigSchema)) {
      fail(`configSchema.properties.${key} is unexpected; update the validator spec if this is intentional`);
    }
  }

  for (const [key, spec] of Object.entries(expectedConfigSchema)) {
    const property = configSchema[key];
    if (!property || typeof property !== "object") {
      fail(`configSchema.properties.${key} must exist`);
    }
    if (property.type !== spec.type) {
      fail(`configSchema.properties.${key}.type must be ${spec.type}`);
    }
    assertSameJsonValue(property.default, spec.default, `configSchema.properties.${key}.default`);
    if (spec.type === "integer") {
      if (property.minimum !== spec.minimum) {
        fail(`configSchema.properties.${key}.minimum must be ${spec.minimum}`);
      }
      if (property.maximum !== spec.maximum) {
        fail(`configSchema.properties.${key}.maximum must be ${spec.maximum}`);
      }
    }
    if (spec.type === "array") {
      if (property.items?.type !== spec.itemsType) {
        fail(`configSchema.properties.${key}.items.type must be ${spec.itemsType}`);
      }
    }
  }

  console.log("Validated OpenClaw plugin metadata, runtime files, and ClawHub publish contract.");
}

await main();
