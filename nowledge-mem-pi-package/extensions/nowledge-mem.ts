import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, win32 as pathWin32 } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { RESUME_ENTRY, parseResumePrompt, requireResumeReply, resumeBootstrapArgs, type ResumeReply } from "./thread-resume.ts";

import {
	isCheckpointConflictResponse,
	isCheckpointedAppendAck,
	isThreadAppendAck,
	isThreadAlreadyExistsResponse,
	isThreadCreateAck,
	selectAcknowledgedDelta,
	sessionSyncLaneKey,
	stableMessageFingerprint,
	threadCreateRemoteCount,
	type AcknowledgedCursor,
} from "./session-delta.ts";

const DEFAULT_SOURCE_APP = "pi";
const DEFAULT_PLUGIN_VERSION = "0.8.8";
const DEFAULT_API_URL = "http://127.0.0.1:14242";
const CONFIG_PATH = `${homedir()}/.nowledge-mem/config.json`;
const LOCAL_WORKING_MEMORY_PATH = `${homedir()}/ai-now/memory.md`;
const MAX_MESSAGE_CHARS = 20_000;
const FLUSH_DELAY_MS = 750;
const STARTUP_CONTEXT_TIMEOUT_MS = 8_000;
const DEFAULT_THREAD_SYNC_TIMEOUT_MS = 120_000;
const MIN_THREAD_SYNC_TIMEOUT_MS = 1_000;
const MAX_THREAD_SYNC_TIMEOUT_MS = 30 * 60_000;

export function resolveThreadSyncTimeoutMs(raw: string | undefined): number {
	const parsed = Number(raw);
	if (!raw?.trim() || !Number.isSafeInteger(parsed) || parsed <= 0) {
		return DEFAULT_THREAD_SYNC_TIMEOUT_MS;
	}
	return Math.min(MAX_THREAD_SYNC_TIMEOUT_MS, Math.max(MIN_THREAD_SYNC_TIMEOUT_MS, parsed));
}

const THREAD_SYNC_TIMEOUT_MS = resolveThreadSyncTimeoutMs(process.env.NMEM_SYNC_TIMEOUT_MS);

function sourceApp(): string {
	return process.env.NMEM_PLUGIN_SOURCE_APP?.trim() || DEFAULT_SOURCE_APP;
}

function hostLabel(): string {
	return process.env.NMEM_PLUGIN_HOST_LABEL?.trim() || (sourceApp() === "omp" ? "OMP" : "Pi");
}

function pluginVersion(): string {
	return process.env.NMEM_PLUGIN_VERSION?.trim() || DEFAULT_PLUGIN_VERSION;
}

function startupGuidance(): string {
	const label = hostLabel();
	const source = sourceApp();
	return `## Nowledge Mem Guidance

Nowledge Mem is available through the installed ${label} skills and the \`nmem\` CLI. Use it when past context would make the work better.

- Context Bundle or Working Memory may already be injected above. Do not read it again unless the user asks or the session context changes.
- Search memory when the task resumes prior work, mentions an earlier decision, or would benefit from the user's established preferences and procedures.
- Search threads when the user asks about a previous conversation or when a memory points back to source conversation history.
- Save or update durable decisions, preferences, plans, procedures, learnings, events, or important context. Search first; keep one strong memory rather than several weak duplicates.
- Create an explicit handoff thread only when the user asks for a checkpoint. The ${label} extension already syncs completed ${label} conversation history automatically.
- Keep provenance as \`source_app=${source}\`. Use \`NMEM_AGENT_ID\` only when this ${label} process is intentionally running as a named Nowledge AI Identity.
`;
}

type JsonObject = Record<string, unknown>;

type NmemResult =
	| { ok: true; stdout: string }
	| { ok: false; error: string };

interface ThreadMessage {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp?: string;
	metadata: JsonObject;
}

interface SyncState {
	timer?: ReturnType<typeof setTimeout>;
	inFlight?: Promise<void>;
	latestPayload?: SyncPayload;
	created?: boolean;
	lastError?: string;
	acknowledged?: AcknowledgedCursor;
}

interface SyncPayload {
	threadId: string;
	sessionId: string;
	messages: ThreadMessage[];
	body: JsonObject;
	laneKey: string;
	destination: ReturnType<typeof resolveConfig>;
	binding?: ResumeReply["binding"];
}

type StartupContextEntry = {
	context?: string;
	degradedReason?: string;
};

const syncStates = new Map<string, SyncState>();
const startupContextCache = new Map<string, StartupContextEntry>();
const startupContextWarnings = new Set<string>();
const resumeStates = new Map<string, { reply?: ResumeReply; error?: string }>();
const WINDOWS_CMD_ENV_EXPANSION_RE = /%[A-Za-z_][A-Za-z0-9_]*%/;

function debugWarn(message: string): void {
	if (process.env.NMEM_PLUGIN_DEBUG?.trim() === "1") {
		console.warn(`[nowledge-mem] ${message}`);
	}
}

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

function withAmbientNmemArgs(args: string[], config = resolveConfig()): string[] {
	let next = [...args];
	if (config.space && !next.includes("--space") && !next.includes("--space-id")) {
		const scopedCommands = new Set(["context", "ctx", "wm", "m", "memories", "t", "threads"]);
		if (scopedCommands.has(next[0] || "")) {
			next = [...next, "--space", config.space];
		}
	}
	if (next[0] !== "context" && next[0] !== "ctx") return next;
	if (config.agentId && !next.includes("--agent-id")) {
		next = [...next, "--agent-id", config.agentId];
	}
	if (config.hostAgentId && !next.includes("--host-agent-id")) {
		next = [...next, "--host-agent-id", config.hostAgentId];
	}
	return next;
}

function contextArgs(config = resolveConfig()): string[] {
	return withAmbientNmemArgs(["context", "--source-app", sourceApp()], config);
}

function workingMemoryArgs(config = resolveConfig()): string[] {
	return withAmbientNmemArgs(["wm", "read"], config);
}

function withoutAmbientSpace(config: ReturnType<typeof resolveConfig>): ReturnType<typeof resolveConfig> {
	return { ...config, space: undefined };
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

export function shouldTryRemoteApiFallback(status: number): boolean {
	return status === 404 || status === 405;
}

async function postJson(
	path: string,
	body: JsonObject,
	config = resolveConfig(),
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (config.apiKey) {
		headers.Authorization = `Bearer ${config.apiKey}`;
		headers["X-NMEM-API-Key"] = config.apiKey;
	}
	const requestBody = JSON.stringify(path.startsWith("/threads/resume/") ? body : withSpace(body, config.space));
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
		const timeout = setTimeout(() => controller.abort(), THREAD_SYNC_TIMEOUT_MS);
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
			if (!shouldTryRemoteApiFallback(response.status)) return last;
		} catch (error) {
			return {
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
	if (
		typeof result.data === "object" &&
		result.data !== null &&
		(result.data as { error_code?: unknown }).error_code === "thread_not_found"
	) return true;
	if (result.status === 404) return true;
	const text = JSON.stringify(result.data).toLowerCase();
	return text.includes("thread not found");
}

function isThreadAlreadyExists(result: { status: number; data: unknown }): boolean {
	return isThreadAlreadyExistsResponse(result.status, result.data);
}

function truncate(text: string): string {
	if (text.length <= MAX_MESSAGE_CHARS) return text;
	return `${text.slice(0, MAX_MESSAGE_CHARS)}\n\n[${hostLabel()} message truncated by Nowledge Mem plugin]`;
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
		return `${hostLabel()} branch summary:\n${stringValue(message.summary) || ""}`;
	}
	if (role === "compactionSummary") {
		return `${hostLabel()} compaction summary:\n${stringValue(message.summary) || ""}`;
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
				external_id: `${sourceApp()}-entry-${stringValue(entry.id) || index}`,
				pi_entry_id: stringValue(entry.id),
				pi_entry_type: entry.type,
				pi_message_role: stringValue(msg.role),
				...ambient,
			},
		};
	}

	if (entry.type === "custom_message") {
		const content = truncate(contentToText(entry.content).trim());
		if (!content) return undefined;
		return {
			role: "user",
			content: `${hostLabel()} custom context${stringValue(entry.customType) ? ` (${stringValue(entry.customType)})` : ""}:\n${content}`,
			timestamp: stringValue(entry.timestamp),
			metadata: {
				external_id: `${sourceApp()}-entry-${stringValue(entry.id) || index}`,
				pi_entry_id: stringValue(entry.id),
				pi_entry_type: entry.type,
				pi_custom_type: stringValue(entry.customType),
				pi_custom_display: typeof entry.display === "boolean" ? entry.display : undefined,
				...ambient,
			},
		};
	}

	if (entry.type === "compaction" || entry.type === "branch_summary") {
		const label = entry.type === "compaction" ? `${hostLabel()} compaction summary` : `${hostLabel()} branch summary`;
		const content = truncate(`${label}:\n${stringValue(entry.summary) || ""}`.trim());
		if (!content) return undefined;
		return {
			role: "assistant",
			content,
			timestamp: stringValue(entry.timestamp),
			metadata: {
				external_id: `${sourceApp()}-entry-${stringValue(entry.id) || index}`,
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
		source_app: sourceApp(),
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
	const binding = resumeStates.get(sessionId(ctx))?.reply?.binding;
	if (binding) return binding.target.thread_id;
	return `${sourceApp()}-${sessionId(ctx)}`.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
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
	return cwd ? `${hostLabel()} session - ${basename(cwd)}` : `${hostLabel()} session`;
}

function shouldSync(messages: ThreadMessage[]): boolean {
	return messages.some((msg) => msg.role === "user") && messages.some((msg) => msg.role === "assistant");
}

function buildSyncPayload(ctx: ExtensionContext, reason: string): SyncPayload | undefined {
	const resume = resumeStates.get(sessionId(ctx));
	if (sourceApp() === "pi" && (!resume || resume.error)) return undefined;
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
		source: sourceApp(),
		project: manager.getCwd?.(),
		tool_version: pluginVersion(),
		metadata: {
			pi_session_id: id,
			pi_session_file: manager.getSessionFile?.(),
			sync_reason: reason,
			...(config.agentId ? { agent_id: config.agentId } : {}),
			...(config.hostAgentId ? { host_agent_id: config.hostAgentId } : {}),
		},
	};
	return {
		threadId,
		sessionId: id,
		messages,
		body,
		binding: resume?.reply?.binding,
		laneKey: sessionSyncLaneKey(
			threadId,
			config.apiUrl,
			config.apiKey,
			config.space,
			config.agentId,
			config.hostAgentId,
		) + (resume?.reply ? `:${id}:${resume.reply.binding.binding_id}` : ""),
		destination: config,
	};
}

async function flushOnce(payload: SyncPayload, state: SyncState): Promise<void> {
	const externalId = (message: ThreadMessage) => stringValue(message.metadata.external_id) || "";
	const delta = selectAcknowledgedDelta(
		payload.messages,
		state.acknowledged,
		externalId,
		stableMessageFingerprint,
	);
	if (delta.messages.length === 0) return;
	if (payload.binding) {
		const binding = payload.binding;
		let total = state.acknowledged?.remoteCount;
		let batch: JsonObject[] = [];
		let bytes = 0;
		const send = async (): Promise<void> => {
			if (!batch.length) return;
			const result = await postJson("/threads/resume/append", {
				binding_id: binding.binding_id,
				connection_id: binding.target.connection_id,
				messages: batch,
			}, payload.destination);
			if (!result.ok || !isThreadAppendAck(result.data)) {
				throw new Error("Bound Thread sync failed. Check the selected Thread and Mem connection; it was not recreated.");
			}
			total = Number((result.data as JsonObject).total_messages);
			batch = [];
			bytes = 0;
		};
		try {
			for (const message of delta.messages) {
				const item = { ...message, external_id: externalId(message) };
				const size = Buffer.byteLength(JSON.stringify(item));
				if (bytes + size > 900_000 || batch.length === 128) await send();
				batch.push(item);
				bytes += size;
			}
			await send();
			state.acknowledged = { ...delta.next, remoteCount: total ?? 0 };
			state.lastError = undefined;
		} catch (error) {
			state.lastError = error instanceof Error ? error.message : String(error);
			debugWarn(state.lastError);
		}
		return;
	}

	if (!state.created) {
		const createResult = await postJson("/threads", payload.body, payload.destination);
		const remoteCount = threadCreateRemoteCount(createResult.data, payload.threadId);
		if (createResult.ok && remoteCount !== undefined) {
			state.created = true;
			state.acknowledged = { ...delta.next, remoteCount };
			state.lastError = undefined;
			return;
		}
		if (createResult.ok) {
			state.lastError = `${hostLabel()} thread sync did not receive a create acknowledgement`;
			debugWarn(state.lastError);
			return;
		}
		if (!isThreadAlreadyExists(createResult)) {
			const detail = JSON.stringify(createResult.data);
			state.lastError = `${hostLabel()} thread sync failed (${createResult.status}): ${detail}`;
			debugWarn(state.lastError);
			return;
		}
		state.created = true;
	}

	let checkpointed = Boolean(state.acknowledged && !delta.reset);
	let recreated = false;
	let result = await postJson(
		`/threads/${encodeURIComponent(payload.threadId)}/append`,
		{
			messages: delta.messages,
			deduplicate: true,
			idempotency_key: `${sourceApp()}:${payload.sessionId}:${delta.start}-${delta.end}:${delta.next.prefixFingerprint}`,
			...(checkpointed ? { expected_message_count: state.acknowledged?.remoteCount } : {}),
		},
		payload.destination,
	);
	if (!result.ok && checkpointed && isCheckpointConflictResponse(result.data)) {
		result = await postJson(
			`/threads/${encodeURIComponent(payload.threadId)}/append`,
			{
				messages: payload.messages,
				deduplicate: true,
				idempotency_key: `${sourceApp()}:${payload.sessionId}:reconcile:${delta.next.prefixFingerprint}`,
			},
			payload.destination,
		);
		checkpointed = false;
	}
	if (!result.ok && state.created && isThreadNotFound(result)) {
		state.created = false;
		result = await postJson("/threads", payload.body, payload.destination);
		recreated = true;
	}
	if (!result.ok) {
		const detail = JSON.stringify(result.data);
		state.lastError = `${hostLabel()} thread sync failed (${result.status}): ${detail}`;
		debugWarn(state.lastError);
		return;
	}
	if (
		recreated
			? !isThreadCreateAck(result.data, payload.threadId)
			: !isThreadAppendAck(result.data)
	) {
		state.lastError = `${hostLabel()} thread sync did not receive a persistence acknowledgement`;
		debugWarn(state.lastError);
		return;
	}
	if (checkpointed && !recreated && !isCheckpointedAppendAck(result.data)) {
		state.lastError = `${hostLabel()} thread sync did not receive a checkpoint acknowledgement`;
		debugWarn(state.lastError);
		return;
	}
	const remoteCount = recreated
		? threadCreateRemoteCount(result.data, payload.threadId)
		: Number((result.data as { total_messages?: unknown })?.total_messages);
	if (remoteCount === undefined || !Number.isInteger(remoteCount)) {
		state.lastError = `${hostLabel()} thread sync did not receive the remote message count`;
		debugWarn(state.lastError);
		return;
	}
	state.created = true;
	state.acknowledged = {
		...delta.next,
		remoteCount,
	};
	state.lastError = undefined;
}

async function flushPayload(payload: SyncPayload): Promise<void> {
	const key = payload.laneKey;
	const state = syncStates.get(key) || {};
	syncStates.set(key, state);
	state.latestPayload = payload;
	if (!state.inFlight) {
		state.inFlight = (async () => {
			while (state.latestPayload) {
				const latest = state.latestPayload;
				state.latestPayload = undefined;
				await flushOnce(latest, state);
			}
		})().finally(() => {
			state.inFlight = undefined;
		});
	}
	await state.inFlight;
}

async function flush(ctx: ExtensionContext, reason: string): Promise<void> {
	const payload = buildSyncPayload(ctx, reason);
	if (!payload) return;
	const state = syncStates.get(payload.laneKey);
	if (state?.timer) {
		clearTimeout(state.timer);
		state.timer = undefined;
	}
	await flushPayload(payload);
}

function evictSyncState(ctx: ExtensionContext): void {
	const config = resolveConfig();
	const binding = resumeStates.get(sessionId(ctx))?.reply?.binding;
	const key = sessionSyncLaneKey(
		threadIdFor(ctx),
		config.apiUrl,
		config.apiKey,
		config.space,
		config.agentId,
		config.hostAgentId,
	) + (binding ? `:${sessionId(ctx)}:${binding.binding_id}` : "");
	const state = syncStates.get(key);
	if (state?.timer) clearTimeout(state.timer);
	syncStates.delete(key);
}

function scheduleFlush(ctx: ExtensionContext, reason: string): void {
	const payload = buildSyncPayload(ctx, reason);
	if (!payload) return;
	const key = payload.laneKey;
	const state = syncStates.get(key) || {};
	syncStates.set(key, state);
	if (state.timer) clearTimeout(state.timer);
	state.timer = setTimeout(() => {
		state.timer = undefined;
		void flushPayload(payload);
	}, FLUSH_DELAY_MS);
}

function warnStartupContextFailure(stage: string, detail: string): void {
	const key = `${stage}:${detail}`;
	if (startupContextWarnings.has(key)) return;
	startupContextWarnings.add(key);
	debugWarn(`startup context ${stage}: ${detail}`);
}

function quoteWindowsBatchArg(arg: string): string {
	if (arg === "") return '""';
	const out: string[] = ['"'];
	let i = 0;
	const n = arg.length;
	while (i < n) {
		let backslashes = 0;
		while (i < n && arg[i] === "\\") {
			i += 1;
			backslashes += 1;
		}
		if (i === n) {
			out.push("\\".repeat(backslashes * 2));
			break;
		}
		if (arg[i] === '"') {
			out.push("\\".repeat(backslashes * 2));
			out.push('""');
			i += 1;
		} else {
			out.push("\\".repeat(backslashes));
			out.push(arg[i]);
			i += 1;
		}
	}
	out.push('"');
	return out.join("");
}

function rejectWindowsCmdEnvExpansion(args: string[]): void {
	for (let index = 1; index < args.length; index += 1) {
		if (WINDOWS_CMD_ENV_EXPANSION_RE.test(args[index])) {
			throw new Error(
				"nmem Windows .cmd shim cannot safely receive %VAR%-style arguments; remove or escape the environment-variable token before retrying.",
			);
		}
	}
}

function windowsComspec(): string {
	const systemRoot = process.env.SystemRoot || "C:\\Windows";
	const root = pathWin32.isAbsolute(systemRoot) ? systemRoot : "C:\\Windows";
	const expected = pathWin32.join(root, "System32", "cmd.exe");
	const comspec = process.env.ComSpec || "";
	const samePath = (left: string, right: string) =>
		pathWin32.normalize(left).toLowerCase() === pathWin32.normalize(right).toLowerCase();
	if (
		comspec &&
		pathWin32.isAbsolute(comspec) &&
		pathWin32.basename(comspec).toLowerCase() === "cmd.exe" &&
		samePath(comspec, expected) &&
		existsSync(comspec)
	) {
		return comspec;
	}
	return existsSync(expected) ? expected : "C:\\Windows\\System32\\cmd.exe";
}

function windowsCommandLine(args: string[]): string {
	rejectWindowsCmdEnvExpansion(args);
	return args.map(quoteWindowsBatchArg).join(" ");
}

function remainingStartupContextTimeout(deadline: number): number {
	return Math.max(1, deadline - Date.now());
}

function spawnNmem(args: string[], timeoutMs = STARTUP_CONTEXT_TIMEOUT_MS): Promise<NmemResult> {
	const baseArgs = ["--json", ...args];
	const executable = process.env.NMEM_CLI_PATH || (process.platform === "win32" ? "nmem.cmd" : "nmem");
	return new Promise((resolve) => {
		const handle = (error: Error | null, stdout: string, stderr: string) => {
			const stderrText = stderr.trim();
			if (error) {
				resolve({ ok: false, error: stderrText || error.message });
				return;
			}
			resolve({ ok: true, stdout: stdout.trim() });
		};
		if (process.platform === "win32" && /\.(cmd|bat)$/i.test(executable)) {
			try {
				// `/s` strips one outer quote pair before parsing the command.
				// Keep that pair outside the per-argument quoting, and tell Node
				// the command line is already escaped so it is not rewritten.
				const line = `"${windowsCommandLine([executable, ...baseArgs])}"`;
				execFile(
					windowsComspec(),
					["/d", "/s", "/c", line],
					{
						timeout: timeoutMs,
						windowsHide: true,
						windowsVerbatimArguments: true,
						encoding: "utf8",
					},
					handle,
				);
			} catch (error) {
				resolve({ ok: false, error: error instanceof Error ? error.message : String(error) });
			}
		} else {
			execFile(executable, baseArgs, { timeout: timeoutMs, encoding: "utf8", windowsHide: true }, handle);
		}
	});
}

function parseNmemObject(output: string): JsonObject | undefined {
	try {
		const parsed = JSON.parse(output) as JsonObject;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || "error" in parsed) {
			return undefined;
		}
		return parsed;
	} catch {
		return undefined;
	}
}

function parseContextBundleMarkdown(output: string): string | undefined {
	const parsed = parseNmemObject(output);
	return parsed
		? stringValue(parsed.rendered_markdown) || stringValue(parsed.markdown) || stringValue(parsed.content)
		: undefined;
}

function parseWorkingMemoryMarkdown(output: string): string | undefined {
	const parsed = parseNmemObject(output);
	if (!parsed || parsed.exists === false) return undefined;
	return stringValue(parsed.content);
}

function truncateStartupContext(text: string, stage: string): string {
	if (text.length <= MAX_MESSAGE_CHARS) return text;
	warnStartupContextFailure(stage, `context truncated to ${MAX_MESSAGE_CHARS} characters`);
	return `${text.slice(0, MAX_MESSAGE_CHARS)}\n\n[Nowledge Mem startup context truncated by ${hostLabel()} plugin]`;
}

function readLocalWorkingMemory(): string | undefined {
	try {
		if (!existsSync(LOCAL_WORKING_MEMORY_PATH)) return undefined;
		const content = readFileSync(LOCAL_WORKING_MEMORY_PATH, "utf8").trim();
		return content ? truncateStartupContext(content, "local-file") : undefined;
	} catch (error) {
		warnStartupContextFailure("local-file", error instanceof Error ? error.message : String(error));
		return undefined;
	}
}

function shouldUseLocalWorkingMemoryFallback(config: ReturnType<typeof resolveConfig>): boolean {
	if (config.space || config.agentId || config.hostAgentId) return false;
	return config.apiUrl === DEFAULT_API_URL;
}

async function readStartupContext(): Promise<StartupContextEntry> {
	const config = resolveConfig();
	const unscopedConfig = config.space ? withoutAmbientSpace(config) : undefined;
	const attempts: Array<{ stage: string; args: string[]; parse: (output: string) => string | undefined }> = [
		{ stage: "context", args: contextArgs(config), parse: parseContextBundleMarkdown },
		...(unscopedConfig ? [{ stage: "context-default", args: contextArgs(unscopedConfig), parse: parseContextBundleMarkdown }] : []),
		{ stage: "working-memory", args: workingMemoryArgs(config), parse: parseWorkingMemoryMarkdown },
		...(unscopedConfig ? [{ stage: "working-memory-default", args: workingMemoryArgs(unscopedConfig), parse: parseWorkingMemoryMarkdown }] : []),
	];
	const deadline = Date.now() + STARTUP_CONTEXT_TIMEOUT_MS;
	let timedOut = false;
	let sawReadFailure = false;

	for (const attempt of attempts) {
		if (Date.now() >= deadline) {
			timedOut = true;
			warnStartupContextFailure(attempt.stage, "skipped because earlier reads consumed the startup timeout");
			continue;
		}
		const result = await spawnNmem(attempt.args, remainingStartupContextTimeout(deadline));
		if (result.ok) {
			const parsed = attempt.parse(result.stdout);
			if (parsed) return { context: truncateStartupContext(parsed, attempt.stage) };
			sawReadFailure = true;
			warnStartupContextFailure(attempt.stage, "empty or invalid output");
		} else {
			sawReadFailure = true;
			warnStartupContextFailure(attempt.stage, result.error);
		}
	}

	if (shouldUseLocalWorkingMemoryFallback(config)) {
		const local = readLocalWorkingMemory();
		if (local) return { context: local };
	}
	warnStartupContextFailure("fallback", "no Context Bundle or Working Memory available; using guidance only");
	if (timedOut) return { degradedReason: "startup context reads timed out" };
	if (sawReadFailure) return { degradedReason: "startup context reads failed" };
	return {};
}

function startupContextCacheKey(ctx: ExtensionContext): string | undefined {
	const manager = ctx.sessionManager as unknown as {
		getSessionId?: () => string;
		getSessionFile?: () => string | undefined;
	};
	const id = manager.getSessionId?.();
	const normalizedId = id?.trim();
	if (normalizedId && normalizedId.toLowerCase() !== "unknown") return normalizedId;
	const file = manager.getSessionFile?.();
	return file ? basename(file).replace(/\.jsonl$/i, "") : undefined;
}

async function refreshStartupContext(ctx: ExtensionContext): Promise<void> {
	const key = startupContextCacheKey(ctx);
	if (!key) return;
	startupContextCache.set(key, await readStartupContext());
}

function evictStartupContext(ctx: ExtensionContext): void {
	const key = startupContextCacheKey(ctx);
	if (key) startupContextCache.delete(key);
}

async function appendMemoryContext(systemPrompt: string, ctx: ExtensionContext): Promise<string> {
	const key = startupContextCacheKey(ctx);
	if (key && !startupContextCache.has(key)) {
		await refreshStartupContext(ctx);
	}
	const entry = key ? startupContextCache.get(key) : await readStartupContext();
	const sections: string[] = [];
	if (entry?.context) {
		sections.push(`## Nowledge Mem Context Bundle\n\n${entry.context}`);
	} else if (entry?.degradedReason) {
		sections.push(`## Nowledge Mem Context Bundle\n\n[Nowledge Mem startup context unavailable: ${entry.degradedReason}.]`);
	}
	sections.push(startupGuidance());
	return `${systemPrompt}\n\n${sections.join("\n\n")}`;
}

export default function nowledgeMemPi(pi: ExtensionAPI) {
	const bootstrap = async (ctx: ExtensionContext, locator?: string): Promise<void> => {
		if (sourceApp() !== "pi") return;
		const id = sessionId(ctx);
		try {
			const manager = ctx.sessionManager as unknown as { getEntries: () => JsonObject[] };
			const saved = manager.getEntries().find((entry) => entry.type === "custom" && entry.customType === RESUME_ENTRY);
			const savedLocator = saved?.data && typeof saved.data === "object" ? (saved.data as JsonObject).locator : undefined;
			const effectiveLocator = locator ?? (typeof savedLocator === "string" ? savedLocator : undefined);
			const nativeKey = createHash("sha256").update(JSON.stringify(["pi", id])).digest("hex");
			const configDir = process.env.NMEM_CLI_CONFIG_DIR || join(homedir(), ".nowledge-mem");
			const required = Boolean(effectiveLocator) || Boolean(resumeStates.get(id)?.reply)
				|| existsSync(join(configDir, "thread-resume", `${nativeKey}.json`));
			if (locator && !saved && buildMessages(ctx).some((message) => message.role === "assistant" || message.role === "user")) {
				throw new Error("Start a new Pi session before continuing a selected Mem Thread.");
			}
			const result = await spawnNmem(resumeBootstrapArgs(id, effectiveLocator), 30_000);
			if (!result.ok) {
				if (!required) {
					resumeStates.set(id, {});
					return;
				}
				throw new Error("Thread continuation could not be verified. Check nmem and the Mem connection, then retry.");
			}
			const reply = requireResumeReply(parseNmemObject(result.stdout), required);
			if (reply && (reply.binding.source !== "pi" || reply.binding.native_session_id !== id)) {
				throw new Error("Mem returned a binding for a different native session.");
			}
			resumeStates.set(id, { reply });
			if (reply && !saved) {
				pi.appendEntry(RESUME_ENTRY, { locator: Buffer.from(JSON.stringify(reply.binding.target)).toString("base64url") });
			}
		} catch (error) {
			resumeStates.set(id, { error: error instanceof Error ? error.message : String(error) });
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		await bootstrap(ctx);
		await refreshStartupContext(ctx);
	});

	pi.on("input", async (event, ctx) => {
		if (sourceApp() !== "pi") return { action: "continue" };
		let handoff: ReturnType<typeof parseResumePrompt>;
		try { handoff = parseResumePrompt(event.text); }
		catch (error) {
			ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			return { action: "handled" };
		}
		await bootstrap(ctx, handoff?.locator);
		const state = resumeStates.get(sessionId(ctx));
		if (state?.error) {
			ctx.ui.notify(state.error, "error");
			return { action: "handled" };
		}
		return handoff ? { action: "transform", text: handoff.text, images: event.images } : { action: "continue" };
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const context = resumeStates.get(sessionId(ctx))?.reply?.context.context_text;
		const prompt = context ? `${event.systemPrompt}\n\n${context}` : event.systemPrompt;
		return { systemPrompt: await appendMemoryContext(prompt, ctx) };
	});

	pi.on("agent_end", async (_event, ctx) => {
		scheduleFlush(ctx, "agent_end");
	});

	pi.on("session_before_compact", async (_event, ctx) => {
		await flush(ctx, "session_before_compact");
	});

	pi.on("session_compact", async (_event, ctx) => {
		await refreshStartupContext(ctx);
	});

	pi.on("session_before_switch", async (event, ctx) => {
		await flush(ctx, event.reason === "new" ? "session_new" : "session_resume");
		evictSyncState(ctx);
		evictStartupContext(ctx);
	});

	pi.on("session_shutdown", async (event, ctx) => {
		await flush(ctx, `session_shutdown:${event.reason}`);
		evictSyncState(ctx);
		evictStartupContext(ctx);
	});
}
