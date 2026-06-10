import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const SOURCE_APP = "pi";
const PLUGIN_VERSION = "0.8.0";
const DEFAULT_API_URL = "http://127.0.0.1:14242";
const CONFIG_PATH = `${homedir()}/.nowledge-mem/config.json`;
const MAX_MESSAGE_CHARS = 20_000;
const FLUSH_DELAY_MS = 750;
const API_TIMEOUT_MS = 8_000;

type JsonObject = Record<string, unknown>;

interface ThreadMessage {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp?: string;
	metadata: JsonObject;
}

interface SyncState {
	timer?: ReturnType<typeof setTimeout>;
	inFlight?: Promise<void>;
	pending?: boolean;
	created?: boolean;
	lastError?: string;
	lastSyncedCount?: number;
}

interface SyncPayload {
	threadId: string;
	sessionId: string;
	messages: ThreadMessage[];
	body: JsonObject;
}

const syncStates = new Map<string, SyncState>();

function readSharedConfig(): JsonObject {
	try {
		if (!existsSync(CONFIG_PATH)) return {};
		const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" ? value.trim() || undefined : undefined;
}

function readConfigValue(config: JsonObject, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const envValue = process.env[key]?.trim();
		if (envValue) return envValue;
	}
	for (const key of keys) {
		const value = stringValue(config[key]);
		if (value) return value;
	}
	return undefined;
}

function resolveConfig() {
	const config = readSharedConfig();
	return {
		apiUrl: (
			process.env.NMEM_API_URL?.trim() ||
			stringValue(config.apiUrl) ||
			stringValue(config.api_url) ||
			DEFAULT_API_URL
		).replace(/\/+$/, ""),
		apiKey: process.env.NMEM_API_KEY?.trim() || stringValue(config.apiKey) || stringValue(config.api_key),
		space:
			process.env.NMEM_SPACE?.trim() ||
			process.env.NMEM_SPACE_ID?.trim() ||
			stringValue(config.space) ||
			stringValue(config.spaceId) ||
			stringValue(config.space_id),
		agentId: readConfigValue(config, "NMEM_AGENT_ID", "agentId", "agent_id"),
		hostAgentId: readConfigValue(config, "NMEM_HOST_AGENT_ID", "hostAgentId", "host_agent_id"),
	};
}

function withSpace(body: JsonObject, space: string | undefined): JsonObject {
	if (!space || Object.prototype.hasOwnProperty.call(body, "space_id")) {
		return body;
	}
	return { ...body, space_id: space };
}

function remoteApiFallbackUrls(url: string): string[] {
	const urls: string[] = [];
	const add = (candidate: string) => {
		if (!urls.includes(candidate)) urls.push(candidate);
	};
	const parsed = new URL(url);
	const path = parsed.pathname || "";
	if (path === "/remote-api") {
		parsed.pathname = "/";
		add(parsed.toString());
	} else if (path.startsWith("/remote-api/")) {
		parsed.pathname = path.slice("/remote-api".length);
		add(parsed.toString());
	}
	return urls;
}

async function postJson(path: string, body: JsonObject): Promise<{ ok: boolean; status: number; data: unknown }> {
	const config = resolveConfig();
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (config.apiKey) {
		headers.Authorization = `Bearer ${config.apiKey}`;
		headers["X-NMEM-API-Key"] = config.apiKey;
	}
	const requestBody = JSON.stringify(withSpace(body, config.space));
	let urls: string[];
	try {
		urls = [`${config.apiUrl}${path}`];
		urls.push(...remoteApiFallbackUrls(urls[0]));
	} catch {
		return {
			ok: false,
			status: 0,
			data: { error: "Invalid NMEM_API_URL or apiUrl in ~/.nowledge-mem/config.json" },
		};
	}

	let last: { ok: boolean; status: number; data: unknown } = {
		ok: false,
		status: 0,
		data: { error: "request was not sent" },
	};
	for (const url of urls) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
		try {
			const response = await fetch(url, {
				method: "POST",
				headers,
				body: requestBody,
				signal: controller.signal,
			});
			const data = await response.json().catch(() => ({}));
			last = { ok: response.ok, status: response.status, data };
			if (response.ok) return last;
		} catch (error) {
			last = {
				ok: false,
				status: 0,
				data: { error: error instanceof Error ? error.message : String(error) },
			};
		} finally {
			clearTimeout(timeout);
		}
	}
	return last;
}

function isThreadNotFound(result: { status: number; data: unknown }): boolean {
	if (result.status === 404) return true;
	const text = JSON.stringify(result.data).toLowerCase();
	return text.includes("thread not found");
}

function truncate(text: string): string {
	if (text.length <= MAX_MESSAGE_CHARS) return text;
	return `${text.slice(0, MAX_MESSAGE_CHARS)}\n\n[Pi message truncated by Nowledge Mem plugin]`;
}

function partToText(part: unknown): string {
	if (typeof part === "string") return part;
	if (!part || typeof part !== "object") return "";
	const value = part as JsonObject;
	const type = stringValue(value.type) || "part";
	if (type === "text") {
		return stringValue(value.text) || stringValue(value.content) || "";
	}
	if (type === "image") return "[Image]";
	if (type === "toolUse" || type === "tool" || type === "toolCall") {
		const name = stringValue(value.name) || stringValue(value.tool) || "tool";
		return `[Tool: ${name}]`;
	}
	if (type === "file") {
		const label = stringValue(value.filename) || stringValue(value.path) || "attachment";
		return `[File: ${label}]`;
	}
	const text = stringValue(value.text) || stringValue(value.content);
	return text || `[${type}]`;
}

function contentToText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content.map(partToText).filter(Boolean).join("\n");
	}
	if (content && typeof content === "object") {
		return partToText(content);
	}
	return "";
}

function messageToText(message: JsonObject): string {
	const role = stringValue(message.role);
	if (role === "bashExecution") {
		const command = stringValue(message.command) || "";
		const output = stringValue(message.output) || "(no output)";
		const exitCode = message.exitCode;
		const suffix = typeof exitCode === "number" && exitCode !== 0 ? `\n\nCommand exited with code ${exitCode}` : "";
		return `Ran \`${command}\`\n\`\`\`\n${output}\n\`\`\`${suffix}`;
	}
	if (role === "branchSummary") {
		return `Pi branch summary:\n${stringValue(message.summary) || ""}`;
	}
	if (role === "compactionSummary") {
		return `Pi compaction summary:\n${stringValue(message.summary) || ""}`;
	}
	return contentToText(message.content);
}

function normalizeRole(role: unknown): "user" | "assistant" | "system" | undefined {
	if (role === "user" || role === "bashExecution") return "user";
	if (role === "assistant" || role === "toolResult" || role === "branchSummary" || role === "compactionSummary") {
		return "assistant";
	}
	return undefined;
}

function entryToMessage(entry: JsonObject, index: number, ambient: JsonObject): ThreadMessage | undefined {
	if (entry.type === "message") {
		const message = entry.message;
		if (!message || typeof message !== "object") return undefined;
		const msg = message as JsonObject;
		// Extension-injected context is not user transcript. Keep it out of thread history.
		if (msg.role === "custom") return undefined;
		const role = normalizeRole(msg.role);
		if (!role) return undefined;
		const content = truncate(messageToText(msg).trim());
		if (!content) return undefined;
		return {
			role,
			content,
			timestamp: stringValue(entry.timestamp),
			metadata: {
				external_id: `pi-entry-${stringValue(entry.id) || index}`,
				pi_entry_id: stringValue(entry.id),
				pi_entry_type: entry.type,
				pi_message_role: stringValue(msg.role),
				...ambient,
			},
		};
	}

	if (entry.type === "compaction" || entry.type === "branch_summary") {
		const label = entry.type === "compaction" ? "Pi compaction summary" : "Pi branch summary";
		const content = truncate(`${label}:\n${stringValue(entry.summary) || ""}`.trim());
		if (!content) return undefined;
		return {
			role: "assistant",
			content,
			timestamp: stringValue(entry.timestamp),
			metadata: {
				external_id: `pi-entry-${stringValue(entry.id) || index}`,
				pi_entry_id: stringValue(entry.id),
				pi_entry_type: entry.type,
				...ambient,
			},
		};
	}

	return undefined;
}

function buildMessages(ctx: ExtensionContext): ThreadMessage[] {
	const config = resolveConfig();
	const ambient: JsonObject = {
		source_app: SOURCE_APP,
		...(config.agentId ? { agent_id: config.agentId } : {}),
		...(config.hostAgentId ? { host_agent_id: config.hostAgentId } : {}),
	};
	const manager = ctx.sessionManager as unknown as {
		getBranch?: () => JsonObject[];
		getEntries?: () => JsonObject[];
	};
	const entries = typeof manager.getBranch === "function" ? manager.getBranch() : manager.getEntries?.() || [];
	return entries.map((entry, index) => entryToMessage(entry, index, ambient)).filter((msg): msg is ThreadMessage => !!msg);
}

function sessionId(ctx: ExtensionContext): string {
	const manager = ctx.sessionManager as unknown as {
		getSessionId?: () => string;
		getSessionFile?: () => string | undefined;
	};
	const id = manager.getSessionId?.();
	if (id) return id;
	const file = manager.getSessionFile?.();
	if (file) return basename(file).replace(/\.jsonl$/i, "");
	return "unknown";
}

function threadIdFor(ctx: ExtensionContext): string {
	return `pi-${sessionId(ctx)}`.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function buildTitle(ctx: ExtensionContext, messages: ThreadMessage[]): string {
	const manager = ctx.sessionManager as unknown as {
		getSessionName?: () => string | undefined;
		getCwd?: () => string;
	};
	const name = manager.getSessionName?.()?.trim();
	if (name) return name;
	const firstUser = messages.find((msg) => msg.role === "user")?.content.trim();
	if (firstUser) return firstUser.slice(0, 120);
	const cwd = manager.getCwd?.();
	return cwd ? `Pi session - ${basename(cwd)}` : "Pi session";
}

function shouldSync(messages: ThreadMessage[]): boolean {
	return messages.some((msg) => msg.role === "user") && messages.some((msg) => msg.role === "assistant");
}

function buildSyncPayload(ctx: ExtensionContext, reason: string): SyncPayload | undefined {
	const messages = buildMessages(ctx);
	if (!shouldSync(messages)) return undefined;

	const config = resolveConfig();
	const threadId = threadIdFor(ctx);
	const id = sessionId(ctx);
	const manager = ctx.sessionManager as unknown as {
		getCwd?: () => string;
		getSessionFile?: () => string | undefined;
	};
	const body: JsonObject = {
		thread_id: threadId,
		title: buildTitle(ctx, messages),
		messages,
		source: SOURCE_APP,
		project: manager.getCwd?.(),
		tool_version: PLUGIN_VERSION,
		metadata: {
			pi_session_id: id,
			pi_session_file: manager.getSessionFile?.(),
			sync_reason: reason,
			...(config.agentId ? { agent_id: config.agentId } : {}),
			...(config.hostAgentId ? { host_agent_id: config.hostAgentId } : {}),
		},
	};
	return { threadId, sessionId: id, messages, body };
}

async function flushOnce(payload: SyncPayload, state: SyncState): Promise<void> {
	let result = state.created
		? { ok: false, status: 409, data: { detail: "append existing thread" } }
		: await postJson("/threads", payload.body);
	if (result.ok) {
		state.created = true;
		state.lastSyncedCount = payload.messages.length;
		state.lastError = undefined;
		return;
	}

	result = await postJson(`/threads/${encodeURIComponent(payload.threadId)}/append`, {
		messages: payload.messages,
		deduplicate: true,
		idempotency_key: `pi:${payload.sessionId}:${payload.messages.length}`,
	});
	if (!result.ok && state.created && isThreadNotFound(result)) {
		state.created = false;
		result = await postJson("/threads", payload.body);
	}
	if (!result.ok) {
		const detail = JSON.stringify(result.data);
		state.lastError = `Pi thread sync failed (${result.status}): ${detail}`;
		console.warn(`[nowledge-mem] ${state.lastError}`);
		return;
	}
	state.created = true;
	state.lastSyncedCount = payload.messages.length;
	state.lastError = undefined;
}

async function flushPayload(payload: SyncPayload): Promise<void> {
	const key = payload.threadId;
	const state = syncStates.get(key) || {};
	syncStates.set(key, state);
	if (state.inFlight) {
		state.pending = true;
		await state.inFlight;
		return;
	}
	do {
		state.pending = false;
		state.inFlight = flushOnce(payload, state).finally(() => {
			state.inFlight = undefined;
		});
		await state.inFlight;
	} while (state.pending);
}

async function flush(ctx: ExtensionContext, reason: string): Promise<void> {
	const payload = buildSyncPayload(ctx, reason);
	if (!payload) return;
	await flushPayload(payload);
}

function scheduleFlush(ctx: ExtensionContext, reason: string): void {
	const payload = buildSyncPayload(ctx, reason);
	if (!payload) return;
	const key = payload.threadId;
	const state = syncStates.get(key) || {};
	syncStates.set(key, state);
	if (state.timer) clearTimeout(state.timer);
	state.timer = setTimeout(() => {
		state.timer = undefined;
		void flushPayload(payload);
	}, FLUSH_DELAY_MS);
}

export default function nowledgeMemPi(pi: ExtensionAPI) {
	pi.on("agent_end", async (_event, ctx) => {
		scheduleFlush(ctx, "agent_end");
	});

	pi.on("session_before_compact", async (_event, ctx) => {
		await flush(ctx, "session_before_compact");
	});

	pi.on("session_before_switch", async (event, ctx) => {
		await flush(ctx, event.reason === "new" ? "session_new" : "session_resume");
	});

	pi.on("session_shutdown", async (event, ctx) => {
		await flush(ctx, `session_shutdown:${event.reason}`);
	});
}
