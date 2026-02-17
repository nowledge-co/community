import { spawnSync } from "node:child_process";

/**
 * Nowledge Mem client. Wraps the nmem CLI for local-first and remote operations.
 *
 * All operations go through the CLI first. This means:
 * - Local mode: CLI uses http://127.0.0.1:14242 automatically
 * - Remote mode: configure via apiUrl + apiKey (plugin config or env vars)
 *   (see: https://docs.nowledge.co/docs/remote-access)
 *
 * Falls back to direct API calls when a CLI command is too new for the installed
 * version. The fallback path uses the same apiUrl / apiKey.
 *
 * Credential rules:
 * - apiUrl: passed to CLI via --api-url flag (not a secret)
 * - apiKey: injected into the child process env as NMEM_API_KEY ONLY
 *   (never passed as a CLI arg to avoid exposure in `ps aux`)
 *   (never logged, even at debug level)
 */
export class NowledgeMemClient {
	/**
	 * @param {object} logger
	 * @param {{ apiUrl?: string; apiKey?: string }} [credentials]
	 */
	constructor(logger, credentials = {}) {
		this.logger = logger;
		this.nmemCmd = null;
		// Resolved once from config + env (config wins over env, both win over default)
		this._apiUrl = (credentials.apiUrl || "").trim() || "http://127.0.0.1:14242";
		this._apiKey = (credentials.apiKey || "").trim();
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

	async apiJson(method, path, body, timeout = 30_000) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);
		const url = `${this.getApiBaseUrl()}${path}`;
		try {
			const response = await fetch(url, {
				method,
				headers: this.getApiHeaders(),
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: controller.signal,
			});

			const text = await response.text();
			let data = {};
			try {
				data = text ? JSON.parse(text) : {};
			} catch {
				data = { raw: text };
			}

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

	resolveCommand() {
		if (this.nmemCmd) return this.nmemCmd;

		const candidates = [["nmem"], ["uvx", "--from", "nmem-cli", "nmem"]];

		for (const cmd of candidates) {
			const [bin, ...baseArgs] = cmd;
			const result = spawnSync(bin, [...baseArgs, "--version"], {
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 10_000,
				encoding: "utf-8",
			});
			if (result.status === 0) {
				this.nmemCmd = cmd;
				this.logger.info(`nmem resolved: ${cmd.join(" ")}`);
				return cmd;
			}
		}

		throw new Error(
			"nmem CLI not found. Install with: pip install nmem-cli (or use uvx)",
		);
	}

	/**
	 * Build the env for child process spawns.
	 * apiKey is injected here — NEVER via CLI args.
	 */
	_spawnEnv() {
		const env = { ...process.env };
		// Explicit config wins over any existing env var
		if (this._apiUrl !== "http://127.0.0.1:14242") {
			env.NMEM_API_URL = this._apiUrl;
		}
		if (this._apiKey) {
			env.NMEM_API_KEY = this._apiKey;
		}
		return env;
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

	exec(args, timeout = 30_000) {
		const cmd = this.resolveCommand();
		const [bin, ...baseArgs] = cmd;
		try {
			const result = spawnSync(bin, [...baseArgs, ...this._apiUrlArgs(), ...args], {
				stdio: ["ignore", "pipe", "pipe"],
				timeout,
				encoding: "utf-8",
				env: this._spawnEnv(),
			});
			if (result.error) {
				throw result.error;
			}
			if (result.status !== 0) {
				const message = (result.stderr || result.stdout || "").trim();
				throw new Error(
					message || `nmem exited with code ${String(result.status)}`,
				);
			}
			return String(result.stdout ?? "").trim();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.logger.error(
				`nmem command failed: ${cmd.join(" ")} ${args.join(" ")} — ${message}`,
			);
			throw err;
		}
	}

	execJson(args, timeout = 30_000) {
		const raw = this.exec(args, timeout);
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
		const data = this.execJson([
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
		if (recordedDateFrom) args.push("--recorded-from", String(recordedDateFrom));
		if (recordedDateTo) args.push("--recorded-to", String(recordedDateTo));

		let data;
		try {
			data = this.execJson(args);
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
			if (recordedDateFrom) qs.set("recorded_date_from", String(recordedDateFrom));
			if (recordedDateTo) qs.set("recorded_date_to", String(recordedDateTo));
			const apiData = await this.apiJson("GET", `/memories/search?${qs.toString()}`);
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
			return { memories: apiMems.map((m) => this._normalizeMemory(m)), searchMetadata: apiData.search_metadata ?? {} };
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
			return this.execJson(args);
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

	// ── Feed ──────────────────────────────────────────────────────────────────

	/**
	 * Fetch recent activity from the feed.
	 * Uses `nmem f` (CLI v0.4+), falls back to API.
	 */
	async feedEvents({
		lastNDays = 7,
		eventType,
		tier1Only = true,
		limit = 100,
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

		try {
			const data = this.execJson(args);
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
			const data = await this.apiJson("GET", `/agent/feed/events?${qs.toString()}`);
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
		const data = this.execJson(args);
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

		let data;
		try {
			const args = [
				"--json",
				"t",
				"create",
				"-t",
				normalizedTitle,
				"-m",
				JSON.stringify(messages),
				"-s",
				String(source),
			];
			if (threadId) {
				args.push("--id", String(threadId));
			}
			data = this.execJson(args);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const needsApiFallback =
				Boolean(threadId) &&
				(message.includes("unrecognized arguments: --id") ||
					message.includes("invalid choice"));
			if (!needsApiFallback) {
				throw err;
			}
			this.logger.warn(
				"createThread: CLI missing --id support, falling back to API",
			);
			data = await this.apiJson("POST", "/threads", {
				thread_id: String(threadId),
				title: normalizedTitle,
				source: String(source),
				messages,
			});
		}

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

		try {
			const args = [
				"--json",
				"t",
				"append",
				normalizedThreadId,
				"-m",
				JSON.stringify(messages),
				...(deduplicate ? [] : ["--no-deduplicate"]),
			];
			if (idempotencyKey) {
				args.push("--idempotency-key", String(idempotencyKey));
			}
			const data = this.execJson(args);
			return {
				messagesAdded: Number(data.messages_added ?? 0),
				totalMessages: Number(data.total_messages ?? 0),
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const needsApiFallback =
				message.includes("invalid choice") ||
				message.includes("unrecognized arguments");
			if (!needsApiFallback) {
				throw err;
			}
			this.logger.warn(
				"appendThread: CLI missing append support, falling back to API",
			);
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
	}

	async getMemory(memoryId) {
		const id = String(memoryId || "").trim();
		if (!id) {
			throw new Error("getMemory requires memoryId");
		}
		return this.execJson(["--json", "m", "show", id]);
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
			const data = this.execJson(["--json", "wm", "read"], 15_000);
			const content = String(data.content ?? "").trim();
			const exists = Boolean(data.exists);
			return { content, available: exists && content.length > 0 };
		} catch {
			return { content: "", available: false };
		}
	}

	async checkHealth() {
		try {
			this.exec(["status"]);
			return true;
		} catch {
			return false;
		}
	}
}
