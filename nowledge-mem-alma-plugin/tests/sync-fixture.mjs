import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { EventEmitter, once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activate } from "../main.js";

export async function fixture(t) {
	const storagePath = mkdtempSync(join(tmpdir(), "alma-sync-test-"));
	const calls = [];
	const requests = new EventEmitter();
	let responseGate;
	let releaseResponse;
	const remote = new Map();
	const keys = new Map();
	let mode = "ok";
	let responseOverride;
	let closed = 0;
	const server = createServer(async (request, response) => {
		let content = "";
		for await (const chunk of request) content += chunk;
		const body = JSON.parse(content);
		const requestUrl = new URL(request.url, "http://127.0.0.1");
		const call = { path: request.url, body, closed: false };
		calls.push(call);
		requests.emit("request");
		response.on("close", () => {
			if (!response.writableEnded) {
				call.closed = true;
				closed += 1;
				requests.emit("closed");
			}
		});
		const gate = responseGate;
		responseGate = undefined;
		if (gate) await gate;
		const reply = (status, data) => {
			response.writeHead(status, {
				"content-type": "application/json",
				connection: "close",
			});
			response.end(JSON.stringify(data));
		};
		if (responseOverride) return reply(responseOverride.status, responseOverride.body);
		if (mode === "hang") return;
		if (mode === "body-hang") {
			response.writeHead(200, { "content-type": "application/json" });
			response.write('{"success":');
			return;
		}
		if (mode === "failure") return reply(503, { error: "unavailable" });
		if (mode === "bad-ack")
			return reply(200, {
				success: true,
				append_mode: "checkpointed",
				messages_added: 0,
				total_messages: 0,
			});
		if (mode.startsWith("bad-create")) {
			if (requestUrl.pathname !== "/threads")
				return reply(404, { error_code: "thread_not_found" });
			return reply(200, {
				thread: {
					thread_id: mode === "bad-create-id" ? "wrong-id" : body.thread_id,
					message_count: mode === "bad-create-count" ? 1 : 2,
				},
			});
		}
		if (mode.startsWith("serial-")) {
			await new Promise((resolve) => setTimeout(resolve, 1_350));
			if (response.destroyed) return;
		}
		if (mode === "serial-create" && requestUrl.pathname !== "/threads")
			return reply(404, { error_code: "thread_not_found" });
		if (
			mode === "serial-reconcile" &&
			!body.idempotency_key.endsWith(":reconcile")
		)
			return reply(409, { error_code: "checkpoint_conflict" });
		const threadId = body.thread_id ?? requestUrl.pathname.split("/")[2];
		if (requestUrl.pathname === "/threads") {
			if (!remote.has(threadId)) remote.set(threadId, body.messages);
			if (mode === "create-lost" || mode === "lost") return;
			return reply(200, {
				thread: {
					thread_id: threadId,
					message_count: remote.get(threadId).length,
				},
			});
		}
		if (!remote.has(threadId))
			return reply(400, { error_code: "thread_not_found" });
		if (keys.has(body.idempotency_key))
			return reply(200, keys.get(body.idempotency_key));
		const stored = remote.get(threadId) ?? [];
		if (body.messages.length > 0 && body.messages.every(message => message.external_id && stored.some(previous => previous.external_id === message.external_id && previous.role === message.role && previous.content === message.content))) {
			const ack = { success: true, append_mode: "checkpointed", messages_added: 0, total_messages: stored.length };
			keys.set(body.idempotency_key, ack);
			return reply(200, ack);
		}
		if (
			body.expected_message_count !== undefined &&
			body.expected_message_count !== stored.length
		) {
			return reply(409, { error_code: "checkpoint_conflict" });
		}
		const duplicatePrefix =
			body.expected_message_count === undefined &&
			body.messages.every(
				(message, index) =>
					JSON.stringify(message) === JSON.stringify(stored[index]),
			);
		const added = duplicatePrefix ? [] : body.messages;
		remote.set(threadId, [...stored, ...added]);
		const ack = {
			success: true,
			append_mode: "checkpointed",
			messages_added: added.length,
			total_messages: stored.length + added.length,
		};
		keys.set(body.idempotency_key, ack);
		if (mode === "lost") return;
		reply(200, ack);
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const apiUrl = `http://127.0.0.1:${server.address().port}`;
	const plugins = [];
	const errors = [];
	const histories = new Map();
	let messageSequence = 0;
	const persist = (threadId, role, text, id = `synthetic-${++messageSequence}`, createdAt = new Date().toISOString()) => {
		const messages = histories.get(threadId) ?? [];
		messages.push({ id, threadId, role, createdAt, content: { id, role, parts: [{ type: "text", text }] } });
		histories.set(threadId, messages);
		return messages.at(-1);
	};
	const start = async (overrides = {}) => {
		const events = new Map();
		const settings = {
			"nowledgeMem.recallPolicy": "off",
			"nowledgeMem.autoCapture": true,
			"nowledgeMem.apiUrl": apiUrl,
			"nowledgeMem.apiKey": "synthetic-secret",
			...overrides.settings,
		};
		let changed;
		const context = {
			storagePath,
			chat: { getMessages: async (threadId) => structuredClone(histories.get(threadId) ?? []) },
			logger: {
				info() {},
				debug() {},
				warn() {},
				error(message) {
					errors.push(message);
				},
			},
			settings: {
				get: (key) => settings[key],
				onDidChange(fn) {
					changed = fn;
					return { dispose() {} };
				},
			},
			events: {
				on(name, handler) {
					events.set(name, async (input, output) => {
						if (!overrides.recordsDriven) {
							if (name === "chat.message.willSend") persist(input.threadId, "user", input.parts?.[0]?.text ?? input.content);
							if (name === "chat.message.didReceive") persist(input.threadId, "assistant", input.response.content);
						}
						return handler(input, output);
					});
					return {
						dispose() {
							events.delete(name);
						},
					};
				},
			},
			...overrides.context,
		};
		context.chat = { getMessages: async (threadId) => structuredClone(histories.get(threadId) ?? []), ...overrides.context?.chat };
		const plugin = await activate(context);
		plugins.push(plugin);
		return {
			plugin,
			events,
			change(patch) {
				Object.assign(settings, patch);
				changed();
			},
			async turn(threadId = "thread", prefix = "first") {
				await events.get("chat.message.willSend")({
					threadId,
					content: `${prefix} user`,
				});
				await events.get("chat.message.didReceive")({
					threadId,
					response: { content: `${prefix} assistant` },
				});
			},
			flush: () => events.get("thread.activated")({ threadId: "away" }),
			quit: () => events.get("app.willQuit")(),
		};
	};
	t.after(async () => {
		mode = "ok";
		releaseResponse?.();
		await Promise.all(plugins.map((plugin) => plugin.dispose()));
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
		rmSync(storagePath, { recursive: true, force: true });
	});
	return {
		async waitForClosed(count) {
			const signal = AbortSignal.timeout(2_000);
			while (closed < count) await once(requests, "closed", { signal });
		},
		async waitForRequest(predicate = () => true) {
			const signal = AbortSignal.timeout(2_000);
			while (!calls.some(predicate)) await once(requests, "request", { signal });
		},
		holdNextResponse() {
			responseGate = new Promise((resolve) => { releaseResponse = resolve; });
			return releaseResponse;
		},
		start,
		persist,
		histories,
		calls,
		remote,
		errors,
		storagePath,
		apiUrl,
		replyWith(status, body) {
			responseOverride = { status, body };
		},
		setMode(value) {
			mode = value;
		},
		get closed() {
			return closed;
		},
		records: () =>
			JSON.parse(
				readFileSync(join(storagePath, "thread-sync-outbox.json"), "utf8"),
			).filter((record) => record.messages.length > record.savedCount || record.attempt),
		receipts: () => JSON.parse(readFileSync(join(storagePath, "thread-sync-outbox.json"), "utf8")),
	};
}
