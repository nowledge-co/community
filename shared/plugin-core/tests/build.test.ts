import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildCore, sha256, syncGenerated } from "../scripts/build.ts";

test("generated modules are reproducible and stale or extra files fail closed", async () => {
  const output = await buildCore();
  for (const content of output.values()) assert.equal(content.includes("\r\n"), false);
  assert.deepEqual(await buildCore(), output);
  const manifest = JSON.parse(output.get("manifest.json")!);
  assert.equal(manifest.core.version, "0.1.0");
  for (const [name, hash] of Object.entries(manifest.files)) assert.equal(sha256(output.get(name)!), hash);
  const directory = await mkdtemp(join(tmpdir(), "nmem-core-freshness-"));
  try {
    await assert.rejects(syncGenerated(directory, output, true), /Stale generated/);
    await syncGenerated(directory, output, false);
    await syncGenerated(directory, output, true);
    await writeFile(join(directory, "index.js"), "export const stale = true;\n");
    await assert.rejects(syncGenerated(directory, output, true), /Stale generated/);
    await syncGenerated(directory, output, false);
    await writeFile(join(directory, "unexpected.js"), "");
    await assert.rejects(syncGenerated(directory, output, true), /Unexpected generated/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
