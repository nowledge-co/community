import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function getSetting(settingsApi, key, fallbackValue) {
	if (!settingsApi?.get) return fallbackValue;
	try {
		const value = settingsApi.get(key);
		return value === undefined ? fallbackValue : value;
	} catch {
		return fallbackValue;
	}
}

function normalizeSpaceRef(raw) {
	if (typeof raw !== "string") return "";
	return raw.trim().replace(/\s+/g, " ");
}

function resolveSpaceTemplate(template, logger) {
	const raw = normalizeSpaceRef(template);
	if (!raw) return "";
	try {
		return raw.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
			const envValue = process.env[envVar];
			if (typeof envValue !== "string" || !envValue.trim()) {
				throw new Error(`environment variable ${envVar} is not set`);
			}
			return envValue.trim();
		});
	} catch (error) {
		logger?.warn?.(
			`nowledge-mem: could not resolve space template: ${error instanceof Error ? error.message : String(error)}`,
		);
		return "";
	}
}

export function resolveAmbientSpace(settingsApi, logger = console) {
	const configuredSpace = normalizeSpaceRef(
		getSetting(settingsApi, "nowledgeMem.space", ""),
	);
	if (configuredSpace) {
		return { space: configuredSpace, source: "settings" };
	}

	const configuredTemplate = normalizeSpaceRef(
		getSetting(settingsApi, "nowledgeMem.spaceTemplate", ""),
	);
	if (configuredTemplate) {
		const resolved = normalizeSpaceRef(resolveSpaceTemplate(configuredTemplate, logger));
		if (resolved) {
			return { space: resolved, source: "settings:template" };
		}
	}

	const envSpace = normalizeSpaceRef(
		process.env.NMEM_SPACE || process.env.NMEM_SPACE_ID || "",
	);
	if (envSpace) {
		return { space: envSpace, source: "env" };
	}

	return { space: "", source: "default" };
}

function escapeForInline(text, maxLength = 220) {
	const normalized = String(text ?? "")
		.replace(/\s+/g, " ")
		.trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, maxLength)}...`;
}

function extractText(content) {
	if (!content) return "";
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((item) => {
				if (!item) return "";
				if (typeof item === "string") return item;
				if (typeof item === "object") {
					if (typeof item.text === "string") return item.text;
					if (typeof item.content === "string") return item.content;
				}
				return "";
			})
			.filter(Boolean)
			.join("\n");
	}
	if (typeof content === "object") {
		if (typeof content.text === "string") return content.text;
		if (typeof content.content === "string") return content.content;
	}
	return "";
}

/** Extract thread ID from a memory object, handling both string and {id, title} shapes. */
function extractThreadId(mem) {
	const st = mem?.source_thread;
	if (typeof st === "string") return st;
	if (st && typeof st === "object" && st.id) return String(st.id);
	return mem?.source_thread_id ?? mem?.metadata?.source_thread_id ?? null;
}

export class NowledgeMemClient {
	/**
	 * @param {object} logger
	 * @param {{ apiUrl?: string; apiKey?: string; space?: string }} [credentials]
	 */
	constructor(logger, credentials = {}) {
		this.logger = logger;
		this.command = null;
		this._apiUrl = (credentials.apiUrl || "").trim() || "http://127.0.0.1:14242";
		this._apiKey = (credentials.apiKey || "").trim();
		this._spaceRef = normalizeSpaceRef(credentials.space || "");
	}

	// --- HTTP transport (async, non-blocking) ---

	/** Build common headers. API key is passed via Authorization header, never logged. */
	_headers() {
		const h = { "Content-Type": "application/json", Accept: "application/json" };
		if (this._apiKey) h.Authorization = `Bearer ${this._apiKey}`;
		return h;
	}

	_withSpaceQuery(params) {
		const query = { ...(params || {}) };
		if (this._spaceRef && query.space_id === undefined && query.spaceId === undefined) {
			query.space_id = this._spaceRef;
		}
		return query;
	}

	_withSpaceBody(body) {
		if (!this._spaceRef || body == null || Array.isArray(body)) {
			return body;
		}
		if ("space_id" in body || "spaceId" in body) {
			return body;
		}
		return { ...body, space_id: this._spaceRef };
	}

	/** Core async fetch with timeout. All data operations route through this. */
	async _fetch(method, path, { body, params, timeout = 15_000 } = {}) {
		const url = new URL(path, this._apiUrl);
		const resolvedParams = this._withSpaceQuery(params);
		if (resolvedParams) {
			for (const [k, v] of Object.entries(resolvedParams)) {
				if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
			}
		}
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);
		const resolvedBody = this._withSpaceBody(body);
		try {
			const resp = await fetch(url.href, {
				method,
				headers: this._headers(),
				body: resolvedBody !== undefined ? JSON.stringify(resolvedBody) : undefined,
				signal: controller.signal,
			});
			if (!resp.ok) {
				const text = await resp.text().catch(() => "");
				const err = new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
				err.status = resp.status;
				throw err;
			}
			const ct = resp.headers.get("content-type") || "";
			return ct.includes("application/json") ? resp.json() : resp.text();
		} finally {
			clearTimeout(timer);
		}
	}

	// --- CLI diagnostic (sync, used only for status tool) ---

	resolveCommand() {
		if (this.command) return this.command;
		for (const candidate of [
			{ cmd: "nmem", prefix: [] },
			{ cmd: "uvx", prefix: ["--from", "nmem-cli", "nmem"] },
		]) {
			const result = spawnSync(candidate.cmd, [...candidate.prefix, "--version"], {
				encoding: "utf-8",
				timeout: 10_000,
			});
			if (result.status === 0) {
				this.command = candidate;
				this.logger.info?.(`nmem resolved via: ${candidate.cmd} ${candidate.prefix.join(" ")}`.trim());
				return candidate;
			}
		}
		throw new Error("nmem CLI not found. Install with `pip install nmem` or use `uvx --from nmem-cli nmem`.");
	}

	// --- Memory operations ---

	async search(query, limit = 5) {
		const safeLimit = clamp(Number(limit) || 5, 1, 20);
		const data = await this._fetch("GET", "/memories/search", {
			params: { q: query, limit: safeLimit },
		});
		const memories = data.memories ?? data.results ?? [];
		return memories.map((memory) => ({
			id: String(memory.id ?? ""),
			title: String(memory.title ?? ""),
			content: String(memory.content ?? ""),
			score: Number(memory.relevance_score ?? memory.score ?? 0),
			labels: Array.isArray(memory.labels) ? memory.labels : [],
			importance: Number(memory.importance ?? memory.rating ?? 0.5),
			sourceThreadId: extractThreadId(memory),
		}));
	}

	async searchMemory(query, options = {}) {
		const params = { q: query };
		if (options.limit !== undefined) params.limit = clamp(Number(options.limit) || 5, 1, 20);
		if (typeof options.label === "string" && options.label.trim()) params.labels = options.label.trim();
		if (typeof options.time === "string" && options.time.trim()) params.time_range = options.time.trim();
		if (typeof options.importance === "number" && Number.isFinite(options.importance)) {
			params.importance_min = clamp(options.importance, 0.1, 1.0);
		}
		if (options.mode === "deep") params.mode = "deep";
		return this._fetch("GET", "/memories/search", { params });
	}

	async showMemory(id) {
		return this._fetch("GET", `/memories/${encodeURIComponent(id)}`);
	}

	async updateMemory(id, content, title, importance) {
		const body = {};
		if (typeof content === "string" && content.trim()) body.content = content.trim();
		if (typeof title === "string" && title.trim()) body.title = title.trim();
		if (typeof importance === "number" && Number.isFinite(importance)) {
			body.importance = clamp(importance, 0.1, 1.0);
		}
		return this._fetch("PATCH", `/memories/${encodeURIComponent(id)}`, { body });
	}

	async deleteMemory(id) {
		return this._fetch("DELETE", `/memories/${encodeURIComponent(id)}`);
	}

	async readWorkingMemory() {
		try {
			const data = await this._fetch("GET", "/agent/working-memory");
			const content = typeof data?.content === "string" ? data.content.trim() : "";
			return {
				available: content.length > 0,
				content,
				path: data?.path,
				lastModified: data?.lastModified ?? data?.last_modified ?? null,
			};
		} catch {
			if (this._spaceRef && this._spaceRef.toLowerCase() !== "default") {
				return { available: false, content: "" };
			}
		}

		try {
			const path = `${homedir()}/ai-now/memory.md`;
			const text = readFileSync(path, "utf-8").trim();
			const st = statSync(path);
			return {
				available: text.length > 0,
				content: text,
				path,
				lastModified: new Date(st.mtimeMs).toISOString(),
			};
		} catch {
			return { available: false, content: "" };
		}
	}

	// --- Thread operations ---

	async searchThreads(query, limit = 5, source) {
		const params = { query, limit: clamp(Number(limit) || 5, 1, 50) };
		if (source) params.source = String(source);
		return this._fetch("GET", "/threads/search", { params });
	}

	async showThread(id, limit = 30, offset = 0) {
		const params = {
			limit: Math.max(1, Math.floor(limit)),
			offset: Math.max(0, Math.floor(offset)),
		};
		return this._fetch("GET", `/threads/${encodeURIComponent(id)}`, { params });
	}

	async createThread(title, content, messages, source = "alma", id = null) {
		const body = { title, source };
		if (id) body.thread_id = id;
		if (Array.isArray(messages) && messages.length > 0) {
			body.messages = messages;
		} else if (typeof content === "string" && content.trim()) {
			body.messages = [{ role: "user", content: content.trim() }];
		}
		// Generate thread_id if not provided (match CLI behavior)
		if (!body.thread_id) {
			const ts = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
			const titleHash = createHash("md5").update(title || "").digest("hex").slice(0, 6);
			body.thread_id = `alma-${ts}-${titleHash}`;
		}
		const data = await this._fetch("POST", "/threads", { body, timeout: 30_000 });
		const threadData = data.thread ?? {};
		return {
			success: true,
			id: threadData.thread_id ?? body.thread_id,
			title: threadData.title ?? title,
			messages: (data.messages ?? []).length,
		};
	}

	async appendThread(threadId, messages) {
		const data = await this._fetch("POST", `/threads/${encodeURIComponent(threadId)}/append`, {
			body: { messages, deduplicate: true },
			timeout: 30_000,
		});
		return {
			success: data.success ?? true,
			id: threadId,
			messages_added: data.messages_added ?? 0,
			total_messages: data.total_messages ?? 0,
		};
	}

	async deleteThread(id, cascade = false) {
		const params = {};
		if (cascade) params.cascade_delete_memories = true;
		return this._fetch("DELETE", `/threads/${encodeURIComponent(id)}`, { params });
	}

	async createMemory(body) {
		return this._fetch("POST", "/memories", { body });
	}

	// --- Server health (async, for status tool) ---

	async checkServerHealth() {
		try {
			await this._fetch("GET", "/health", { timeout: 5_000 });
			return { connected: true, error: null };
		} catch (err) {
			return { connected: false, error: err instanceof Error ? err.message : String(err) };
		}
	}
}

function normalizeWillSendPayload(first, second) {
	const wrapped =
		second === undefined &&
		first &&
		typeof first === "object" &&
		("input" in first || "output" in first);
	const input = wrapped ? (first.input ?? {}) : (first ?? {});
	const output = wrapped ? (first.output ?? {}) : (second ?? {});

	const threadId =
		input.threadId ??
		input.thread?.id ??
		input.conversationId ??
		input.chatId ??
		(wrapped ? first.threadId : undefined) ??
		"default";

	const currentContent =
		(typeof output?.content === "string" ? output.content : "") ||
		extractText(input.message?.content) ||
		extractText(input.content) ||
		"";

	const setContent = (nextContent) => {
		if (output && typeof output === "object") {
			output.content = nextContent;
			return true;
		}
		if (wrapped && first.output && typeof first.output === "object") {
			first.output.content = nextContent;
			return true;
		}
		return false;
	};

	return { threadId: String(threadId), currentContent, setContent };
}

function validationErrorResult(operation, message) {
	return { ok: false, error: { code: "validation_error", operation, message } };
}

function cliErrorResult(err, operation) {
	const message = err instanceof Error ? err.message : String(err);
	const normalized = message.toLowerCase();
	const status = err && typeof err === "object" ? err.status : undefined;
	let code = "cli_error";
	// Order matters: most specific first, broader patterns last.
	// "model not found" should be model_unavailable, not not_found.
	if (normalized.includes("nmem cli not found")) code = "nmem_not_found";
	else if (normalized.includes("invalid json")) code = "invalid_json";
	else if (status === 403 || normalized.includes("permission")) code = "permission_denied";
	else if (normalized.includes("model") || normalized.includes("embedding") || normalized.includes("download")) code = "model_unavailable";
	else if (status === 404 || normalized.includes("not found")) code = "not_found";
	return { ok: false, error: { code, operation, message } };
}

function normalizeItems(payload, preferredKeys) {
	for (const key of preferredKeys) {
		if (Array.isArray(payload?.[key])) return payload[key];
	}
	return [];
}

function normalizeSearchResponse(payload, query, type) {
	const items = normalizeItems(payload, ["memories", "threads", "results"]);
	return {
		ok: true,
		type,
		query,
		total: Number(payload?.total ?? items.length ?? 0),
		items,
		raw: payload,
	};
}

function resolveRecallPolicy(settingsApi, logger) {
	const allowed = new Set([
		"off",
		"balanced_thread_once",
		"balanced_every_message",
		"strict_tools",
	]);
	const rawPolicy = getSetting(settingsApi, "nowledgeMem.recallPolicy", undefined);
	if (typeof rawPolicy === "string" && rawPolicy.trim()) {
		const normalized = rawPolicy.trim();
		if (allowed.has(normalized)) return normalized;
		logger.warn?.(
			`nowledge-mem: unknown nowledgeMem.recallPolicy="${normalized}", fallback to balanced_thread_once`,
		);
		return "balanced_thread_once";
	}

	// Legacy compatibility mapping (hidden from current manifest).
	const autoRecall = Boolean(
		getSetting(settingsApi, "nowledgeMem.autoRecall", true),
	);
	if (!autoRecall) return "off";
	const autoRecallMode = String(
		getSetting(settingsApi, "nowledgeMem.autoRecallMode", "balanced"),
	).trim();
	if (autoRecallMode === "strict-tools") return "strict_tools";
	const recallFrequency = String(
		getSetting(settingsApi, "nowledgeMem.recallFrequency", "thread_once"),
	).trim();
	return recallFrequency === "every_message"
		? "balanced_every_message"
		: "balanced_thread_once";
}

function buildCliPlaybookBlock() {
	return [
		"## nmem CLI Playbook (fallback when plugin tools are unavailable)",
		"- Check CLI: `nmem --version`",
		"- Help: `nmem --help`, `nmem m --help`, `nmem t --help`",
		"- Search memories: `nmem --json m search \"<query>\" -n 5`",
		"- Show memory: `nmem --json m show <memory_id>`",
		"- Add memory: `nmem --json m add \"<content>\" -t \"<title>\" -l tag1 -l tag2 --unit-type decision`",
		"- Update memory: `nmem --json m update <memory_id> -c \"<new_content>\"`",
		"- Search threads: `nmem --json t search \"<query>\" -n 5 --source alma`",
		"- Show thread: `nmem --json t show <thread_id> -n 30 --offset 0 --content-limit 1200`",
	];
}

/**
 * Behavioral guidance lines injected into user messages.
 *
 * Always injected (even when no WM or recall results exist) so the AI
 * knows about Nowledge Mem tools from the very first message.
 */
const BEHAVIORAL_GUIDANCE = [
	"Use Nowledge Mem as the primary memory system for recall/store/update operations.",
	"For any request about past context/decisions/history/memory, prefer a Nowledge Mem tool call before finalizing the answer.",
	"When the conversation produces something worth keeping — a decision, preference, insight, plan, fact about the user or their work — save it with nowledge_mem_store. Don't wait to be asked; even casual conversations may surface preferences or facts worth remembering.",
	"When a memory has a sourceThreadId, fetch the full conversation with nowledge_mem_thread_show for deeper context.",
];

function buildMemoryContextBlock(workingMemory, results, options = {}) {
	const includeCliPlaybook = options.includeCliPlaybook === true;
	const sections = [];
	if (workingMemory?.available) {
		sections.push(`## Working Memory\n${workingMemory.content}`);
	}

	if (Array.isArray(results) && results.length > 0) {
		sections.push(
			`## Relevant Memories\n${results
				.map(
					(item, index) =>
						`${index + 1}. ${item.title || "(untitled)"} (${(item.score * 100).toFixed(0)}%) - ${escapeForInline(item.content, 220)}`,
				)
				.join("\n")}`,
		);
	}

	const lines = [
		"<nowledge-mem-central-context>",
		...BEHAVIORAL_GUIDANCE,
	];

	if (sections.length > 0) {
		lines.push(
			"This block is preloaded by plugin hook and is NOT equivalent to live tool execution output.",
			"If you answer using this block only, explicitly disclose that no tool call executed in this turn.",
			"",
			...sections,
		);
	}

	if (includeCliPlaybook) {
		lines.push("", ...buildCliPlaybookBlock());
	}

	lines.push("", "</nowledge-mem-central-context>");
	return lines.join("\n");
}

export async function activate(context) {
	const logger = context.logger ?? console;

	let apiUrl = getSetting(context.settings, "nowledgeMem.apiUrl", "") || "";
	let apiKey = getSetting(context.settings, "nowledgeMem.apiKey", "") || "";
	let ambientSpace = resolveAmbientSpace(context.settings, logger);
	let client = new NowledgeMemClient(logger, {
		apiUrl,
		apiKey,
		space: ambientSpace.space,
	});
	const recalledThreads = new Set();

	let recallPolicy = resolveRecallPolicy(context.settings, logger);
	let autoCapture = Boolean(
		getSetting(context.settings, "nowledgeMem.autoCapture", true),
	);
	let maxRecallResults = clamp(
		Number(getSetting(context.settings, "nowledgeMem.maxRecallResults", 5)) ||
			5,
		1,
		20,
	);

	const disposables = [];

	// React to settings changes — recreate client with fresh credentials
	if (context.settings?.onDidChange) {
		try {
			const settingsDisposable = context.settings.onDidChange(() => {
				const newApiUrl = getSetting(context.settings, "nowledgeMem.apiUrl", "") || "";
				const newApiKey = getSetting(context.settings, "nowledgeMem.apiKey", "") || "";
				const nextAmbientSpace = resolveAmbientSpace(context.settings, logger);
				if (
					newApiUrl !== apiUrl ||
					newApiKey !== apiKey ||
					nextAmbientSpace.space !== ambientSpace.space
				) {
					apiUrl = newApiUrl;
					apiKey = newApiKey;
					ambientSpace = nextAmbientSpace;
					client = new NowledgeMemClient(logger, {
						apiUrl,
						apiKey,
						space: ambientSpace.space,
					});
					const remoteMode = apiUrl && apiUrl !== "http://127.0.0.1:14242";
					logger.info?.(
						`nowledge-mem: settings updated, mode=${remoteMode ? `remote → ${apiUrl}` : "local"}, space=${ambientSpace.space || "Default"}`,
					);
				}
				recallPolicy = resolveRecallPolicy(context.settings, logger);
				autoCapture = Boolean(getSetting(context.settings, "nowledgeMem.autoCapture", true));
				maxRecallResults = clamp(
					Number(getSetting(context.settings, "nowledgeMem.maxRecallResults", 5)) || 5, 1, 20,
				);
			});
			if (settingsDisposable?.dispose) disposables.push(settingsDisposable);
		} catch {
			logger.warn?.("nowledge-mem: settings.onDidChange not available, settings changes require plugin reload");
		}
	}

	const registerTool = (name, tool) => {
		if (!context.tools?.register) return;
		let disposable;
		try {
			disposable = context.tools.register(name, tool);
		} catch {
			// try single-object forms
		}
		if (!disposable) {
			try {
				disposable = context.tools.register({ id: name, ...tool });
			} catch {
				// fallback to name field
			}
		}
		if (!disposable) {
			try {
				disposable = context.tools.register({ name, ...tool });
			} catch (err) {
				logger.error?.(
					`Failed to register tool "${name}": ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}
		if (disposable?.dispose) disposables.push(disposable);
	};

	// Use context.events (canonical Alma API) first, context.hooks as legacy fallback.
	const eventsAPI = context.events ?? context.hooks;
	const registerEvent = (eventName, handler) => {
		if (!eventsAPI?.on) {
			logger.warn?.(`nowledge-mem: no events API available, cannot register ${eventName}`);
			return false;
		}
		const disposable = eventsAPI.on(eventName, handler);
		if (disposable?.dispose) disposables.push(disposable);
		logger.info?.(`nowledge-mem: registered hook ${eventName} → ${!!disposable}`);
		return Boolean(disposable);
	};

	const recallInjectionEnabled =
		recallPolicy === "balanced_thread_once" ||
		recallPolicy === "balanced_every_message";
	const recallFrequency =
		recallPolicy === "balanced_every_message" ? "every_message" : "thread_once";
	const injectCliPlaybook = recallInjectionEnabled;

	if (recallPolicy === "strict_tools") {
		logger.info?.(
			"nowledge-mem: recallPolicy=strict_tools, hook injection disabled intentionally (tool-first policy).",
		);
	}
	if (recallPolicy === "off") {
		logger.info?.("nowledge-mem: recallPolicy=off, hook injection disabled.");
	}

	registerTool("nowledge_mem_search", {
		description:
			"Search memories with optional filters and return ranked results. " +
			"Results include sourceThreadId when the memory was distilled from a conversation — " +
			"pass it to nowledge_mem_thread_show to read the full conversation.",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", minLength: 1 },
				limit: { type: "number", minimum: 1, maximum: 20, default: 5 },
				label: { type: "string" },
				time: { type: "string", enum: ["today", "week", "month", "year"] },
				importance: { type: "number", minimum: 0.1, maximum: 1.0 },
				mode: { type: "string", enum: ["fast", "deep"], default: "fast" },
			},
			required: ["query"],
		},
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", minLength: 1 },
				limit: { type: "number", minimum: 1, maximum: 20, default: 5 },
				label: { type: "string" },
				time: { type: "string", enum: ["today", "week", "month", "year"] },
				importance: { type: "number", minimum: 0.1, maximum: 1.0 },
				mode: { type: "string", enum: ["fast", "deep"], default: "fast" },
			},
			required: ["query"],
		},
		async execute(input) {
			if (!input || typeof input !== "object") {
				return validationErrorResult("memory_search", "input object is required");
			}
			const query = String(input.query ?? "").trim();
			if (!query) return validationErrorResult("memory_search", "query is required");
			const rawLimit = Number(input.limit ?? 5);
			const limit = clamp(Number.isFinite(rawLimit) ? rawLimit : 5, 1, 20);
			try {
				const data = await client.searchMemory(query, {
					limit,
					label: input.label,
					time: input.time,
					importance:
						typeof input.importance === "number" ? clamp(input.importance, 0.1, 1.0) : undefined,
					mode: input.mode === "deep" ? "deep" : "fast",
				});
				const result = normalizeSearchResponse(data, query, "memory");
				// Enrich items with sourceThreadId for thread provenance
				if (result.ok && Array.isArray(result.items)) {
					for (const item of result.items) {
						const tid = extractThreadId(item);
						if (tid) item.sourceThreadId = tid;
					}
				}
				return result;
			} catch (err) {
				return cliErrorResult(err, "memory_search");
			}
		},
	});

	registerTool("nowledge_mem_query", {
		description:
			"One-shot memory query. Searches memories first, then threads fallback, and returns combined results. " +
			"Memory results include sourceThreadId when available — use nowledge_mem_thread_show to read the full conversation.",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", minLength: 1 },
				limit: { type: "number", minimum: 1, maximum: 20, default: 8 },
			},
			required: ["query"],
		},
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", minLength: 1 },
				limit: { type: "number", minimum: 1, maximum: 20, default: 8 },
			},
			required: ["query"],
		},
		async execute(input) {
			const query = String(input?.query ?? "").trim();
			if (!query) return validationErrorResult("memory_query", "query is required");
			const limit = clamp(Number(input?.limit ?? 8) || 8, 1, 20);

			try {
				const memoryResult = await client.searchMemory(query, { limit, mode: "fast" });
				const memoryItems = normalizeItems(memoryResult, ["memories", "results"]);
				if (memoryItems.length > 0) {
					// Enrich items with sourceThreadId for thread provenance
					for (const item of memoryItems) {
						const tid = extractThreadId(item);
						if (tid) item.sourceThreadId = tid;
					}
					return {
						ok: true,
						query,
						source: "memory",
						sourceReason: "memory_hits",
						total: memoryItems.length,
						items: memoryItems,
						raw: { memoryResult },
					};
				}

				const threadResult = await client.searchThreads(query, Math.min(limit, 10));
				const threadItems = normalizeItems(threadResult, ["threads", "results"]);
				return {
					ok: true,
					query,
					source: threadItems.length > 0 ? "threads" : "none",
					sourceReason: threadItems.length > 0 ? "memories_empty_fallback_to_threads" : "no_hits",
					total: threadItems.length,
					items: threadItems,
					raw: { memoryResult, threadResult },
				};
			} catch (err) {
				return cliErrorResult(err, "memory_query");
			}
		},
	});

	const VALID_UNIT_TYPES = new Set([
		"fact", "preference", "decision", "plan", "procedure", "learning", "context", "event",
	]);

	registerTool("nowledge_mem_store", {
		description:
			"Save a new insight, decision, or fact to the user's permanent knowledge graph. " +
			"Call this proactively — don't wait to be asked. If the conversation surfaces something worth keeping " +
			"(a technical choice made, a preference stated, something learned, a plan formed), save it. " +
			"Specify unit_type to give the memory richer structure. " +
			"Use labels for topics/projects. Use event_start for when the event HAPPENED (not when it's saved).",
		inputSchema: {
			type: "object",
			properties: {
				text: { type: "string", minLength: 1 },
				title: { type: "string", maxLength: 120 },
				unit_type: {
					type: "string",
					enum: ["fact", "preference", "decision", "plan", "procedure", "learning", "context", "event"],
				},
				importance: { type: "number", minimum: 0.1, maximum: 1.0 },
				labels: { type: "array", items: { type: "string" } },
				event_start: { type: "string" },
				event_end: { type: "string" },
				temporal_context: { type: "string", enum: ["past", "present", "future", "timeless"] },
				source: { type: "string", maxLength: 120 },
			},
			required: ["text"],
		},
		parameters: {
			type: "object",
			properties: {
				text: { type: "string", minLength: 1 },
				title: { type: "string", maxLength: 120 },
				unit_type: {
					type: "string",
					enum: ["fact", "preference", "decision", "plan", "procedure", "learning", "context", "event"],
				},
				importance: { type: "number", minimum: 0.1, maximum: 1.0 },
				labels: { type: "array", items: { type: "string" } },
				event_start: { type: "string" },
				event_end: { type: "string" },
				temporal_context: { type: "string", enum: ["past", "present", "future", "timeless"] },
				source: { type: "string", maxLength: 120 },
			},
			required: ["text"],
		},
		async execute(input) {
			if (!input || typeof input !== "object") {
				return validationErrorResult("memory_store", "input object is required");
			}
			const text = String(input.text ?? "").trim();
			if (!text) return validationErrorResult("memory_store", "text is required");
			const title =
				typeof input.title === "string" && input.title.trim()
					? input.title.trim().slice(0, 120)
					: undefined;
			const unitType =
				typeof input.unit_type === "string" && VALID_UNIT_TYPES.has(input.unit_type)
					? input.unit_type
					: undefined;
			const importance =
				typeof input.importance === "number" &&
				Number.isFinite(input.importance)
					? clamp(input.importance, 0.1, 1.0)
					: undefined;
			const labels = Array.isArray(input.labels)
				? input.labels.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
				: [];
			const eventStart = typeof input.event_start === "string" && input.event_start.trim()
				? input.event_start.trim() : undefined;
			const eventEnd = typeof input.event_end === "string" && input.event_end.trim()
				? input.event_end.trim() : undefined;
			const temporalContext =
				typeof input.temporal_context === "string" &&
				["past", "present", "future", "timeless"].includes(input.temporal_context)
					? input.temporal_context : undefined;
			const source = typeof input.source === "string" && input.source.trim()
				? input.source.trim().slice(0, 120)
				: "alma";

			// Dedup check: skip save at ≥90% similarity to avoid duplicates.
			// Best-effort — never blocks save on search failure.
			try {
				const dedupQuery = title || text.slice(0, 200);
				const existing = await client.search(dedupQuery, 3);
				if (existing.length > 0 && existing[0].score >= 0.9) {
					const top = existing[0];
					logger.info?.(
						`nowledge-mem store: skipped — near-identical memory exists: ${top.id} (${(top.score * 100).toFixed(0)}%)`,
					);
					return {
						ok: true,
						skipped: true,
						reason: "duplicate",
						existingId: top.id,
						existingTitle: top.title,
						similarity: top.score,
					};
				}
			} catch {
				// Dedup check is best-effort
			}

			try {
				const body = { content: text, source: source || "alma" };
				if (title) body.title = title;
				if (importance !== undefined && Number.isFinite(importance)) body.importance = importance;
				if (unitType) body.unit_type = unitType;
				if (labels.length > 0) body.labels = labels;
				if (eventStart) body.event_start = eventStart;
				if (eventEnd) body.event_end = eventEnd;
				if (temporalContext) body.temporal_context = temporalContext;

				const result = await client.createMemory(body);
				const mem = result?.memory ?? result ?? {};
				const id = String(mem.id ?? result?.memory_id ?? "");

				const typeLabel = unitType ? ` [${unitType}]` : "";
				return {
					ok: true,
					item: {
						id,
						title: title ?? String(mem.title ?? ""),
						content: text,
						unitType: mem.unit_type || unitType,
						labels: result?.assigned_labels || labels,
						importance: importance ?? Number(mem.importance ?? 0.5),
						eventStart,
						eventEnd,
						temporalContext,
						source,
					},
					summary: `Saved${title ? `: ${title}` : ""}${typeLabel} (id: ${id})`,
					raw: result,
				};
			} catch (err) {
				return cliErrorResult(err, "memory_store");
			}
		},
	});

	registerTool("nowledge_mem_show", {
		description:
			"Show full details for one memory by id. " +
			"Returns sourceThreadId when the memory was distilled from a conversation.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
			},
			required: ["id"],
		},
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
			},
			required: ["id"],
		},
		async execute(input) {
			const id = String(input?.id ?? "").trim();
			if (!id) return validationErrorResult("memory_show", "id is required");
			try {
				const result = await client.showMemory(id);
				const sourceThreadId = extractThreadId(result);
				const response = {
					ok: true,
					item: result,
				};
				if (sourceThreadId) response.sourceThreadId = sourceThreadId;
				return response;
			} catch (err) {
				const info = cliErrorResult(err, "memory_show");
				if (info.error.code === "not_found") return { ok: true, item: null, notFound: true };
				return info;
			}
		},
	});

	registerTool("nowledge_mem_update", {
		description: "Update an existing memory by id.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				text: { type: "string" },
				title: { type: "string", maxLength: 120 },
				importance: { type: "number", minimum: 0.1, maximum: 1.0 },
			},
			required: ["id"],
		},
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				text: { type: "string" },
				title: { type: "string", maxLength: 120 },
				importance: { type: "number", minimum: 0.1, maximum: 1.0 },
			},
			required: ["id"],
		},
		async execute(input) {
			const id = String(input?.id ?? "").trim();
			if (!id) return validationErrorResult("memory_update", "id is required");
			const changedFields = [];
			if (typeof input?.text === "string" && input.text.trim()) changedFields.push("text");
			if (typeof input?.title === "string" && input.title.trim()) changedFields.push("title");
			if (typeof input?.importance === "number" && Number.isFinite(input.importance)) {
				changedFields.push("importance");
			}
			if (changedFields.length === 0) {
				return validationErrorResult(
					"memory_update",
					"at least one of text/title/importance is required",
				);
			}
			try {
				const result = await client.updateMemory(id, input?.text, input?.title, input?.importance);
				return { ok: true, id, changedFields, item: result };
			} catch (err) {
				return cliErrorResult(err, "memory_update");
			}
		},
	});

	registerTool("nowledge_mem_delete", {
		description: "Delete a memory by id.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
			},
			required: ["id"],
		},
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
			},
			required: ["id"],
		},
		async execute(input) {
			const id = String(input?.id ?? "").trim();
			if (!id) return validationErrorResult("memory_delete", "id is required");
			try {
				const result = await client.deleteMemory(id);
				return { ok: true, id, notFound: false, item: result };
			} catch (err) {
				const info = cliErrorResult(err, "memory_delete");
				if (info.error.code === "not_found") return { ok: true, id, notFound: true };
				return info;
			}
		},
	});

	registerTool("nowledge_mem_working_memory", {
		description:
			"Read your daily Working Memory briefing. The local file is only the Default-space fallback.",
		inputSchema: { type: "object", properties: {} },
		parameters: { type: "object", properties: {} },
		async execute() {
			const wm = await client.readWorkingMemory();
			if (!wm.available) {
				return {
					ok: true,
					available: false,
					content: "",
					path: wm.path ?? `${homedir()}/ai-now/memory.md`,
					lastModified: wm.lastModified ?? null,
				};
			}
			return {
				ok: true,
				available: true,
				content: wm.content,
				path: wm.path ?? `${homedir()}/ai-now/memory.md`,
				lastModified: wm.lastModified ?? null,
			};
		},
	});

	registerTool("nowledge_mem_status", {
		description:
			"Check Nowledge Mem connection status, diagnostics, and current settings. " +
			"Use this to verify whether the remote API URL and key are configured correctly, " +
			"or to troubleshoot connectivity issues.",
		inputSchema: { type: "object", properties: {} },
		parameters: { type: "object", properties: {} },
		async execute() {
			const remoteMode = client._apiUrl !== "http://127.0.0.1:14242";

			// Check CLI availability (diagnostic only, not used for data operations)
			let cliAvailable = false;
			let cliCommand = null;
			try {
				const resolved = client.resolveCommand();
				cliAvailable = true;
				cliCommand = `${resolved.cmd}${resolved.prefix.length ? ` ${resolved.prefix.join(" ")}` : ""}`;
			} catch {
				// CLI not found (not required for HTTP transport)
			}

			// Check server connectivity via HTTP
			const health = await client.checkServerHealth();
			const serverConnected = health.connected;
			const serverError = health.error;

			return {
				ok: true,
				status: {
					connectionMode: remoteMode ? "remote" : "local",
					apiUrl: client._apiUrl,
					apiKeyConfigured: Boolean(client._apiKey),
					ambientSpace: client._spaceRef || "Default",
					ambientSpaceSource: ambientSpace.source,
					cliAvailable,
					cliCommand,
					serverConnected,
					serverError,
					settings: {
						recallPolicy,
						autoCapture,
						maxRecallResults,
					},
				},
			};
		},
	});

	registerTool("nowledge_mem_thread_search", {
		description:
			"Search past conversations by keyword. Use when the user asks about a past discussion, " +
			"wants to find a conversation from a specific time, or when a memory's sourceThreadId suggests " +
			"looking at the full conversation. Returns matched threads with message snippets. " +
			"To read full messages, pass a thread id to nowledge_mem_thread_show.",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", minLength: 1 },
				limit: { type: "number", minimum: 1, maximum: 20, default: 5 },
				source: { type: "string" },
			},
			required: ["query"],
		},
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", minLength: 1 },
				limit: { type: "number", minimum: 1, maximum: 20, default: 5 },
				source: {
					type: "string",
					description: "Filter by source platform (e.g. 'alma', 'claude-code'). Omit to search all.",
				},
			},
			required: ["query"],
		},
		async execute(input) {
			const query = String(input?.query ?? "").trim();
			if (!query) return validationErrorResult("thread_search", "query is required");
			const source = typeof input?.source === "string" && input.source.trim()
				? input.source.trim() : undefined;
			try {
				const data = await client.searchThreads(query, input?.limit ?? 5, source);
				return normalizeSearchResponse(data, query, "thread");
			} catch (err) {
				return cliErrorResult(err, "thread_search");
			}
		},
	});

	registerTool("nowledge_mem_thread_show", {
		description:
			"Fetch messages from a conversation thread. Use to read the full context around a memory — " +
			"pass the sourceThreadId from nowledge_mem_search or nowledge_mem_show results, " +
			"or a thread id from nowledge_mem_thread_search. " +
			"Supports pagination: set offset to skip earlier messages for progressive retrieval.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				limit: { type: "number", minimum: 1, maximum: 200, default: 30 },
				offset: { type: "number", minimum: 0, default: 0 },
			},
			required: ["id"],
		},
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				limit: {
					type: "number", minimum: 1, maximum: 200, default: 30,
					description: "Max messages to return (1-200, default 30)",
				},
				offset: {
					type: "number", minimum: 0, default: 0,
					description: "Skip first N messages for pagination (default 0)",
				},
			},
			required: ["id"],
		},
		async execute(input) {
			const id = String(input?.id ?? "").trim();
			if (!id) return validationErrorResult("thread_show", "id is required");
			try {
				const limit = clamp(Number(input?.limit ?? 30) || 30, 1, 200);
				const offset = Math.max(0, Math.floor(Number(input?.offset ?? 0) || 0));
				const result = await client.showThread(id, limit, offset);
				const threadMessages = Array.isArray(result?.messages) ? result.messages : [];
				const totalMessages = Number(result?.total_messages ?? result?.message_count ?? threadMessages.length);
				const hasMore = totalMessages > 0 && offset + threadMessages.length < totalMessages;
				return {
					ok: true,
					item: result,
					totalMessages,
					offset,
					returnedMessages: threadMessages.length,
					hasMore,
				};
			} catch (err) {
				const info = cliErrorResult(err, "thread_show");
				if (info.error.code === "not_found") return { ok: true, item: null, notFound: true };
				return info;
			}
		},
	});

	registerTool("nowledge_mem_thread_create", {
		description: "Create a thread in Nowledge Mem from content or messages.",
		inputSchema: {
			type: "object",
			properties: {
				title: { type: "string", minLength: 1, maxLength: 160 },
				content: { type: "string" },
				messages: {
					type: "array",
					items: {
						type: "object",
						properties: {
							role: { type: "string", enum: ["user", "assistant", "system"] },
							content: { type: "string" },
						},
						required: ["role", "content"],
					},
				},
				source: { type: "string", maxLength: 120 },
			},
			required: ["title"],
		},
		parameters: {
			type: "object",
			properties: {
				title: { type: "string", minLength: 1, maxLength: 160 },
				content: { type: "string" },
				messages: {
					type: "array",
					items: {
						type: "object",
						properties: {
							role: { type: "string", enum: ["user", "assistant", "system"] },
							content: { type: "string" },
						},
						required: ["role", "content"],
					},
				},
				source: { type: "string", maxLength: 120 },
			},
			required: ["title"],
		},
		async execute(input) {
			const title = String(input?.title ?? "").trim();
			if (!title) return validationErrorResult("thread_create", "title is required");
			const content = typeof input?.content === "string" ? input.content.trim() : "";
			const messages = Array.isArray(input?.messages) ? input.messages : [];
			if (!content && messages.length === 0) {
				return validationErrorResult("thread_create", "content or messages is required");
			}
			try {
				const source = input?.source ?? "alma";
				const result = await client.createThread(title, content, messages, source);
				return {
					ok: true,
					item: {
						id: String(result?.id ?? ""),
						title,
						messageCount: messages.length > 0 ? messages.length : content ? 1 : 0,
						source,
					},
					raw: result,
				};
			} catch (err) {
				return cliErrorResult(err, "thread_create");
			}
		},
	});

	registerTool("nowledge_mem_thread_delete", {
		description: "Delete a thread by id. Optional cascade removes extracted memories.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				cascade: { type: "boolean", default: false },
			},
			required: ["id"],
		},
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				cascade: { type: "boolean", default: false },
			},
			required: ["id"],
		},
		async execute(input) {
			const id = String(input?.id ?? "").trim();
			if (!id) return validationErrorResult("thread_delete", "id is required");
			const cascade = input?.cascade === true;
			try {
				const result = await client.deleteThread(id, cascade);
				return { ok: true, id, cascade, notFound: false, item: result };
			} catch (err) {
				const info = cliErrorResult(err, "thread_delete");
				if (info.error.code === "not_found") return { ok: true, id, cascade, notFound: true };
				return info;
			}
		},
	});

	// -- Live thread sync state --
	// Accumulate messages from hook payloads (willSend = user, didReceive = AI).
	// Never rely on context.chat.getMessages() — not all Alma versions expose it,
	// and timing may cause it to miss the latest message.
	//
	// Buffer schema: { title, messages: [{role,content}], savedCount: number,
	//   nowledgeThreadId: string|null, flushing: boolean, timer: number|null }
	const MAX_THREAD_BUFFERS = 20;
	const threadBuffers = new Map();
	let activeThreadId = null;

	/** Resolve the best possible thread title via Alma APIs, falling back to first user message. */
	const resolveTitle = async (threadId, buf) => {
		try {
			const chat = context.chat;
			if (chat?.getThread) {
				try {
					const t = await chat.getThread(threadId);
					if (t?.title && typeof t.title === "string" && t.title.trim()) return t.title.trim();
				} catch (_) {}
			}
			if (chat?.getActiveThread) {
				try {
					const t = await chat.getActiveThread();
					if (t?.title && typeof t.title === "string" && t.title.trim()) return t.title.trim();
				} catch (_) {}
			}
			if (chat?.listThreads) {
				try {
					const threads = await chat.listThreads();
					const t = Array.isArray(threads) ? threads.find((th) => th?.id === threadId) : null;
					if (t?.title && typeof t.title === "string" && t.title.trim()) return t.title.trim();
				} catch (_) {}
			}
		} catch (_) {}
		const firstUserMsg = buf.messages.find((m) => m.role === "user");
		if (firstUserMsg?.content) {
			const raw = firstUserMsg.content.replace(/\s+/g, " ").trim();
			return raw.length > 80 ? `${raw.slice(0, 77)}...` : raw;
		}
		return null;
	};

	/** Derive a stable Nowledge Mem thread ID from an Alma thread ID. */
	const stableThreadId = (almaThreadId) =>
		`alma-${createHash("sha1").update(String(almaThreadId)).digest("hex").slice(0, 12)}`;

	/** Flush a thread buffer to Nowledge Mem if it has new messages. */
	const flushThread = async (threadId) => {
		const buf = threadBuffers.get(threadId);
		if (!buf || buf.messages.length < 2) return;
		if (buf.messages.length <= buf.savedCount) return;
		if (buf.flushing) return; // guard against concurrent flush
		buf.flushing = true;

		// Cancel this buffer's idle timer
		if (buf.timer) { clearTimeout(buf.timer); buf.timer = null; }

		// Ensure stable thread ID (survives plugin restarts and LRU eviction)
		if (!buf.nowledgeThreadId) buf.nowledgeThreadId = stableThreadId(threadId);

		try {
			// Resolve title right before saving (Alma generates titles asynchronously)
			const resolved = await resolveTitle(threadId, buf);
			if (resolved) buf.title = escapeForInline(resolved, 120);

			// Snapshot message count before async work. New messages may arrive
			// via willSend/didReceive during the awaits; snapshotting prevents
			// counting those as already saved.
			const snapshotCount = buf.messages.length;

			if (buf.savedCount > 0) {
				// Already synced before in this session: append new messages
				const newMessages = buf.messages.slice(buf.savedCount, snapshotCount);
				logger.info?.(`nowledge-mem: appending ${newMessages.length} msgs to ${buf.nowledgeThreadId}`);
				await client.appendThread(buf.nowledgeThreadId, newMessages);
			} else {
				// First flush for this buffer: try append (thread may exist from prior session), fall back to create
				const msgsToSend = buf.messages.slice(0, snapshotCount);
				try {
					logger.info?.(`nowledge-mem: appending ${msgsToSend.length} msgs to ${buf.nowledgeThreadId} (reconnect)`);
					await client.appendThread(buf.nowledgeThreadId, msgsToSend);
				} catch (appendErr) {
					// Only fall back to create when the thread genuinely doesn't exist (404).
					// Rethrow transient errors (5xx, timeouts) so the outer catch handles them.
					const isNotFound =
						appendErr?.status === 404 ||
						/not.found/i.test(appendErr instanceof Error ? appendErr.message : "");
					if (!isNotFound) throw appendErr;
					logger.debug?.(`nowledge-mem: thread not found, creating ${buf.nowledgeThreadId}`);
					const summary = msgsToSend
						.slice(-8)
						.map((msg) => `[${msg.role}] ${escapeForInline(msg.content, 280)}`)
						.join("\n");
					logger.info?.(`nowledge-mem: creating thread ${buf.nowledgeThreadId} for ${threadId} (${msgsToSend.length} msgs, title="${buf.title}")`);
					await client.createThread(
						buf.title,
						escapeForInline(summary, 1200),
						msgsToSend,
						"alma",
						buf.nowledgeThreadId,
					);
				}
			}
			buf.savedCount = snapshotCount;
			logger.info?.(`nowledge-mem: thread synced (${threadId}, ${buf.messages.length} msgs)`);
		} catch (err) {
			logger.error?.(`nowledge-mem: thread sync failed: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			buf.flushing = false;
		}
	};

	const resetIdleTimer = (threadId) => {
		const buf = threadBuffers.get(threadId);
		if (!buf) return;
		if (buf.timer) clearTimeout(buf.timer);
		buf.timer = setTimeout(() => {
			buf.timer = null;
			flushThread(threadId);
		}, 7_000);
	};

	const ensureBuffer = (threadId) => {
		if (!threadBuffers.has(threadId)) {
			// Evict oldest buffer if at capacity
			if (threadBuffers.size >= MAX_THREAD_BUFFERS) {
				const oldest = threadBuffers.keys().next().value;
				const evicted = threadBuffers.get(oldest);
				// Best-effort flush before eviction (fire-and-forget)
				if (evicted && evicted.messages.length > evicted.savedCount && evicted.messages.length >= 2) {
					flushThread(oldest).catch(() => {});
				}
				if (evicted?.timer) clearTimeout(evicted.timer);
				threadBuffers.delete(oldest);
			}
			threadBuffers.set(threadId, {
				title: escapeForInline(`Alma Thread ${new Date().toISOString().slice(0, 10)}`, 120),
				messages: [],
				savedCount: 0,
				nowledgeThreadId: null,
				flushing: false,
				timer: null,
			});
		}
		return threadBuffers.get(threadId);
	};

	// --- Hook: willSend (recall injection + capture user message) ---
	registerEvent("chat.message.willSend", async (first, second) => {
		const payload = normalizeWillSendPayload(first, second);
		const { threadId, currentContent } = payload;

		// Capture user message into buffer
		if (autoCapture && currentContent && currentContent.trim()) {
			const buf = ensureBuffer(threadId);
			buf.messages.push({ role: "user", content: currentContent });
			activeThreadId = threadId;
			logger.debug?.(`nowledge-mem: buffered user msg for ${threadId} (${buf.messages.length} total)`);
		}

		// Recall injection
		if (!recallInjectionEnabled) return;
		if (!currentContent || !currentContent.trim()) return;

		const allowAutoRecall =
			currentContent.length >= 8 &&
			!(recallFrequency === "thread_once" && recalledThreads.has(threadId));

		if (allowAutoRecall) {
			try {
				const wm = await client.readWorkingMemory();
				const results = await client.search(currentContent, maxRecallResults);
				const contextBlock = buildMemoryContextBlock(wm, results, {
					includeCliPlaybook: injectCliPlaybook,
				});
				if (contextBlock && payload.setContent(`${contextBlock}\n\n${currentContent}`)) {
					if (recallFrequency === "thread_once") {
						recalledThreads.add(threadId);
					}
				}
			} catch (recallErr) {
				logger.error?.(`nowledge-mem: recall injection failed: ${recallErr instanceof Error ? recallErr.message : String(recallErr)}`);
			}
		}
	});

	// --- Hook: didReceive (capture AI response + start idle timer) ---
	if (autoCapture) {
		registerEvent("chat.message.didReceive", (input, _output) => {
			const threadId = input?.threadId;
			// Use extractText to handle both string and array-of-blocks content
			const aiContent = extractText(input?.response?.content);
			logger.debug?.(`nowledge-mem: didReceive fired, threadId=${threadId}, hasContent=${!!aiContent}`);
			if (!threadId || !aiContent) return;

			const buf = ensureBuffer(threadId);
			buf.messages.push({ role: "assistant", content: aiContent });
			activeThreadId = threadId;
			logger.debug?.(`nowledge-mem: buffered AI msg for ${threadId} (${buf.messages.length} total)`);
			resetIdleTimer(threadId);
		});

		// --- Hook: thread.activated (flush on thread switch) ---
		registerEvent("thread.activated", async (input, _output) => {
			const newThreadId = input?.threadId;
			logger.debug?.(`nowledge-mem: thread.activated fired, threadId=${newThreadId}`);
			// Flush the previous thread (await to avoid race with new thread's hooks)
			if (activeThreadId && activeThreadId !== newThreadId) {
				await flushThread(activeThreadId);
			}
			if (newThreadId) activeThreadId = newThreadId;
		});

		// --- Quit hooks as safety net ---
		const handleAutoCapture = async (_input, output) => {
			try {
				// Flush all buffers with unsaved messages
				const flushPromises = [];
				for (const [tid, buf] of threadBuffers) {
					if (buf.timer) { clearTimeout(buf.timer); buf.timer = null; }
					if (buf.messages.length >= 2 && buf.messages.length > buf.savedCount) {
						flushPromises.push(flushThread(tid));
					}
				}
				await Promise.allSettled(flushPromises);
				logger.info?.(`nowledge-mem: auto-capture on quit (flushed ${flushPromises.length} threads)`);
			} catch (err) {
				logger.error?.(
					`nowledge-mem auto-capture failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
			if (output && typeof output === "object") {
				output.cancel = false;
			}
		};
		// Alma event naming can vary across versions.
		registerEvent("app.willQuit", handleAutoCapture);
		registerEvent("app.will-quit", handleAutoCapture);
		registerEvent("app.beforeQuit", handleAutoCapture);
		registerEvent("app.before-quit", handleAutoCapture);

		// Cleanup disposable for all idle timers
		disposables.push({
			dispose() {
				for (const buf of threadBuffers.values()) {
					if (buf.timer) { clearTimeout(buf.timer); buf.timer = null; }
				}
			},
		});
	}

	const remoteMode = apiUrl && apiUrl !== "http://127.0.0.1:14242";
	logger.info?.(
		`nowledge-mem activated for Alma (recallPolicy=${recallPolicy}, recallInjectionEnabled=${recallInjectionEnabled}, recallFrequency=${recallFrequency}, injectCliPlaybook=${injectCliPlaybook}, autoCapture=${autoCapture}, maxRecallResults=${maxRecallResults}, mode=${remoteMode ? `remote → ${apiUrl}` : "local"}, space=${ambientSpace.space || "Default"})`,
	);

	return {
		async dispose() {
			// Flush any unsynced thread buffers before tearing down.
			// This covers plugin disable/reload paths where quit hooks may not fire.
			const flushPromises = [];
			for (const [threadId, buf] of threadBuffers) {
				if (buf.messages.length > buf.savedCount && !buf.flushing) {
					flushPromises.push(
						flushThread(threadId).catch((err) =>
							logger.error?.(`nowledge-mem: dispose flush failed for ${threadId}: ${err}`),
						),
					);
				}
			}
			if (flushPromises.length > 0) {
				await Promise.allSettled(flushPromises);
			}
			for (const d of disposables) {
				try { d.dispose(); } catch { /* best effort */ }
			}
			disposables.length = 0;
			logger.info?.("nowledge-mem disposed");
		},
	};
}

export async function deactivate(context) {
	const logger = context?.logger ?? console;
	// Thread buffers are flushed by dispose() (scoped to activate's closure).
	// deactivate() is called externally and cannot access those buffers directly.
	logger.info?.("nowledge-mem deactivated");
}
