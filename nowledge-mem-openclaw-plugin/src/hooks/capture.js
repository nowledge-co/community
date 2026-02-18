import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const MAX_MESSAGE_CHARS = 800;

function truncate(text, max = MAX_MESSAGE_CHARS) {
	const str = String(text || "").trim();
	if (!str) return "";
	return str.length > max ? `${str.slice(0, max)}…` : str;
}

function extractText(content) {
	if (typeof content === "string") {
		return content.trim();
	}
	if (!Array.isArray(content)) {
		return "";
	}

	const parts = [];
	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		if (block.type === "text" && typeof block.text === "string") {
			const text = block.text.trim();
			if (text) parts.push(text);
		}
	}
	return parts.join("\n").trim();
}

function normalizeRoleMessage(raw) {
	if (!raw || typeof raw !== "object") return null;
	const msg =
		raw.message && typeof raw.message === "object" ? raw.message : raw;
	const role = typeof msg.role === "string" ? msg.role : "";
	if (role !== "user" && role !== "assistant") return null;
	const text = extractText(msg.content);
	if (!text) return null;
	if (role === "user" && text.startsWith("/")) return null;

	let timestamp;
	if (typeof msg.timestamp === "string" || typeof msg.timestamp === "number") {
		timestamp = msg.timestamp;
	}

	const externalHint = [
		msg.external_id,
		msg.externalId,
		msg.message_id,
		msg.messageId,
		msg.id,
		raw.external_id,
		raw.externalId,
		raw.message_id,
		raw.messageId,
		raw.id,
	]
		.find((v) => typeof v === "string" && v.trim().length > 0)
		?.trim();

	return {
		role,
		content: truncate(text),
		timestamp,
		externalHint,
	};
}

function fingerprint(text) {
	return String(text || "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.replace(/[^\w\s]/g, "")
		.slice(0, 180);
}

const PROMPT_INJECTION_PATTERNS = [
	/ignore (all|any|previous|above|prior) instructions/i,
	/do not follow (the )?(system|developer)/i,
	/system prompt/i,
	/developer message/i,
	/<\s*(system|assistant|developer|tool|function)\b/i,
	/\b(run|execute|call|invoke)\b.{0,40}\b(tool|command)\b/i,
];

const MEMORY_TRIGGER_PATTERNS = [
	/\bi (like|prefer|hate|love|want|need|use|chose|decided)\b/i,
	/\bwe (decided|agreed|chose|will use|are using|should)\b/i,
	/\b(always|never|important|remember)\b/i,
	/\b(my|our) (\w+ )?is\b/i,
	/[\w.-]+@[\w.-]+\.\w+/,
	/\+\d{10,}/,
];

function looksLikeQuestion(text) {
	const trimmed = text.trim();
	if (trimmed.endsWith("?")) return true;
	if (
		/^(what|how|why|when|where|which|who|can|could|would|should|do|does|did|is|are|was|were)\b/i.test(
			trimmed,
		)
	) {
		return true;
	}
	return false;
}

function looksLikePromptInjection(text) {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return false;
	return PROMPT_INJECTION_PATTERNS.some((p) => p.test(normalized));
}

function hasMemoryTrigger(text) {
	return MEMORY_TRIGGER_PATTERNS.some((p) => p.test(text));
}

function shouldCaptureAsMemory(text) {
	const normalized = String(text || "").trim();
	if (!normalized) return false;
	if (normalized.startsWith("/")) return false;
	if (normalized.length < 24) return false;
	if (normalized.split(/\s+/).length < 5) return false;
	if (looksLikeQuestion(normalized)) return false;
	if (looksLikePromptInjection(normalized)) return false;
	if (normalized.includes("<relevant-memories>")) return false;
	if (normalized.startsWith("<") && normalized.includes("</")) return false;
	return hasMemoryTrigger(normalized);
}

function buildThreadTitle(ctx, reason) {
	const session = ctx?.sessionKey || ctx?.sessionId || "session";
	const reasonSuffix = reason ? ` (${reason})` : "";
	return `OpenClaw ${session}${reasonSuffix}`;
}

function sanitizeIdPart(input, max = 48) {
	const normalized = String(input || "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!normalized) return "session";
	return normalized.slice(0, max);
}

function buildStableThreadId(event, ctx) {
	const base =
		String(ctx?.sessionId || "").trim() ||
		String(ctx?.sessionKey || "").trim() ||
		String(event?.sessionFile || "").trim() ||
		"session";
	const slug = sanitizeIdPart(base);
	const digest = createHash("sha1").update(base).digest("hex").slice(0, 10);
	return `openclaw-${slug}-${digest}`;
}

function buildExternalId({ normalized, index, threadId, sessionKey }) {
	if (normalized.externalHint) {
		return `oc:${sanitizeIdPart(normalized.externalHint, 96)}`;
	}
	const seed = `${threadId}|${sessionKey}|${index}|${normalized.role}|${normalized.content}`;
	const digest = createHash("sha1").update(seed).digest("hex");
	return `oc-msg:${digest}`;
}

function buildAppendIdempotencyKey(threadId, reason, messages) {
	const seed = {
		threadId: String(threadId || ""),
		reason: String(reason || "event"),
		count: Array.isArray(messages) ? messages.length : 0,
		externalIds: Array.isArray(messages)
			? messages
					.map((m) => m?.metadata?.external_id)
					.filter((v) => typeof v === "string" && v.length > 0)
			: [],
	};
	return `oc-batch:${createHash("sha1").update(JSON.stringify(seed)).digest("hex")}`;
}

async function loadMessagesFromSessionFile(sessionFile) {
	try {
		const content = await readFile(sessionFile, "utf-8");
		const messages = [];
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				const entry = JSON.parse(trimmed);
				if (entry?.type === "message" && entry.message) {
					messages.push(entry.message);
				} else if (entry?.role && entry?.content) {
					messages.push(entry);
				}
			} catch {
				// Ignore invalid JSONL lines.
			}
		}
		return messages;
	} catch {
		return [];
	}
}

async function resolveHookMessages(event) {
	if (Array.isArray(event?.messages) && event.messages.length > 0) {
		return event.messages;
	}
	const sessionFile =
		typeof event?.sessionFile === "string" ? event.sessionFile.trim() : "";
	if (!sessionFile) return [];
	return loadMessagesFromSessionFile(sessionFile);
}

async function appendOrCreateThread({ client, logger, event, ctx, reason }) {
	const rawMessages = await resolveHookMessages(event);
	if (!Array.isArray(rawMessages) || rawMessages.length === 0) return;

	const threadId = buildStableThreadId(event, ctx);
	const sessionKey = String(ctx?.sessionKey || ctx?.sessionId || "session");
	const sessionId = String(ctx?.sessionId || "").trim();
	const title = buildThreadTitle(ctx, reason);
	const normalized = rawMessages.map(normalizeRoleMessage).filter(Boolean);
	if (normalized.length === 0) return;

	const messages = normalized.map((message, index) => ({
		role: message.role,
		content: message.content,
		timestamp: message.timestamp,
		metadata: {
			external_id: buildExternalId({
				normalized: message,
				index,
				threadId,
				sessionKey,
			}),
			source: "openclaw",
			session_key: sessionKey,
			session_id: sessionId || undefined,
		},
	}));
	const idempotencyKey = buildAppendIdempotencyKey(threadId, reason, messages);

	try {
		const appended = await client.appendThread({
			threadId,
			messages,
			deduplicate: true,
			idempotencyKey,
		});
		logger.info(
			`capture: appended ${appended.messagesAdded} messages to ${threadId} (${reason || "event"})`,
		);
		return;
	} catch (err) {
		if (!client.isThreadNotFoundError(err)) {
			const message = err instanceof Error ? err.message : String(err);
			logger.warn(`capture: thread append failed for ${threadId}: ${message}`);
			return;
		}
	}

	try {
		const createdId = await client.createThread({
			threadId,
			title,
			messages,
			source: "openclaw",
		});
		logger.info(
			`capture: created thread ${createdId} with ${messages.length} messages (${reason || "event"})`,
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.warn(`capture: thread create failed for ${threadId}: ${message}`);
	}
}

/**
 * Capture thread + optional memory note after a successful agent run.
 *
 * Thread capture and memory note capture are intentionally independent:
 * - Thread append: always attempted when event.success is true and messages exist.
 *   appendOrCreateThread self-guards on empty messages.
 * - Memory note: only when the last user message matches a trigger pattern.
 *   This is an additional signal, not the gating condition for thread capture.
 *
 * Previous bug: both were gated behind shouldCaptureAsMemory, so sessions
 * ending with a question or a command were silently dropped from threads.
 */
export function buildAgentEndCaptureHandler(client, _cfg, logger) {
	const seenBySession = new Map();

	return async (event, ctx) => {
		if (!event?.success) return;

		// 1. Always thread-append this session (idempotent, self-guards on empty messages).
		await appendOrCreateThread({
			client,
			logger,
			event,
			ctx,
			reason: "agent_end",
		});

		// 2. Optionally save a memory note if the last user message is worth capturing.
		//    This is a separate, weaker signal — do not let it gate the thread append above.
		if (!Array.isArray(event?.messages)) return;
		const normalized = event.messages.map(normalizeRoleMessage).filter(Boolean);
		const lastUser = [...normalized].reverse().find((m) => m.role === "user");
		if (!lastUser || !shouldCaptureAsMemory(lastUser.content)) return;

		const sessionKey = String(ctx?.sessionKey || ctx?.sessionId || "session");
		const nextFp = fingerprint(lastUser.content);
		const previousFp = seenBySession.get(sessionKey);
		if (previousFp === nextFp) return;
		seenBySession.set(sessionKey, nextFp);

		try {
			const title = `OpenClaw note (${sessionKey})`;
			const id = await client.addMemory(lastUser.content, title, 0.65);
			logger.info(`capture: stored memory ${id}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.warn(`capture: memory store failed: ${message}`);
		}
	};
}

/**
 * Capture thread messages before reset or after compaction.
 */
export function buildBeforeResetCaptureHandler(client, _cfg, logger) {
	return async (event, ctx) => {
		const reason = typeof event?.reason === "string" ? event.reason : undefined;
		await appendOrCreateThread({ client, logger, event, ctx, reason });
	};
}
