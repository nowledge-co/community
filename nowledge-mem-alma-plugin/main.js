import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";

let quitCaptureAttempted = false;

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

function stringifyMessage(message) {
	if (!message || typeof message !== "object") return "";
	const role = typeof message.role === "string" ? message.role : "unknown";
	const text = extractText(message.content);
	if (!text) return "";
	return `[${role}] ${escapeForInline(text, 400)}`;
}

class NowledgeMemClient {
	constructor(logger) {
		this.logger = logger;
		this.command = null;
	}

	resolveCommand() {
		if (this.command) return this.command;

		const candidates = [
			{ cmd: "nmem", prefix: [] },
			{ cmd: "uvx", prefix: ["--from", "nmem-cli", "nmem"] },
		];

		for (const candidate of candidates) {
			const result = spawnSync(
				candidate.cmd,
				[...candidate.prefix, "--version"],
				{
					encoding: "utf-8",
					timeout: 10_000,
				},
			);
			if (result.status === 0) {
				this.command = candidate;
				this.logger.info?.(
					`nmem resolved via: ${candidate.cmd} ${candidate.prefix.join(" ")}`.trim(),
				);
				return candidate;
			}
		}

		throw new Error(
			"nmem CLI not found. Install with `pip install nmem` or use `uvx --from nmem-cli nmem`.",
		);
	}

	run(args, expectJson = false) {
		const { cmd, prefix } = this.resolveCommand();
		const finalArgs = [...prefix, ...args];
		const result = spawnSync(cmd, finalArgs, {
			encoding: "utf-8",
			timeout: 30_000,
		});

		if (result.status !== 0) {
			const stderr = result.stderr?.trim() || "unknown error";
			throw new Error(
				`nmem command failed: ${cmd} ${finalArgs.join(" ")}\n${stderr}`,
			);
		}

		const stdout = result.stdout?.trim() ?? "";
		if (!expectJson) return stdout;

		try {
			return JSON.parse(stdout);
		} catch {
			throw new Error("nmem returned invalid JSON output");
		}
	}

	async search(query, limit = 5) {
		const safeLimit = clamp(Number(limit) || 5, 1, 20);
		const data = this.run(["--json", "m", "search", query, "-n", String(safeLimit)], true);
		const memories = data.memories ?? data.results ?? [];
		return memories.map((memory) => ({
			id: String(memory.id ?? ""),
			title: String(memory.title ?? ""),
			content: String(memory.content ?? ""),
			score: Number(memory.score ?? 0),
			labels: Array.isArray(memory.labels) ? memory.labels : [],
			importance: Number(memory.importance ?? memory.rating ?? 0.5),
		}));
	}

	async searchMemory(query, options = {}) {
		const args = ["--json", "m", "search", query];
		if (options.limit !== undefined) {
			args.push("-n", String(clamp(Number(options.limit) || 5, 1, 20)));
		}
		if (typeof options.label === "string" && options.label.trim()) {
			args.push("-l", options.label.trim());
		}
		if (typeof options.time === "string" && options.time.trim()) {
			args.push("-t", options.time.trim());
		}
		if (typeof options.importance === "number" && Number.isFinite(options.importance)) {
			args.push("--importance", String(clamp(options.importance, 0.1, 1.0)));
		}
		if (options.mode === "deep") args.push("--mode", "deep");
		return this.run(args, true);
	}

	async showMemory(id, contentLimit = 1200) {
		return this.run(
			["--json", "m", "show", String(id), "--content-limit", String(Math.max(100, Math.floor(contentLimit)))],
			true,
		);
	}

	async addMemory(content, title, importance, labels = [], source) {
		const args = ["--json", "m", "add", content];
		if (title) args.push("-t", title);
		if (typeof importance === "number" && Number.isFinite(importance)) {
			args.push("-i", String(clamp(importance, 0.1, 1.0)));
		}
		for (const label of labels) args.push("-l", label);
		if (source) args.push("-s", source);
		const data = this.run(args, true);
		return data;
	}

	async updateMemory(id, content, title, importance) {
		const args = ["--json", "m", "update", String(id)];
		if (typeof content === "string" && content.trim()) args.push("-c", content.trim());
		if (typeof title === "string" && title.trim()) args.push("-t", title.trim());
		if (typeof importance === "number" && Number.isFinite(importance)) {
			args.push("-i", String(clamp(importance, 0.1, 1.0)));
		}
		return this.run(args, true);
	}

	async deleteMemory(id, force = false) {
		const args = ["--json", "m", "delete", String(id)];
		if (force) args.push("-f");
		return this.run(args, true);
	}

	async readWorkingMemory() {
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

	async saveThread(summary) {
		const args = ["t", "save", "--from", "alma", "--truncate"];
		if (summary) args.push("-s", summary);
		return this.run(args, false);
	}

	async searchThreads(query, limit = 5) {
		return this.run(
			["--json", "t", "search", query, "-n", String(clamp(Number(limit) || 5, 1, 20))],
			true,
		);
	}

	async showThread(id, messages = 30, contentLimit = 1200) {
		return this.run(
			[
				"--json",
				"t",
				"show",
				String(id),
				"-m",
				String(Math.max(1, Math.floor(messages))),
				"--content-limit",
				String(Math.max(100, Math.floor(contentLimit))),
			],
			true,
		);
	}

	async createThread(title, content, messages, source = "alma") {
		const args = ["--json", "t", "create", "-t", title];
		if (typeof content === "string" && content.trim()) args.push("-c", content.trim());
		if (Array.isArray(messages) && messages.length > 0) {
			args.push("-m", JSON.stringify(messages));
		}
		if (source) args.push("-s", source);
		return this.run(args, true);
	}

	async deleteThread(id, force = false, cascade = false) {
		const args = ["--json", "t", "delete", String(id)];
		if (force) args.push("-f");
		if (cascade) args.push("--cascade");
		return this.run(args, true);
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
	let code = "cli_error";
	if (normalized.includes("not found")) code = "not_found";
	if (normalized.includes("permission")) code = "permission_denied";
	if (normalized.includes("invalid json")) code = "invalid_json";
	if (normalized.includes("nmem cli not found")) code = "nmem_not_found";
	if (
		normalized.includes("model") ||
		normalized.includes("embedding") ||
		normalized.includes("download")
	) {
		code = "model_unavailable";
	}
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
		"- Add memory: `nmem --json m add \"<content>\" -t \"<title>\" -l tag1 -l tag2`",
		"- Update memory: `nmem --json m update <memory_id> -c \"<new_content>\"`",
		"- Search threads: `nmem --json t search \"<query>\" -n 5`",
		"- Show thread: `nmem --json t show <thread_id> -m 30 --content-limit 1200`",
	];
}

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

	if (sections.length === 0) return "";

	const generatedAt = new Date().toISOString();
	const memoryCount = Array.isArray(results) ? results.length : 0;

	return [
		"<nowledge-mem-central-context>",
		`meta: mode=injected_context generated_at=${generatedAt} memory_count=${memoryCount}`,
		"This block is preloaded by plugin hook and is NOT equivalent to live tool execution output.",
		"If you answer using this block only, explicitly disclose that no tool call executed in this turn.",
		"Use Nowledge Mem as the primary memory system for recall/store/update operations.",
		"For any request about past context/decisions/history/memory, prefer a Nowledge Mem tool call before finalizing the answer.",
		"Preferred order: nowledge-mem.nowledge_mem_query -> nowledge-mem.nowledge_mem_search -> nowledge-mem.nowledge_mem_thread_search.",
		"If tool call format needs short ids, use nowledge_mem_query / nowledge_mem_search / nowledge_mem_thread_search.",
		"Do not claim memory tools are unavailable unless tool execution actually fails in this turn.",
		"Do not present injected context as fresh retrieval. If no tool was executed, label it as recalled context/hint.",
		"Prefer nowledge_mem_search/nowledge_mem_store/nowledge_mem_update/nowledge_mem_delete/nowledge_mem_working_memory over local ephemeral memory paths.",
		"",
		...sections,
		...(includeCliPlaybook ? ["", ...buildCliPlaybookBlock()] : []),
		"",
		"</nowledge-mem-central-context>",
	].join("\n");
}

function normalizeThreadMessages(messages) {
	return messages
		.map((message) => {
			const role =
				typeof message?.role === "string" &&
				["user", "assistant", "system"].includes(message.role)
					? message.role
					: "user";
			const content = extractText(message?.content);
			if (!content) return null;
			return { role, content };
		})
		.filter(Boolean);
}

async function saveActiveThread(context, client) {
	const chat = context.chat;
	if (!chat?.getActiveThread || !chat?.getMessages) {
		return "Skipped auto-capture: chat API unavailable.";
	}

	const activeThread = await chat.getActiveThread();
	if (!activeThread?.id) {
		return "Skipped auto-capture: no active thread.";
	}

	const messages = await chat.getMessages(activeThread.id);
	if (!Array.isArray(messages) || messages.length === 0) {
		return "Skipped auto-capture: no messages.";
	}

	const normalizedMessages = normalizeThreadMessages(messages);
	if (!normalizedMessages.length) {
		return "Skipped auto-capture: messages had no textual content.";
	}

	const title = escapeForInline(
		typeof activeThread.title === "string" && activeThread.title.trim()
			? activeThread.title
			: `Alma Thread ${new Date().toISOString().slice(0, 10)}`,
		120,
	);
	const summary = normalizedMessages
		.slice(-8)
		.map((msg) => `[${msg.role}] ${escapeForInline(msg.content, 280)}`)
		.join("\n");

	const created = await client.createThread(
		title,
		escapeForInline(summary, 1200),
		normalizedMessages,
		"alma",
	);
	const threadId = created?.id || created?.thread_id || "unknown";
	return `Saved active thread (${normalizedMessages.length} messages, id=${threadId}).`;
}

export async function activate(context) {
	const logger = context.logger ?? console;
	const client = new NowledgeMemClient(logger);
	const recalledThreads = new Set();

	const recallPolicy = resolveRecallPolicy(context.settings, logger);
	const autoCapture = Boolean(
		getSetting(context.settings, "nowledgeMem.autoCapture", false),
	);
	const maxRecallResults = clamp(
		Number(getSetting(context.settings, "nowledgeMem.maxRecallResults", 5)) ||
			5,
		1,
		20,
	);

	const registerTool = (name, tool) => {
		if (!context.tools?.register) return;
		try {
			context.tools.register(name, tool);
			return;
		} catch {
			// try single-object forms
		}
		try {
			context.tools.register({ id: name, ...tool });
			return;
		} catch {
			// fallback to name field
		}
		try {
			context.tools.register({ name, ...tool });
		} catch (err) {
			logger.error?.(
				`Failed to register tool "${name}": ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	};

	const registerEvent = (eventName, handler) => {
		if (context.hooks?.on) {
			context.hooks.on(eventName, handler);
			return true;
		}
		if (context.events?.on) {
			context.events.on(eventName, handler);
			return true;
		}
		return false;
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
			"Search memories with optional filters and return ranked results.",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", minLength: 1 },
				limit: { type: "number", minimum: 1, maximum: 20, default: 5 },
				label: { type: "string" },
				time: { type: "string", enum: ["today", "week", "month", "year"] },
				importance: { type: "number", minimum: 0.1, maximum: 1.0 },
				mode: { type: "string", enum: ["normal", "deep"] },
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
				mode: { type: "string", enum: ["normal", "deep"] },
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
					mode: input.mode === "deep" ? "deep" : "normal",
				});
				return normalizeSearchResponse(data, query, "memory");
			} catch (err) {
				return cliErrorResult(err, "memory_search");
			}
		},
	});

	registerTool("nowledge_mem_query", {
		description:
			"One-shot memory query. Searches memories first, then threads fallback, and returns combined results.",
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
				const memoryResult = await client.searchMemory(query, { limit, mode: "normal" });
				const memoryItems = normalizeItems(memoryResult, ["memories", "results"]);
				if (memoryItems.length > 0) {
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

	registerTool("nowledge_mem_store", {
		description:
			"Save an insight, decision, or important finding to your personal knowledge base.",
		inputSchema: {
			type: "object",
			properties: {
				text: { type: "string", minLength: 1 },
				title: { type: "string", maxLength: 120 },
				importance: { type: "number", minimum: 0.1, maximum: 1.0 },
				labels: { type: "array", items: { type: "string" } },
				source: { type: "string", maxLength: 120 },
			},
			required: ["text"],
		},
		parameters: {
			type: "object",
			properties: {
				text: { type: "string", minLength: 1 },
				title: { type: "string", maxLength: 120 },
				importance: { type: "number", minimum: 0.1, maximum: 1.0 },
				labels: { type: "array", items: { type: "string" } },
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
			const importance =
				typeof input.importance === "number" &&
				Number.isFinite(input.importance)
					? clamp(input.importance, 0.1, 1.0)
					: undefined;
			const labels = Array.isArray(input.labels)
				? input.labels.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
				: [];
			const source = typeof input.source === "string" && input.source.trim()
				? input.source.trim().slice(0, 120)
				: "alma";
			try {
				const result = await client.addMemory(text, title, importance, labels, source);
				return {
					ok: true,
					item: {
						id: String(result?.id ?? ""),
						title: title ?? String(result?.title ?? ""),
						content: text,
						labels,
						importance: importance ?? Number(result?.importance ?? 0.5),
						source,
					},
					raw: result,
				};
			} catch (err) {
				return cliErrorResult(err, "memory_store");
			}
		},
	});

	registerTool("nowledge_mem_show", {
		description: "Show full details for one memory by id.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				contentLimit: { type: "number", minimum: 100, maximum: 10000, default: 1200 },
			},
			required: ["id"],
		},
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				contentLimit: { type: "number", minimum: 100, maximum: 10000, default: 1200 },
			},
			required: ["id"],
		},
		async execute(input) {
			const id = String(input?.id ?? "").trim();
			if (!id) return validationErrorResult("memory_show", "id is required");
			const contentLimit = clamp(Number(input?.contentLimit ?? 1200) || 1200, 100, 10000);
			try {
				const result = await client.showMemory(id, contentLimit);
				const content = String(result?.content ?? "");
				return {
					ok: true,
					item: result,
					truncated: content.length >= contentLimit,
				};
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
				force: { type: "boolean", default: false },
			},
			required: ["id"],
		},
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				force: { type: "boolean", default: false },
			},
			required: ["id"],
		},
		async execute(input) {
			const id = String(input?.id ?? "").trim();
			if (!id) return validationErrorResult("memory_delete", "id is required");
			const force = input?.force === true;
			try {
				const result = await client.deleteMemory(id, force);
				return { ok: true, id, force, notFound: false, item: result };
			} catch (err) {
				const info = cliErrorResult(err, "memory_delete");
				if (info.error.code === "not_found") return { ok: true, id, force, notFound: true };
				return info;
			}
		},
	});

	registerTool("nowledge_mem_working_memory", {
		description:
			"Read your daily Working Memory briefing from ~/ai-now/memory.md.",
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

	registerTool("nowledge_mem_thread_search", {
		description: "Search saved conversation threads by natural language query.",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", minLength: 1 },
				limit: { type: "number", minimum: 1, maximum: 20, default: 5 },
			},
			required: ["query"],
		},
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", minLength: 1 },
				limit: { type: "number", minimum: 1, maximum: 20, default: 5 },
			},
			required: ["query"],
		},
		async execute(input) {
			const query = String(input?.query ?? "").trim();
			if (!query) return validationErrorResult("thread_search", "query is required");
			try {
				const data = await client.searchThreads(query, input?.limit ?? 5);
				return normalizeSearchResponse(data, query, "thread");
			} catch (err) {
				return cliErrorResult(err, "thread_search");
			}
		},
	});

	registerTool("nowledge_mem_thread_show", {
		description: "Show one thread with messages.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				messages: { type: "number", minimum: 1, maximum: 200, default: 30 },
				contentLimit: { type: "number", minimum: 100, maximum: 20000, default: 1200 },
			},
			required: ["id"],
		},
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				messages: { type: "number", minimum: 1, maximum: 200, default: 30 },
				contentLimit: { type: "number", minimum: 100, maximum: 20000, default: 1200 },
			},
			required: ["id"],
		},
		async execute(input) {
			const id = String(input?.id ?? "").trim();
			if (!id) return validationErrorResult("thread_show", "id is required");
			try {
				const messages = clamp(Number(input?.messages ?? 30) || 30, 1, 200);
				const contentLimit = clamp(Number(input?.contentLimit ?? 1200) || 1200, 100, 20000);
				const result = await client.showThread(id, messages, contentLimit);
				const threadMessages = Array.isArray(result?.messages) ? result.messages : [];
				const truncatedContent = threadMessages.some((m) => {
					const txt = extractText(m?.content ?? m?.text ?? "");
					return txt.length >= contentLimit;
				});
				return {
					ok: true,
					item: result,
					truncatedMessages: threadMessages.length >= messages,
					truncatedContent,
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
				force: { type: "boolean", default: false },
				cascade: { type: "boolean", default: false },
			},
			required: ["id"],
		},
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", minLength: 1 },
				force: { type: "boolean", default: false },
				cascade: { type: "boolean", default: false },
			},
			required: ["id"],
		},
		async execute(input) {
			const id = String(input?.id ?? "").trim();
			if (!id) return validationErrorResult("thread_delete", "id is required");
			const force = input?.force === true;
			const cascade = input?.cascade === true;
			try {
				const result = await client.deleteThread(id, force, cascade);
				return { ok: true, id, force, cascade, notFound: false, item: result };
			} catch (err) {
				const info = cliErrorResult(err, "thread_delete");
				if (info.error.code === "not_found") return { ok: true, id, force, cascade, notFound: true };
				return info;
			}
		},
	});

	if (recallInjectionEnabled) {
		registerEvent("chat.message.willSend", async (first, second) => {
			const payload = normalizeWillSendPayload(first, second);
			const { threadId, currentContent } = payload;
			if (!currentContent || !currentContent.trim()) return;

			const allowAutoRecall =
				currentContent.length >= 8 &&
				!(recallFrequency === "thread_once" && recalledThreads.has(threadId));

			if (allowAutoRecall) {
				const wm = await client.readWorkingMemory();
				const results = await client.search(currentContent, maxRecallResults);
				const contextBlock = buildMemoryContextBlock(wm, results, {
					includeCliPlaybook: injectCliPlaybook,
				});
				if (!contextBlock) return;
				if (payload.setContent(`${contextBlock}\n\n${currentContent}`)) {
					if (allowAutoRecall && recallFrequency === "thread_once") {
						recalledThreads.add(threadId);
					}
				}
			}
		});
	}

	if (autoCapture) {
		const handleAutoCapture = async (_input, output) => {
			quitCaptureAttempted = true;
			try {
				const message = await saveActiveThread(context, client);
				logger.info?.(`nowledge-mem: auto-capture on quit (${message})`);
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
	}

	logger.info?.(
		`nowledge-mem activated for Alma (recallPolicy=${recallPolicy}, recallInjectionEnabled=${recallInjectionEnabled}, recallFrequency=${recallFrequency}, injectCliPlaybook=${injectCliPlaybook}, autoCapture=${autoCapture}, maxRecallResults=${maxRecallResults})`,
	);
}

export async function deactivate(context) {
	const logger = context?.logger ?? console;
	const autoCapture = Boolean(
		getSetting(context?.settings, "nowledgeMem.autoCapture", false),
	);
	if (!autoCapture || quitCaptureAttempted) {
		logger.info?.("nowledge-mem deactivated");
		return;
	}
	try {
		quitCaptureAttempted = true;
		const client = new NowledgeMemClient(logger);
		const message = await saveActiveThread(context, client);
		logger.info?.(`nowledge-mem: auto-capture on deactivate (${message})`);
	} catch (err) {
		logger.error?.(
			`nowledge-mem auto-capture on deactivate failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
	logger.info?.("nowledge-mem deactivated");
}
