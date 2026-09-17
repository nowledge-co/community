import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

for (const probe of ["first-turn-host", "host-recovery"]) {
	for (const failure of ["post", "delete", "inventory"]) {
		test(`user Given ${probe} installation loses its response When ${failure} cleanup runs Then owned deletion is attempted and evidence survives`, { timeout: 5_000 }, async (t) => {
			const directory = mkdtempSync(join(tmpdir(), "alma-probe-cleanup-"));
			const evidence = join(directory, "evidence");
			const existing = { id: "synthetic-preexisting", enabled: true, status: "active", version: "1" };
			let installed;
			let staging;
			let deleteAttempted = false;
			let inventoryCalls = 0;
			const unexpected = [];
			const server = createServer(async (request, response) => {
				const reply = (status, data) => { response.writeHead(status, { "content-type": "application/json" }); response.end(data ? JSON.stringify(data) : undefined); };
				if (request.url === "/api/plugins" && request.method === "GET") {
					inventoryCalls += 1;
					if (inventoryCalls > 1 && failure === "inventory") return reply(503, { error: "synthetic inventory failure" });
					return reply(200, installed ? [existing, installed] : [existing]);
				}
				if (request.url === "/api/threads/synthetic-owned-thread") return reply(200, { messages: [], model: "synthetic-model" });
				if (/^\/threads\/alma-[a-f0-9]{12}$/.test(request.url) && request.method === "GET") return reply(404);
				if (request.url === "/api/plugins" && request.method === "POST") {
					let body = "";
					for await (const chunk of request) body += chunk;
					staging = JSON.parse(body).sourcePath;
					installed = JSON.parse(readFileSync(join(staging, "manifest.json"), "utf8"));
					request.socket.destroy();
					return;
				}
				if (installed && request.url === `/api/plugins/${installed.id}` && request.method === "DELETE") {
					deleteAttempted = true;
					if (failure === "delete") return reply(503, { error: "synthetic delete failure" });
					installed = undefined;
					return reply(204);
				}
				unexpected.push([request.method, request.url]);
				reply(400);
			});
			await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
			t.after(async () => {
				server.closeAllConnections();
				await new Promise((resolve) => server.close(resolve));
				if (staging) rmSync(staging, { recursive: true, force: true });
				rmSync(directory, { recursive: true, force: true });
			});
			const origin = `http://127.0.0.1:${server.address().port}`;
			const child = spawn(process.execPath, [fileURLToPath(new URL(`./${probe}.mjs`, import.meta.url)), evidence], {
				env: { ...process.env, PR620_HOST_TEST: "1", PR620_HOST_URL: origin, PR620_MEM_URL: origin, PR620_TARGET_THREAD: "synthetic-owned-thread", PR620_EXPECTED_MODEL: "synthetic-model" },
				stdio: ["ignore", "pipe", "pipe"],
			});
			t.after(() => { if (child.exitCode === null) child.kill(); });
			let diagnostics = "";
			child.stdout.on("data", (chunk) => { diagnostics += chunk; });
			child.stderr.on("data", (chunk) => { diagnostics += chunk; });
			const [code] = await once(child, "close", { signal: AbortSignal.timeout(4_000) });
			assert.equal(code, 1, diagnostics);
			assert.equal(deleteAttempted, true);
			assert.equal(typeof staging, "string");
			assert.ok(staging.length > 0);
			assert.equal(existsSync(staging), false);
			assert.deepEqual(unexpected, []);
			const result = JSON.parse(readFileSync(join(evidence, "result.json"), "utf8"));
			assert.equal(result.pass, false);
			assert.match(result.error, /fetch failed/);
			const cleanup = result.cleanup ?? result;
			assert.equal(cleanup.pluginRemoved, failure !== "delete" && failure !== "inventory" || (probe === "first-turn-host" && failure === "inventory"));
			assert.equal(cleanup.originalPluginsUnchanged, failure !== "inventory" && failure !== "delete");
			assert.equal(existing.id, "synthetic-preexisting");
		});
	}
}
