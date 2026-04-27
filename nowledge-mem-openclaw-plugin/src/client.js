import { buildNmemSpawnEnv } from "./spawn-env.js";

/**
 * Patch a single markdown section in a Working Memory document.
 * Returns the updated document string, or null if heading not found.
 *
 * @param {string} currentContent  Full WM markdown content
 * @param {string} heading         Partial or full heading to match (case-insensitive)
 * @param {{ content?: string; append?: string }} options
 */
function patchWmSection(currentContent, heading, { content, append } = {}) {
	const lines = currentContent.split("\n");
	const headingLc = heading.trim().toLowerCase();

	// Infer section level from the heading prefix (## = 2, ### = 3, etc.)
	const levelMatch = headingLc.match(/^(#{1,6})\s/);
	const targetLevel = levelMatch ? levelMatch[1].length : 2;

	// Find the start of the section (exact heading match, not substring)
	let startIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].trim().toLowerCase() === headingLc) {
			startIdx = i;
			break;
		}
	}
	if (startIdx === -1) return null;

	// Find end of section (next heading at same or higher level)
	let endIdx = lines.length;
	for (let i = startIdx + 1; i < lines.length; i++) {
		const m = lines[i].match(/^(#{1,6})\s/);
		if (m && m[1].length <= targetLevel) {
			endIdx = i;
			break;
		}
	}

	const headingLine = lines[startIdx];
	const bodyLines = lines.slice(startIdx + 1, endIdx);

	let newBody;
	if (append !== undefined) {
		const existing = bodyLines.join("\n").trimEnd();
		newBody = `${existing}\n${append.trim()}`;
	} else {
		newBody = (content ?? "").trimEnd();
	}

	const newSection = [headingLine, newBody].filter(Boolean).join("\n");
	return [...lines.slice(0, startIdx), newSection, ...lines.slice(endIdx)].join(
		"\n",
	);
}

/**
 * Nowledge Mem client. Wraps the nmem CLI plus direct API calls.
 *
 * Most interactive reads/writes stay CLI-first for local-first ergonomics.
 * Thread create/append are API-first because large message batches should
 * travel in an HTTP body, not as a single argv-sized JSON argument.
 *
 * Credential rules:
 * - apiUrl: passed to CLI via --api-url flag (not a secret)
 * - apiKey: injected into the command runner env as NMEM_API_KEY ONLY
 *   (never passed as a CLI arg to avoid exposure in `ps aux`)
 *   (never logged, even at debug level)
 */
export class NowledgeMemClient {
	/**
	 * @param {object} logger
	 * @param {object} runtimeSystem
	 * @param {{ apiUrl?: string; apiKey?: string; space?: string; spaceId?: string }} [credentials]
	 */
	constructor(logger, runtimeSystem, credentials = {}) {
		this.logger = logger;
		this.runtimeSystem = runtimeSystem;
		this.nmemCmd = null;
		this.nmemCmdPromise = null;
		// Resolved once from config + env (config wins over env, both win over default)
		this._apiUrl = (
			(credentials.apiUrl || "").trim() || "http://127.0.0.1:14242"
		).replace(/\/+$/, "");
		this._apiKey = (credentials.apiKey || "").trim();
		const hasSpace = Object.prototype.hasOwnProperty.call(credentials, "space");
		const hasSpaceId = Object.prototype.hasOwnProperty.call(
			credentials,
			"spaceId",
		);
		this._hasExplicitSpace = hasSpace || hasSpaceId;
		const resolvedSpace = hasSpace
			? credentials.space
			: hasSpaceId
				? credentials.spaceId
				: "";
		this._spaceRef = String(resolvedSpace ?? "").trim();
	}

	// ── API helpers (fallback path and direct operations) ─────────────────────

	getApiBaseUrl() {
		return this._apiUrl;
	}

	getApiHeaders() {
		const headers = { "content-type": "application/json" };
		if (this._apiKey) {
			headers.authorization = `Bearer ${this._apiKey}`;
			headers["x-nmem-api-key"] = this._apiKey;
		}
		return headers;
	}

	_withSpaceQuery(path) {
		if (!this._spaceRef) return path;
		const [pathname, rawQuery = ""] = String(path).split("?", 2);
		const query = new URLSearchParams(rawQuery);
		if (!query.has("space_id")) {
			query.set("space_id", this._spaceRef);
		}
		const rendered = query.toString();
		return rendered ? `${pathname}?${rendered}` : pathname;
	}

	_withSpaceBody(body) {
		if (!this._spaceRef || body == null || Array.isArray(body)) {
			return body;
		}
		if (Object.prototype.hasOwnProperty.call(body, "space_id")) {
			return body;
		}
		return { ...body, space_id: this._spaceRef };
	}

	async apiJson(method, path, body, timeout = 30_000) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);
		const scopedPath = this._withSpaceQuery(path);
		const scopedBody = this._withSpaceBody(body);
		try {
			const requestBody =
				scopedBody === undefined ? undefined : JSON.stringify(scopedBody);
			const request = async (requestPath) => {
				const response = await fetch(`${this.getApiBaseUrl()}${requestPath}`, {
					method,
					headers: this.getApiHeaders(),
					body: requestBody,
					signal: controller.signal,
				});
				const text = await response.text();
				let data = {};
				try {
					data = text ? JSON.parse(text) : {};
				} catch {
					data = { raw: text };
				}
				return { response, data };
			};

			let { response, data } = await request(scopedPath);
			if (!response.ok) {
				const detail =
					typeof data?.detail === "string"
						? data.detail
						: typeof data?.message === "string"
							? data.message
							: typeof data?.raw === "string"
								? data.raw
								: `HTTP ${response.status}`;
				throw new Error(detail);
			}
			return data;
		} finally {
			clearTimeout(timer);
		}
	}

	// ── CLI helpers ────────────────────────────────────────────────────────────

	async resolveCommand() {
		if (this.nmemCmd) return this.nmemCmd;
		if (this.nmemCmdPromise) return this.nmemCmdPromise;

		const candidates = [["nmem"], ["uvx", "--from", "nmem-cli", "nmem"]];

		this.nmemCmdPromise = (async () => {
			for (const cmd of candidates) {
				try {
					const result = await this.runtimeSystem.runCommandWithTimeout(
						[...cmd, "--version"],
						{
							timeoutMs: 10_000,
							env: this._spawnEnv(),
						},
					);
					if ((result.code ?? 1) === 0) {
						this.nmemCmd = cmd;
						this.logger.info(`nmem resolved: ${cmd.join(" ")}`);
						return cmd;
					}
				} catch {
					// Try the next candidate.
				}
			}

			throw new Error(
				"nmem CLI not found. Install with: pip install nmem-cli (or use uvx)",
			);
		})();

		try {
			return await this.nmemCmdPromise;
		} finally {
			this.nmemCmdPromise = null;
		}
	}

	/**
	 * Build the env for child process spawns.
	 * apiKey is injected here — NEVER via CLI args.
	 */
	_spawnEnv() {
		return buildNmemSpawnEnv({
			apiUrl: this._apiUrl,
			apiKey: this._apiKey,
			spaceId: this._spaceRef,
			hasExplicitSpace: this._hasExplicitSpace,
		});
	}

	/**
	 * Build base CLI args. --api-url is safe to pass as a flag (not a secret).
	 * The key is NEVER added here — it goes in env only.
	 */
	_apiUrlArgs() {
		return this._apiUrl !== "http://127.0.0.1:14242"
			? ["--api-url", this._apiUrl]
			: [];
	}

	_commandLabel(cmd, args) {
		let i = cmd.length;
		const argv = [...cmd, ...this._apiUrlArgs(), ...args];
		while (i < argv.length) {
			const token = argv[i];
			if (token === "--api-url") {
				i += 2;
				continue;
			}
			break;
		}
		const route = argv
			.slice(i, i + 2)
			.filter(Boolean)
			.join(" ");
		return route ? `nmem ${route}` : cmd.join(" ");
	}

	_summarizeExecError(message) {
		if (!message) return "failed";
		if (message.includes("timed out")) return "timed out";
		const codeMatch = message.match(/exited with code\s+(\d+)/i);
		if (codeMatch) return `exited with code ${codeMatch[1]}`;
		return "failed";
	}

	async exec(args, timeout = 30_000) {
		const cmd = await this.resolveCommand();
		const argv = [...cmd, ...this._apiUrlArgs(), ...args];
		const commandLabel = this._commandLabel(cmd, args);
		try {
			const result = await this.runtimeSystem.runCommandWithTimeout(argv, {
				timeoutMs: timeout,
				env: this._spawnEnv(),
			});
			if (
				result.termination === "timeout" ||
				result.termination === "no-output-timeout"
			) {
				const message =
					(result.stderr || result.stdout || "").trim() ||
					`nmem timed out after ${timeout}ms`;
				throw new Error(message);
			}
			if ((result.code ?? 1) !== 0) {
				const message = (result.stderr || result.stdout || "").trim();
				throw new Error(
					message || `nmem exited with code ${String(result.code)}`,
				);
			}
			return String(result.stdout ?? "").trim();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.logger.error(
				`nmem command failed (${commandLabel}): ${this._summarizeExecError(message)}`,
			);
			throw err;
		}
	}

	async execJson(args, timeout = 30_000) {
		const raw = await this.exec(args, timeout);
		return JSON.parse(raw);
	}

	// ── Search ────────────────────────────────────────────────────────────────

	/**
	 * Search memories via CLI. Returns rich metadata: relevance_reason,
	 * importance, labels, and temporal fields (added in CLI v0.4+).
	 */
	async search(query, limit = 5) {
		const normalizedLimit = Math.min(
			100,
			Math.max(1, Math.trunc(Number(limit) || 5)),
		);
		const data = await this.execJson([
			"--json",
			"m",
			"search",
			String(query),
			"-n",
			String(normalizedLimit),
		]);
		const memories = data.memories ?? data.results ?? [];
		return memories.map((m) => this._normalizeMemory(m));
	}

	/**
	 * searchRich — same as search(). The CLI now returns all rich fields
	 * (relevance_reason, importance, labels, temporal) natively.
	 */
	async searchRich(query, limit = 5) {
		return this.search(query, limit);
	}

	/**
	 * Bi-temporal search — filters by when the fact happened (event_date_*)
	 * or when it was saved (recorded_date_*).
	 *
	 * Uses CLI with --event-from/--event-to/--recorded-from/--recorded-to.
	 * Falls back to API if CLI is older than the bi-temporal update.
	 */
	async searchTemporal(
		query,
		{
			limit = 10,
			eventDateFrom,
			eventDateTo,
			recordedDateFrom,
			recordedDateTo,
		} = {},
	) {
		const normalizedLimit = Math.min(
			100,
			Math.max(1, Math.trunc(Number(limit) || 10)),
		);

		// Build CLI args
		const args = [
			"--json",
			"m",
			"search",
			String(query || ""),
			"-n",
			String(normalizedLimit),
		];
		if (eventDateFrom) args.push("--event-from", String(eventDateFrom));
		if (eventDateTo) args.push("--event-to", String(eventDateTo));
		if (recordedDateFrom)
			args.push("--recorded-from", String(recordedDateFrom));
		if (recordedDateTo) args.push("--recorded-to", String(recordedDateTo));

		let data;
		try {
			data = await this.execJson(args);
		} catch (err) {
			// Graceful fallback: CLI doesn't know --event-from yet → use API directly
			const message = err instanceof Error ? err.message : String(err);
			const needsFallback =
				message.includes("unrecognized arguments") ||
				message.includes("invalid choice");
			if (!needsFallback) throw err;

			this.logger.warn("searchTemporal: CLI too old, falling back to API");
			const qs = new URLSearchParams({ limit: String(normalizedLimit) });
			if (query) qs.set("q", String(query));
			if (eventDateFrom) qs.set("event_date_from", String(eventDateFrom));
			if (eventDateTo) qs.set("event_date_to", String(eventDateTo));
			if (recordedDateFrom)
				qs.set("recorded_date_from", String(recordedDateFrom));
			if (recordedDateTo) qs.set("recorded_date_to", String(recordedDateTo));
			const apiData = await this.apiJson(
				"GET",
				`/memories/search?${qs.toString()}`,
			);
			// Normalize from API response format
			const apiMems = (apiData.memories ?? []).map((m) => ({
				id: String(m.id ?? ""),
				title: String(m.title ?? ""),
				content: String(m.content ?? ""),
				score: Number(m.confidence ?? m.metadata?.similarity_score ?? 0),
				importance: Number(m.metadata?.importance ?? 0.5),
				relevance_reason: m.metadata?.relevance_reason ?? null,
				labels: m.label_ids ?? [],
				event_start: m.metadata?.event_start ?? null,
				event_end: m.metadata?.event_end ?? null,
				temporal_context: m.metadata?.temporal_context ?? null,
			}));
			return {
				memories: apiMems.map((m) => this._normalizeMemory(m)),
				searchMetadata: apiData.search_metadata ?? {},
			};
		}

		const memories = data.memories ?? data.results ?? [];
		return {
			memories: memories.map((m) => this._normalizeMemory(m)),
			searchMetadata: {},
		};
	}

	/**
	 * Normalize a memory object from either CLI or API response format.
	 * Output shape is canonical across all search paths.
	 */
	_normalizeMemory(m) {
		return {
			id: String(m.id ?? ""),
			title: String(m.title ?? ""),
			content: String(m.content ?? ""),
			score: Number(m.score ?? m.confidence ?? 0),
			importance: Number(m.importance ?? 0.5),
			relevanceReason: m.relevance_reason ?? null,
			labels: Array.isArray(m.labels) ? m.labels : (m.label_ids ?? []),
			eventStart: m.event_start ?? null,
			eventEnd: m.event_end ?? null,
			temporalContext: m.temporal_context ?? null,
			// Thread provenance: links memory to the conversation it was distilled from.
			// CLI returns `source_thread` (string), API returns `source_thread: {id, title}` (object).
			sourceThreadId:
				(typeof m.source_thread === "object" && m.source_thread?.id
					? String(m.source_thread.id)
					: typeof m.source_thread === "string" ? m.source_thread : null) ??
				m.source_thread_id ??
				m.metadata?.source_thread_id ??
				null,
		};
	}

	// ── Graph ─────────────────────────────────────────────────────────────────

	/**
	 * Expand the knowledge graph around a memory.
	 * Uses `nmem g expand <id>` (CLI v0.4+), falls back to API.
	 */
	async graphExpand(memoryId, { depth = 1, limit = 20 } = {}) {
		const args = [
			"--json",
			"g",
			"expand",
			String(memoryId),
			"--depth",
			String(depth),
			"-n",
			String(limit),
		];

		try {
			return await this.execJson(args);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const needsFallback =
				message.includes("unrecognized arguments") ||
				message.includes("invalid choice") ||
				message.includes("argument command: invalid choice");
			if (!needsFallback) throw err;

			this.logger.warn("graphExpand: CLI too old, falling back to API");
			return this.apiJson(
				"GET",
				`/graph/expand/${encodeURIComponent(memoryId)}?depth=${depth}&limit=${limit}`,
			);
		}
	}

	/**
	 * Get the EVOLVES version chain for a memory.
	 * Uses `nmem g evolves <id>` (CLI v0.4.1+), falls back to API.
	 *
	 * Returns edges where the memory appears as older or newer node,
	 * with relation type: replaces | enriches | confirms | challenges.
	 */
	async graphEvolves(memoryId, { limit = 20 } = {}) {
		const args = [
			"--json",
			"g",
			"evolves",
			String(memoryId),
			"-n",
			String(limit),
		];
		try {
			return await this.execJson(args);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const needsFallback =
				message.includes("unrecognized arguments") ||
				message.includes("invalid choice") ||
				message.includes("argument command: invalid choice");
			if (!needsFallback) throw err;

			this.logger.warn("graphEvolves: CLI too old, falling back to API");
			const qs = new URLSearchParams({
				memory_id: String(memoryId),
				limit: String(limit),
			});
			return this.apiJson("GET", `/agent/evolves?${qs.toString()}`);
		}
	}

	// ── Feed ──────────────────────────────────────────────────────────────────

	/**
	 * Fetch recent activity from the feed.
	 * Uses `nmem f` (CLI v0.4+), falls back to API.
	 *
	 * Date filtering (exact range):
	 *   dateFrom / dateTo: YYYY-MM-DD — when events were recorded.
	 *   Answers "what was I working on last Tuesday?" precisely.
	 */
	async feedEvents({
		lastNDays = 7,
		eventType,
		tier1Only = true,
		limit = 100,
		dateFrom,
		dateTo,
	} = {}) {
		const args = [
			"--json",
			"f",
			"--days",
			String(lastNDays),
			"-n",
			String(limit),
		];
		if (eventType) args.push("--type", String(eventType));
		if (!tier1Only) args.push("--all");
		if (dateFrom) args.push("--from", String(dateFrom));
		if (dateTo) args.push("--to", String(dateTo));

		try {
			const data = await this.execJson(args);
			return Array.isArray(data) ? data : (data.events ?? []);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const needsFallback =
				message.includes("unrecognized arguments") ||
				message.includes("invalid choice") ||
				message.includes("argument command: invalid choice");
			if (!needsFallback) throw err;

			this.logger.warn("feedEvents: CLI too old, falling back to API");
			const qs = new URLSearchParams({
				last_n_days: String(lastNDays),
				limit: String(limit),
			});
			if (eventType) qs.set("event_type", eventType);
			if (dateFrom) qs.set("date_from", String(dateFrom));
			if (dateTo) qs.set("date_to", String(dateTo));
			const data = await this.apiJson(
				"GET",
				`/agent/feed/events?${qs.toString()}`,
			);
			return Array.isArray(data) ? data : (data.events ?? []);
		}
	}

	// ── Memory CRUD ───────────────────────────────────────────────────────────

	async addMemory(content, title, importance) {
		const args = ["--json", "m", "add", String(content)];
		if (title) args.push("-t", String(title));
		if (importance !== undefined && Number.isFinite(Number(importance))) {
			args.push("-i", String(importance));
		}
		const data = await this.execJson(args);
		return String(data.id ?? data.memory?.id ?? data.memory_id ?? "created");
	}

	async createThread({ threadId, title, messages, source = "openclaw" }) {
		const normalizedTitle = String(title || "").trim();
		if (!normalizedTitle) {
			throw new Error("createThread requires a non-empty title");
		}
		if (!Array.isArray(messages) || messages.length === 0) {
			throw new Error("createThread requires at least one message");
		}

		const data = await this.apiJson(
			"POST",
			"/threads",
			{
				...(threadId ? { thread_id: String(threadId) } : {}),
				title: normalizedTitle,
				source: String(source),
				messages,
			},
		);

		return String(
			data.id ?? data.thread?.thread_id ?? data.thread_id ?? "created",
		);
	}

	async appendThread({
		threadId,
		messages,
		deduplicate = true,
		idempotencyKey,
	}) {
		const normalizedThreadId = String(threadId || "").trim();
		if (!normalizedThreadId) {
			throw new Error("appendThread requires threadId");
		}
		if (!Array.isArray(messages) || messages.length === 0) {
			return { messagesAdded: 0, totalMessages: 0 };
		}

		const data = await this.apiJson(
			"POST",
			`/threads/${encodeURIComponent(normalizedThreadId)}/append`,
			{
				messages,
				deduplicate,
				...(idempotencyKey
					? { idempotency_key: String(idempotencyKey) }
					: {}),
			},
		);
		return {
			messagesAdded: Number(data.messages_added ?? 0),
			totalMessages: Number(data.total_messages ?? 0),
		};
	}

	async getThreadMessageCount(threadId) {
		const normalizedThreadId = String(threadId || "").trim();
		if (!normalizedThreadId) {
			throw new Error("getThreadMessageCount requires threadId");
		}

		try {
			const data = await this.apiJson(
				"GET",
				`/threads/${encodeURIComponent(normalizedThreadId)}?limit=1`,
				undefined,
				15_000,
			);
			return Number(
				data.message_count ??
					data.total_messages ??
					(Array.isArray(data.messages) ? data.messages.length : 0),
			);
		} catch (err) {
			if (this.isThreadNotFoundError(err)) {
				return null;
			}
			throw err;
		}
	}

	async getMemory(memoryId) {
		const id = String(memoryId || "").trim();
		if (!id) {
			throw new Error("getMemory requires memoryId");
		}
		return await this.execJson(["--json", "m", "show", id]);
	}

	isThreadNotFoundError(err) {
		const message = (
			err instanceof Error ? err.message : String(err)
		).toLowerCase();
		return (
			message.includes("thread not found") ||
			message.includes("404") ||
			message.includes("not found")
		);
	}

	async readWorkingMemory() {
		try {
			const data = await this.execJson(["--json", "wm", "read"], 15_000);
			const content = String(data.content ?? "").trim();
			const exists = Boolean(data.exists);
			return { content, available: exists && content.length > 0 };
		} catch {
			return { content: "", available: false };
		}
	}

	/**
	 * Patch a single section of Working Memory without touching the rest.
	 * Uses `nmem wm patch` (CLI v0.4.1+) — client-side read-modify-write.
	 *
	 * @param {string} heading  Section heading to target (e.g. "## Focus Areas")
	 * @param {object} options
	 * @param {string} [options.content]  Replace the section body
	 * @param {string} [options.append]   Append text to the section body
	 */
	async patchWorkingMemory(heading, { content, append } = {}) {
		const args = ["--json", "wm", "patch", "--heading", String(heading)];
		if (content !== undefined) args.push("--content", String(content));
		if (append !== undefined) args.push("--append", String(append));

		try {
			return await this.execJson(args, 20_000);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const notSupported =
				message.includes("unrecognized arguments") ||
				message.includes("invalid choice");
			if (!notSupported) throw err;

			// Fallback: full-document write (read → patch inline → write)
			this.logger.warn(
				"patchWorkingMemory: CLI too old, falling back to full replace",
			);
			const current = await this.readWorkingMemory();
			if (!current.available) throw new Error("Working Memory not available");

			const updated = patchWmSection(current.content, heading, {
				content,
				append,
			});
			if (updated === null) throw new Error(`Section not found: ${heading}`);

			return this.apiJson(
				"PUT",
				"/agent/working-memory",
				{ content: updated },
			);
		}
	}

	// ── Distillation ─────────────────────────────────────────────────────────

	/**
	 * Lightweight triage: determine if a conversation has save-worthy content.
	 * Uses a cheap LLM call (~50 output tokens) on the backend.
	 *
	 * @param {string} content  Conversation text to triage
	 * @returns {{ should_distill: boolean, reason: string }}
	 */
	async triageConversation(content) {
		return this.apiJson("POST", "/memories/distill/triage", {
			thread_content: String(content || ""),
		});
	}

	/**
	 * Distill memories from a conversation thread.
	 * Calls the full distillation endpoint which uses LLM to extract
	 * structured memories (with unit_type, temporal data, labels).
	 *
	 * @param {{ threadId: string, title?: string, content: string }} params
	 */
	async distillThread({ threadId, title, content }) {
		return this.apiJson(
			"POST",
			"/memories/distill",
			{
				thread_id: String(threadId || ""),
				thread_title: title || "",
				thread_content: String(content || ""),
				distillation_type: "simple_llm",
				extraction_level: "swift",
			},
			60_000, // 60s timeout for LLM distillation
		);
	}

	// ── Thread search ────────────────────────────────────────────────────────

	/**
	 * Search conversation threads by keyword. Uses BM25 full-text search
	 * across all stored messages.
	 *
	 * @param {string} query  Search keywords
	 * @param {number} [limit=3]  Max threads to return
	 * @returns {Promise<{ threads: Array, totalFound: number }>}
	 */
	async searchThreads(query, limit = 3) {
		const normalizedLimit = Math.min(
			20,
			Math.max(1, Math.trunc(Number(limit) || 3)),
		);
		const qs = new URLSearchParams({
			query: String(query || ""),
			mode: "full",
			limit: String(normalizedLimit),
		});
		try {
			const data = await this.apiJson(
				"GET",
				`/threads/search?${qs.toString()}`,
			);
			return {
				threads: data.threads ?? [],
				totalFound: Number(data.total_found ?? 0),
			};
		} catch (err) {
			// Thread search is best-effort — don't fail the whole operation
			this.logger.warn?.(
				`searchThreads failed: ${err instanceof Error ? err.message : String(err)}`,
			);
			return { threads: [], totalFound: 0 };
		}
	}

	/**
	 * Full-featured thread search — used by nowledge_mem_thread_search tool.
	 * Unlike searchThreads() (best-effort, swallows errors), this throws on failure
	 * and supports additional parameters.
	 *
	 * Uses CLI: `nmem --json t search "<query>" -n N`
	 * Falls back to API: GET /threads/search
	 *
	 * @param {string} query  Search keywords
	 * @param {{ limit?: number; source?: string }} [options]
	 * @returns {Promise<{ threads: Array, totalFound: number }>}
	 */
	async searchThreadsFull(query, { limit = 10, source } = {}) {
		const normalizedLimit = Math.min(
			50,
			Math.max(1, Math.trunc(Number(limit) || 10)),
		);
		const args = [
			"--json",
			"t",
			"search",
			String(query || ""),
			"-n",
			String(normalizedLimit),
		];
		if (source) args.push("--source", String(source));

		try {
			const data = await this.execJson(args);
			return {
				threads: data.threads ?? [],
				totalFound: Number(data.total_found ?? data.total ?? 0),
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const needsFallback =
				message.includes("unrecognized arguments") ||
				message.includes("invalid choice") ||
				message.includes("argument command: invalid choice");
			if (!needsFallback) throw err;

			this.logger.warn("searchThreadsFull: CLI too old, falling back to API");
			const qs = new URLSearchParams({
				query: String(query || ""),
				mode: "full",
				limit: String(normalizedLimit),
			});
			if (source) qs.set("source", String(source));
			const data = await this.apiJson(
				"GET",
				`/threads/search?${qs.toString()}`,
			);
			return {
				threads: data.threads ?? [],
				totalFound: Number(data.total_found ?? 0),
			};
		}
	}

	/**
	 * Fetch full messages from a specific thread.
	 * Supports pagination for progressive retrieval of long conversations.
	 *
	 * Uses CLI: `nmem --json t show <id> -n N --offset O`
	 * Falls back to API: GET /threads/{id}
	 *
	 * @param {string} threadId  Thread ID
	 * @param {{ offset?: number; limit?: number }} [options]
	 */
	async fetchThread(threadId, { offset = 0, limit = 50 } = {}) {
		const id = String(threadId || "").trim();
		if (!id) throw new Error("fetchThread requires threadId");

		const normalizedLimit = Math.min(
			200,
			Math.max(1, Math.trunc(Number(limit) || 50)),
		);
		const normalizedOffset = Math.max(0, Math.trunc(Number(offset) || 0));

		const args = ["--json", "t", "show", id, "-n", String(normalizedLimit)];
		if (normalizedOffset > 0) {
			args.push("--offset", String(normalizedOffset));
		}

		try {
			const data = await this.execJson(args);
			return {
				threadId: data.thread_id ?? data.id ?? id,
				title: data.title ?? "(untitled)",
				source: data.source ?? "unknown",
				messageCount: Number(data.message_count ?? data.total_messages ?? 0),
				messages: (data.messages ?? []).map((msg) => ({
					role: String(msg.role ?? "unknown"),
					content: String(msg.content ?? ""),
					timestamp: msg.timestamp ?? msg.created_at ?? null,
				})),
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const needsFallback =
				message.includes("unrecognized arguments") ||
				message.includes("invalid choice") ||
				message.includes("argument command: invalid choice");
			if (!needsFallback) throw err;

			this.logger.warn("fetchThread: CLI too old, falling back to API");
			const qs = new URLSearchParams({
				limit: String(normalizedLimit),
			});
			if (normalizedOffset > 0) {
				qs.set("offset", String(normalizedOffset));
			}
			const data = await this.apiJson(
				"GET",
				`/threads/${encodeURIComponent(id)}?${qs.toString()}`,
			);
			return {
				threadId: data.thread_id ?? data.id ?? id,
				title: data.title ?? "(untitled)",
				source: data.source ?? "unknown",
				messageCount: Number(data.message_count ?? data.total_messages ?? 0),
				messages: (data.messages ?? []).map((msg) => ({
					role: String(msg.role ?? "unknown"),
					content: String(msg.content ?? ""),
					timestamp: msg.timestamp ?? msg.created_at ?? null,
				})),
			};
		}
	}

	async checkHealth() {
		try {
			await this.execJson(["--json", "status"]);
			return true;
		} catch {
			return false;
		}
	}
}
