import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("declares the Step-loadable Pi compatibility manifest", async () => {
	const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
	assert.equal(pkg.name, "nowledge-mem-step-code");
	assert.deepEqual(pkg.pi.extensions, ["./extensions/nowledge-mem.ts"]);
	assert.deepEqual(pkg.pi.skills, ["./skills"]);
	assert.equal(pkg.dependencies["nowledge-mem-pi"], "^0.8.9");
});

test("pins Step source identity and waits for the settled lifecycle event", async () => {
	const extension = await readFile(new URL("extensions/nowledge-mem.ts", root), "utf8");
	assert.match(extension, /NMEM_PLUGIN_SOURCE_APP = "step-code"/);
	assert.match(extension, /NMEM_PLUGIN_HOST_LABEL = "Step Code"/);
	assert.match(extension, /NMEM_PLUGIN_CAPTURE_EVENT = "agent_settled"/);
});

test("ships all declared skill entry points", async () => {
	for (const skill of ["read-working-memory", "search-memory", "distill-memory", "save-thread", "status"]) {
		const text = await readFile(new URL(`skills/${skill}/SKILL.md`, root), "utf8");
		assert.match(text, /^---\n/);
	}
});
