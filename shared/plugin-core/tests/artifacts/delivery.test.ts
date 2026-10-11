import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { consumers, repositoryRoot } from "../../scripts/consumers.ts";
import { releaseReceipt } from "../../scripts/receipt.ts";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run artifact checks through npm run test:artifacts");
const jitiLoader = pathToFileURL(resolve(repositoryRoot, "shared/plugin-core/node_modules/jiti/lib/jiti.mjs")).href;

test("standalone npm payloads contain the reviewed core and reject receipt tampering", async () => {
  for (const consumer of consumers().filter(entry => entry.id !== "amp")) {
    const directory = mkdtempSync(join(tmpdir(), "nmem-core-artifact-"));
    try {
      const output = execFileSync(process.execPath, [npmCli, "pack", "--ignore-scripts", "--json", "--cache", join(directory, "npm-cache"), "--pack-destination", directory], {
        cwd: join(repositoryRoot, consumer.directory), encoding: "utf8",
      });
      const pack = JSON.parse(output)[0];
      const packPath = join(directory, "pack.json");
      writeFileSync(packPath, output);
      const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
      const receipt = releaseReceipt(consumer.id, packPath, sourceSha);
      assert.equal(receipt.coreManifest.core.version, "0.1.0");
      const receiptPath = join(directory, "core-receipt.json");
      writeFileSync(receiptPath, JSON.stringify(receipt));
      const receiptScript = join(repositoryRoot, "shared/plugin-core/scripts/receipt.ts");
      execFileSync(process.execPath, [receiptScript, "--verify", consumer.id, packPath, sourceSha]);
      writeFileSync(receiptPath, JSON.stringify({ ...receipt, sourceSha: "0".repeat(40) }));
      assert.throws(() => execFileSync(process.execPath, [receiptScript, "--verify", consumer.id, packPath, sourceSha], { stdio: "pipe" }), /Command failed/);
      execFileSync("tar", ["-xzf", join(directory, pack.filename), "-C", directory]);
      const installed = join(directory, "package");
      const core = await import(pathToFileURL(join(installed, consumer.generatedDirectory, "index.js")).href);
      assert.equal(core.resolveThreadSyncTimeoutMs("1"), 1_000);
      assert.equal(core.isThreadAppendAck({ success: true, messages_added: -1, total_messages: 2 }), false);
      if (consumer.id === "pi") {
        // Load the unchanged host entry through a TS loader without a parent checkout.
        const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
          const { createJiti } = await import(${JSON.stringify(jitiLoader)});
          const loader = createJiti(import.meta.url, {fsCache: false, moduleCache: false});
          const entry = await loader.import(${JSON.stringify(join(installed, "extensions/nowledge-mem.ts"))});
          const events = [];
          const host = { on(name) { events.push(name); return this; } };
          entry.default(host);
          if (!events.includes("agent_end") || !events.includes("session_before_compact")) throw new Error("Missing Pi lifecycle");
        `], { env: { ...process.env, HOME: directory, USERPROFILE: directory, NMEM_PLUGIN_SOURCE_APP: "pi" } });
        assert.ok(result);
        for (const dependent of consumer.dependents) {
          const dependencyRoot = join(directory, dependent);
          const dependentMetadata = JSON.parse(readFileSync(join(repositoryRoot, "integrations.json"), "utf8"))
            .integrations.find((entry: { id: string }) => entry.id === dependent);
          cpSync(join(repositoryRoot, dependentMetadata.directory), dependencyRoot, { recursive: true });
          cpSync(installed, join(dependencyRoot, "node_modules/nowledge-mem-pi"), { recursive: true });
          execFileSync(process.execPath, ["--input-type=module", "-e", `
            const { createJiti } = await import(${JSON.stringify(jitiLoader)});
            const loader = createJiti(import.meta.url, {fsCache: false, moduleCache: false});
            const entry = await loader.import(${JSON.stringify(join(dependencyRoot, "extensions/nowledge-mem.ts"))});
            const events = [];
            const host = { on(name) { events.push(name); return this; } };
            await entry.default(host);
            if (!events.includes(${JSON.stringify(dependent === "step-code" ? "agent_settled" : "agent_end")})) throw new Error("Missing dependent lifecycle");
          `], { env: { ...process.env, HOME: directory, USERPROFILE: directory } });
        }
      } else {
        // OpenCode's host SDK remains external; the bundle must not import the core.
        const isolated = await build({ entryPoints: [join(installed, "dist/index.js")], bundle: true,
          platform: "node", format: "esm", external: ["@opencode/plugin"], write: false });
        assert.ok(isolated.outputFiles![0]!.text.includes("selectAcknowledgedDelta"));
      }
      const changedCore = join(installed, consumer.generatedDirectory, "index.js");
      writeFileSync(changedCore, readFileSync(changedCore, "utf8") + "\n// tampered payload\n");
      const tamperedDirectory = join(directory, "tampered");
      mkdirSync(tamperedDirectory);
      const tamperedPack = execFileSync(process.execPath, [npmCli, "pack", "--ignore-scripts", "--json", "--cache", join(directory, "npm-cache"), "--pack-destination", tamperedDirectory], {
        cwd: installed, encoding: "utf8",
      });
      const tamperedPackPath = join(tamperedDirectory, "pack.json");
      writeFileSync(tamperedPackPath, tamperedPack);
      assert.throws(() => releaseReceipt(consumer.id, tamperedPackPath, sourceSha), /Packed core hash mismatch/);
      const damaged = readFileSync(join(directory, pack.filename));
      damaged[damaged.length - 1] = damaged[damaged.length - 1]! ^ 1;
      writeFileSync(join(directory, pack.filename), damaged);
      assert.throws(() => releaseReceipt(consumer.id, packPath, sourceSha), /Tarball differs/);
      assert.throws(() => releaseReceipt(consumer.id, packPath, "moving-main"), /full reviewed/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("Amp's copied payload resolves core without development dependencies", async () => {
  const directory = mkdtempSync(join(tmpdir(), "nmem-amp-delivery-"));
  try {
    const source = join(directory, "source");
    cpSync(join(repositoryRoot, "nowledge-mem-amp-plugin"), source, {
      recursive: true,
      filter: path => !["node_modules", "coverage"].some(part => path.split(/[\\/]/).includes(part)) && !path.endsWith(".tgz"),
    });
    let installed = source;
    if (process.platform !== "win32") {
      const config = join(directory, "config");
      execFileSync("bash", [join(source, "scripts/install.sh")], {
        env: { ...process.env, HOME: directory, XDG_CONFIG_HOME: config },
      });
      installed = join(config, "amp/plugins/nowledge-mem");
      assert.match(readFileSync(join(config, "amp/plugins/nowledge-mem.ts"), "utf8"), /nowledge-mem\/src\/index.ts/);
    }
    const core = await import(pathToFileURL(join(installed, "src/generated/plugin-core/index.js")).href);
    assert.equal(core.resolveThreadSyncTimeoutMs(undefined), 120_000);
    const bundled = await build({ entryPoints: [join(installed, "src/index.ts")], bundle: true,
      platform: "node", format: "esm", write: false });
    const entry = join(directory, "amp-entry.mjs");
    writeFileSync(entry, bundled.outputFiles![0]!.text);
    execFileSync(process.execPath, ["--input-type=module", "-e", `
      const entry = await import(${JSON.stringify(pathToFileURL(entry).href)});
      const tools = []; const events = []; const disposers = [];
      entry.default({ system: {workspaceRoot: null}, threads: {get() {}}, logger: {log() {}},
        registerTool(tool) {tools.push(tool.name)}, registerCommand() {},
        on(name) {events.push(name)}, onDispose(handler) {disposers.push(handler)} });
      if (!tools.includes("nowledge_mem_search") || !events.includes("agent.end")) throw new Error("Missing Amp registration");
      for (const dispose of disposers) await dispose();
    `], { env: { ...process.env, HOME: directory, USERPROFILE: directory } });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
