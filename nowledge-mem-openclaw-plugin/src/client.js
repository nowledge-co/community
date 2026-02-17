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

	async createThread({ title, messages, source = "openclaw" }) {
		const normalizedTitle = String(title || "").trim();
		if (!normalizedTitle) {
			throw new Error("createThread requires a non-empty title");
		}
		if (!Array.isArray(messages) || messages.length === 0) {
			throw new Error("createThread requires at least one message");
		}

		const data = this.execJson([
			"--json",
			"t",
			"create",
			"-t",
			normalizedTitle,
			"-m",
			JSON.stringify(messages),
			"-s",
			String(source),
		]);

		return String(
			data.id ?? data.thread?.thread_id ?? data.thread_id ?? "created",
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
