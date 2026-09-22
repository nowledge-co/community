import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture } from "./sync-fixture.mjs";

const targets = process.env.PR620_MEM_CONTRACT === "1" ? ["loopback", "real Mem"] : ["loopback"];
for (const target of targets) {
	test(`user Given an owned synthetic thread on ${target} When create checkpoint replay and conflict run Then exact messages survive once`, async (t) => {
		const state = target === "loopback" ? await fixture(t) : null;
		const base = state?.apiUrl ?? process.env.PR620_MEM_URL ?? "http://127.0.0.1:14242";
		assert.equal(new URL(base).hostname, "127.0.0.1");
		const threadId = `pr620-contract-${randomUUID()}`;
		const messages = ["user", "assistant"].map((role) => ({ role, content: `${threadId} ${role}`, external_id: `${threadId}-${role}` }));
		const request = async (route, method = "POST", body) => {
			const response = await fetch(base + route, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
			const text = await response.text();
			return { status: response.status, data: text ? JSON.parse(text) : null };
		};
		if (!state) {
			assert.equal((await request(`/threads/${threadId}`, "GET")).status, 404);
			t.after(async () => {
				const existing = await request(`/threads/${threadId}`, "GET");
				assert.ok([200, 404].includes(existing.status));
				if (existing.status === 200) {
					assert.ok(existing.data.messages.every(({ content }) => content.startsWith(threadId)));
					assert.ok([200, 204].includes((await request(`/threads/${threadId}`, "DELETE")).status));
				}
				assert.equal((await request(`/threads/${threadId}`, "GET")).status, 404);
			});
		}
		const route = `/threads/${threadId}/append`;
		const unknown = await request(route, "POST", { messages: [messages[0]], expected_message_count: 0, idempotency_key: `${threadId}-unknown` });
		assert.ok([400, 404].includes(unknown.status), `unknown thread status: ${unknown.status}`);
		assert.equal(unknown.data?.error_code, "thread_not_found", `unknown thread response: ${JSON.stringify(unknown.data)}`);
		const created = await request("/threads", "POST", { thread_id: threadId, title: threadId, source: "alma", messages: [messages[0]] });
		assert.ok([200, 201].includes(created.status));
		assert.equal(created.data.thread.thread_id, threadId);
		assert.equal(created.data.thread.message_count, 1);
		const body = { messages: [messages[1]], expected_message_count: 1, idempotency_key: `${threadId}-append` };
		for (const label of ["checkpoint", "repeat key"]) {
			const response = await request(route, "POST", body);
			assert.equal(response.status, 200, label);
			assert.equal(response.data.success, true, label);
			assert.equal(response.data.append_mode, "checkpointed", label);
			assert.equal(response.data.total_messages, 2, label);
		}
		const duplicate = await request(route, "POST", { ...body, idempotency_key: `${threadId}-duplicate-record` });
		assert.equal(duplicate.status, 200);
		assert.equal(duplicate.data.total_messages, 2);
		const conflict = await request(route, "POST", { ...body, messages: [{ role: "assistant", content: `${threadId} conflicting new record`, external_id: `${threadId}-conflict-new` }], idempotency_key: `${threadId}-conflict` });
		assert.equal(conflict.status, 409);
		assert.equal(conflict.data.error_code, "checkpoint_conflict");
		const stored = state ? state.remote.get(threadId) : (await request(`/threads/${threadId}`, "GET")).data.messages;
		assert.deepEqual(stored.map(({ role, content }) => ({ role, content })), messages.map(({ role, content }) => ({ role, content })));
	});
}
