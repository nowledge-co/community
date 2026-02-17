import { spawnSync } from "node:child_process";

/**
 * Nowledge Mem client. Wraps the nmem CLI for local-first operations.
 * Falls back to uvx if plain nmem is not on PATH.
 */
export class NowledgeMemClient {
	constructor(logger) {
		this.logger = logger;
		this.nmemCmd = null;
	}

	getApiBaseUrl() {
		const raw = process.env.NMEM_API_URL?.trim();
		return raw && raw.length > 0 ? raw : "http://127.0.0.1:14242";
	}

	getApiHeaders() {
		const headers = { "content-type": "application/json" };
		const apiKey = process.env.NMEM_API_KEY?.trim();
		if (apiKey) {
			headers.authorization = `Bearer ${apiKey}`;
			headers["x-nmem-api-key"] = apiKey;
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

	exec(args, timeout = 30_000) {
		const cmd = this.resolveCommand();
		const [bin, ...baseArgs] = cmd;
		try {
			const result = spawnSync(bin, [...baseArgs, ...args], {
				stdio: ["ignore", "pipe", "pipe"],
				timeout,
				encoding: "utf-8",
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

	async search(query, limit = 5) {
		const normalizedLimit = Math.min(
			20,
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
		return memories.map((m) => ({
			id: String(m.id ?? ""),
			title: String(m.title ?? ""),
			content: String(m.content ?? ""),
			score: Number(m.score ?? 0),
			labels: Array.isArray(m.labels) ? m.labels : [],
			importance: Number(m.importance ?? m.rating ?? 0.5),
		}));
	}

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
