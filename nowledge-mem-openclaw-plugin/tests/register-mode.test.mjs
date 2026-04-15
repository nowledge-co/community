import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveRegistrationMode } from "../src/register-mode.js";

test("supplement mode keeps compatibility tools off when memory-core owns the slot", () => {
	const mode = resolveRegistrationMode({
		pluginId: "openclaw-nowledge-mem",
		configuredMemorySlot: "memory-core",
	});

	assert.equal(mode.memorySlotSelected, false);
	assert.equal(mode.registerMemoryCompatTools, false);
});

test("defaults to memory-core mode when configuredMemorySlot is omitted", () => {
	const mode = resolveRegistrationMode({
		pluginId: "openclaw-nowledge-mem",
	});

	assert.equal(mode.memorySlot, "memory-core");
	assert.equal(mode.memorySlotSelected, false);
	assert.equal(mode.registerMemoryCompatTools, false);
});

test("full memory mode registers compatibility tools when Nowledge Mem owns the slot", () => {
	const mode = resolveRegistrationMode({
		pluginId: "openclaw-nowledge-mem",
		configuredMemorySlot: "openclaw-nowledge-mem",
	});

	assert.equal(mode.memorySlotSelected, true);
	assert.equal(mode.registerMemoryCompatTools, true);
});

test("manifest declares the plugin as dual-role memory plus context-engine", () => {
	const manifest = JSON.parse(
		readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"),
	);

	assert.deepEqual(manifest.kind, ["memory", "context-engine"]);
});
