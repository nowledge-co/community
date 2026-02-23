import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const MAX_MESSAGE_CHARS = 800;
const MIN_MESSAGES_FOR_DISTILL = 4;

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
		fullContent: text,
		timestamp,
		externalHint,
	};
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
		return { threadId, normalized };
	} catch (err) {
		if (!client.isThreadNotFoundError(err)) {
			const message = err instanceof Error ? err.message : String(err);
			logger.warn(`capture: thread append failed for ${threadId}: ${message}`);
			return null;
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
		return { threadId, normalized };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.warn(`capture: thread create failed for ${threadId}: ${message}`);
		return null;
	}
}

/**
 * Build a plain-text conversation string from normalized messages.
 * Used as input for triage and distillation.
 */
function buildConversationText(normalized) {
	return normalized
		.map((m) => `${m.role}: ${m.fullContent || m.content}`)
		.join("\n\n");
}

/**
 * Capture thread + LLM-based distillation after a successful agent run.
 *
 * Two independent operations:
 * 1. Thread append: always attempted (unconditional, idempotent).
 * 2. Triage + distill: only if enough messages AND cheap LLM triage
 *    determines the conversation has save-worthy content. This replaces
 *    the old English-only regex heuristic with language-agnostic LLM
 *    classification.
 */
export function buildAgentEndCaptureHandler(client, _cfg, logger) {
	return async (event, ctx) => {
		if (!event?.success) return;

		// 1. Always thread-append (idempotent, self-guards on empty messages).
		const result = await appendOrCreateThread({
			client,
			logger,
			event,
			ctx,
			reason: "agent_end",
		});

		// 2. Triage + distill: language-agnostic LLM-based capture.
		//    Skip short conversations — not worth the triage cost.
		if (!result || !result.normalized || result.normalized.length < MIN_MESSAGES_FOR_DISTILL) {
			return;
		}

		const conversationText = buildConversationText(result.normalized);
		if (conversationText.length < 100) return;

		try {
			const triage = await client.triageConversation(conversationText);
			if (!triage?.should_distill) {
				logger.debug?.(
					`capture: triage skipped distillation — ${triage?.reason || "no reason"}`,
				);
				return;
			}

			logger.info(`capture: triage passed — ${triage.reason}`);

			const distillResult = await client.distillThread({
				threadId: result.threadId,
				title: buildThreadTitle(ctx, "distilled"),
				content: conversationText,
			});

			const count =
				distillResult?.memories_created ??
				distillResult?.created_memories?.length ??
				0;
			logger.info(`capture: distilled ${count} memories from ${result.threadId}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.warn(`capture: triage/distill failed: ${message}`);
			// Not fatal — thread is already captured above.
		}
	};
}

/**
 * Capture thread messages before reset or after compaction.
 * Thread-only (no distillation) — these are lifecycle checkpoints.
 */
export function buildBeforeResetCaptureHandler(client, _cfg, logger) {
	return async (event, ctx) => {
		const reason = typeof event?.reason === "string" ? event.reason : undefined;
		await appendOrCreateThread({ client, logger, event, ctx, reason });
	};
}
