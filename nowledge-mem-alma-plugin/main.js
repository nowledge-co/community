import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

function notify(ui, logger, level, message) {
	if (level === "error" && ui?.showError) {
		try {
			ui.showError(message);
			return;
		} catch {
			// fall through
		}
	}

	if (level === "warning" && ui?.showWarning) {
		try {
			ui.showWarning(message);
			return;
		} catch {
			// fall through
		}
	}

	if (ui?.showNotification) {
		try {
			ui.showNotification(`Nowledge Mem: ${message}`);
			return;
		} catch {
			// fall through
		}
	}

	const sink =
		level === "error"
			? logger.error
			: level === "warning"
				? logger.warn
				: logger.info;
	sink?.(message);
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
		const data = this.run(
			["--json", "m", "search", query, "-n", String(safeLimit)],
			true,
		);
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

	async addMemory(content, title, importance) {
		const args = ["--json", "m", "add", content];
		if (title) args.push("-t", title);
		if (typeof importance === "number" && Number.isFinite(importance)) {
			args.push("-i", String(clamp(importance, 0.1, 1.0)));
		}
		const data = this.run(args, true);
		return String(data.id ?? "created");
	}

	async readWorkingMemory() {
		try {
			const text = readFileSync(
				`${homedir()}/ai-now/memory.md`,
				"utf-8",
			).trim();
			return { available: text.length > 0, content: text };
		} catch {
			return { available: false, content: "" };
		}
	}

	async saveThread(summary) {
		const args = ["t", "save", "--from", "alma", "--truncate"];
		if (summary) args.push("-s", summary);
		return this.run(args, false);
	}

	async status() {
		this.run(["status"], false);
		return true;
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

function toolValidationError(message) {
	return new Error(`Invalid tool input: ${message}`);
}

function buildMemoryContextBlock(workingMemory, results) {
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

	return [
		"<nowledge-mem-central-context>",
		"Use Nowledge Mem as the primary memory system for recall/store/update operations.",
		"Prefer nowledge_mem_search/nowledge_mem_store/nowledge_mem_working_memory over any local ephemeral memory path.",
		"",
		...sections,
		"",
		"</nowledge-mem-central-context>",
	].join("\n");
}

async function saveActiveThread(context, client) {
	const chat = context.chat;
	if (!chat?.getActiveThread || !chat?.getMessages) {
		await client.saveThread("Manual Alma save");
		return "Saved thread snapshot (fallback mode).";
	}

	const activeThread = await chat.getActiveThread();
	if (!activeThread?.id) {
		await client.saveThread("Manual Alma save");
		return "Saved thread snapshot.";
	}

	const messages = await chat.getMessages(activeThread.id);
	if (!Array.isArray(messages) || messages.length === 0) {
		await client.saveThread("Manual Alma save");
		return "Saved thread snapshot.";
	}

	const summary = messages
		.map(stringifyMessage)
		.filter(Boolean)
		.slice(-8)
		.join("\n");

	await client.saveThread(escapeForInline(summary, 300));
	return `Saved active thread (${messages.length} messages).`;
}

export async function activate(context) {
	const logger = context.logger ?? console;
	const ui = context.ui;
	const client = new NowledgeMemClient(logger);
	const recalledThreads = new Set();

	const autoRecall = Boolean(
		getSetting(context.settings, "nowledgeMem.autoRecall", true),
	);
	const autoCapture = Boolean(
		getSetting(context.settings, "nowledgeMem.autoCapture", false),
	);
	const maxRecallResults = clamp(
		Number(getSetting(context.settings, "nowledgeMem.maxRecallResults", 5)) ||
			5,
		1,
		20,
	);

	const registerCommand = (id, title, execute) => {
		if (!context.commands?.register) return;
		try {
			context.commands.register(id, execute);
			return;
		} catch {
			// try object forms for compatibility
		}
		try {
			context.commands.register({ id, title, execute });
			return;
		} catch {
			// try alternate property name
		}
		try {
			context.commands.register({ id, title, run: execute });
		} catch (err) {
			logger.error?.(
				`Failed to register command "${id}": ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	};

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

	registerTool("nowledge_mem_search", {
		description:
			"Search your personal knowledge base. Returns memories ranked by relevance with confidence scores.",
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
			if (!input || typeof input !== "object") {
				throw toolValidationError("input object is required");
			}
			const query = String(input.query ?? "").trim();
			if (!query) throw toolValidationError("query is required");
			const rawLimit = Number(input.limit ?? 5);
			const limit = clamp(Number.isFinite(rawLimit) ? rawLimit : 5, 1, 20);
			const results = await client.search(query, limit);
			if (results.length === 0) {
				return { query, results: [], message: "No matching memories found." };
			}
			return {
				query,
				resultCount: results.length,
				results: results.map((result) => ({
					id: result.id,
					title: result.title,
					content: result.content,
					score: result.score,
					labels: result.labels,
					importance: result.importance,
				})),
			};
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
			},
			required: ["text"],
		},
		parameters: {
			type: "object",
			properties: {
				text: { type: "string", minLength: 1 },
				title: { type: "string", maxLength: 120 },
				importance: { type: "number", minimum: 0.1, maximum: 1.0 },
			},
			required: ["text"],
		},
		async execute(input) {
			if (!input || typeof input !== "object") {
				throw toolValidationError("input object is required");
			}
			const text = String(input.text ?? "").trim();
			if (!text) throw toolValidationError("text is required");
			const title =
				typeof input.title === "string" && input.title.trim()
					? input.title.trim().slice(0, 120)
					: undefined;
			const importance =
				typeof input.importance === "number" &&
				Number.isFinite(input.importance)
					? clamp(input.importance, 0.1, 1.0)
					: undefined;
			const id = await client.addMemory(
				text,
				title,
				importance,
			);
			return {
				id,
				message: `Memory saved${title ? `: ${title}` : ""}`,
			};
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
					available: false,
					message: "Working Memory is not available yet.",
				};
			}
			return { available: true, content: wm.content };
		},
	});

	registerCommand(
		"status",
		"Nowledge Mem: Check Status",
		async () => {
			try {
				await client.status();
				notify(ui, logger, "info", "Nowledge Mem is reachable.");
			} catch (err) {
				notify(
					ui,
					logger,
					"error",
					`Nowledge Mem is unavailable: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
	);

	registerCommand(
		"read-working-memory",
		"Nowledge Mem: Read Working Memory",
		async () => {
			const wm = await client.readWorkingMemory();
			if (!wm.available) {
				notify(
					ui,
					logger,
					"warning",
					"Working Memory file is empty or missing (~/ai-now/memory.md).",
				);
				return;
			}
			notify(
				ui,
				logger,
				"info",
				`Working Memory loaded (${wm.content.length} chars).`,
			);
		},
	);

	registerCommand(
		"search",
		"Nowledge Mem: Search Memory",
		async () => {
			const query = (
				await ui?.showInputBox?.({ prompt: "Search Nowledge Mem" })
			)?.trim();
			if (!query) return;
			try {
				const results = await client.search(query, 5);
				const msg =
					results.length === 0
						? `No memories found for "${query}".`
						: `Found ${results.length} memories for "${query}".`;
				notify(ui, logger, "info", msg);
			} catch (err) {
				notify(
					ui,
					logger,
					"error",
					`Search failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
	);

	registerCommand(
		"remember",
		"Nowledge Mem: Save Memory",
		async () => {
			const text = (
				await ui?.showInputBox?.({ prompt: "What should be saved to memory?" })
			)?.trim();
			if (!text) return;
			try {
				const id = await client.addMemory(text);
				notify(ui, logger, "info", `Saved memory (${id}).`);
			} catch (err) {
				notify(
					ui,
					logger,
					"error",
					`Save failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
	);

	registerCommand(
		"save-thread",
		"Nowledge Mem: Save Current Thread",
		async () => {
			try {
				const message = await saveActiveThread(context, client);
				notify(ui, logger, "info", message);
			} catch (err) {
				notify(
					ui,
					logger,
					"error",
					`Thread save failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
	);

	if (autoRecall) {
		registerEvent("chat.message.willSend", async (first, second) => {
			const payload = normalizeWillSendPayload(first, second);
			const { threadId, currentContent } = payload;
			if (!currentContent || currentContent.length < 8) return;
			if (recalledThreads.has(threadId)) return;

			const wm = await client.readWorkingMemory();
			const results = await client.search(currentContent, maxRecallResults);
			const contextBlock = buildMemoryContextBlock(wm, results);
			if (!contextBlock) return;

			if (payload.setContent(`${contextBlock}\n\n${currentContent}`)) {
				recalledThreads.add(threadId);
			}
		});
	}

	if (autoCapture) {
		registerEvent("app.willQuit", async (_input, output) => {
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
		});
	}

	logger.info?.(
		`nowledge-mem activated for Alma (autoRecall=${autoRecall}, autoCapture=${autoCapture}, maxRecallResults=${maxRecallResults})`,
	);
}

export async function deactivate(context) {
	context?.logger?.info?.("nowledge-mem deactivated");
}
