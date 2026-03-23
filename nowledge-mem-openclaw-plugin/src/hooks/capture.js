import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ceState } from "../ce-state.js";

export const DEFAULT_MAX_MESSAGE_CHARS = 800;
export const MAX_DISTILL_MESSAGE_CHARS = 2000;
export const MAX_CONVERSATION_CHARS = 30_000;
export const MIN_MESSAGES_FOR_DISTILL = 4;

// Per-thread triage cooldown: prevents burst triage/distillation from heartbeat.
// Maps threadId -> timestamp (ms) of last successful triage.
// Evicted opportunistically when new entries are set (see _setLastCapture).
const _lastCaptureAt = new Map();
const _MAX_COOLDOWN_ENTRIES = 200;

function _setLastCapture(threadId, now) {
	_lastCaptureAt.set(threadId, now);
	// Opportunistic eviction: sweep stale entries when map grows large
	if (_lastCaptureAt.size > _MAX_COOLDOWN_ENTRIES) {
		const cutoff = now - 86_400_000; // 24h — generous TTL
		for (const [key, ts] of _lastCaptureAt) {
			if (ts < cutoff) _lastCaptureAt.delete(key);
		}
	}
}

export function truncate(text, max = DEFAULT_MAX_MESSAGE_CHARS) {
	const str = String(text || "").trim();
	if (!str) return "";
	return str.length > max ? `${str.slice(0, max)}…` : str;
}

export function extractText(content) {
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

export function normalizeRoleMessage(
	raw,
	maxMessageChars = DEFAULT_MAX_MESSAGE_CHARS,
) {
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
		content: truncate(text, maxMessageChars),
		fullContent: text,
		timestamp,
		externalHint,
	};
}

export function buildThreadTitle(ctx, reason) {
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

export function buildStableThreadId(event, ctx) {
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

export async function resolveHookMessages(event) {
	if (Array.isArray(event?.messages) && event.messages.length > 0) {
		return event.messages;
	}
	const sessionFile =
		typeof event?.sessionFile === "string" ? event.sessionFile.trim() : "";
	if (!sessionFile) return [];
	return loadMessagesFromSessionFile(sessionFile);
}

export async function appendOrCreateThread({
	client,
	logger,
	event,
	ctx,
	reason,
	maxMessageChars = DEFAULT_MAX_MESSAGE_CHARS,
}) {
	const rawMessages = await resolveHookMessages(event);
	if (!Array.isArray(rawMessages) || rawMessages.length === 0) return;

	const threadId = buildStableThreadId(event, ctx);
	const sessionKey = String(ctx?.sessionKey || ctx?.sessionId || "session");
	const sessionId = String(ctx?.sessionId || "").trim();
	const title = buildThreadTitle(ctx, reason);
	const allNormalized = rawMessages
		.map((message) => normalizeRoleMessage(message, maxMessageChars))
		.filter(Boolean);
	if (allNormalized.length === 0) return;

	// Collapse consecutive duplicate messages (same role + content).
	// Cron/heartbeat sessions produce many identical status pings;
	// sending them all inflates the CLI payload and adds no value.
	const normalized = [];
	for (const msg of allNormalized) {
		const prev = normalized[normalized.length - 1];
		if (prev && prev.role === msg.role && prev.content === msg.content)
			continue;
		normalized.push(msg);
	}
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
		const added = appended.messagesAdded ?? 0;
		logger.info(
			`capture: appended ${added} messages to ${threadId} (${reason || "event"})`,
		);
		return { threadId, normalized, messagesAdded: added };
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
		return { threadId, normalized, messagesAdded: messages.length };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.warn(`capture: thread create failed for ${threadId}: ${message}`);
		return null;
	}
}

/**
 * Build a plain-text conversation string from normalized messages.
 * Used as input for triage and distillation.
 *
 * Per-message content is capped at MAX_DISTILL_MESSAGE_CHARS and the
 * total output at MAX_CONVERSATION_CHARS to keep LLM API payloads
 * bounded — long coding sessions with large code blocks can produce
 * arbitrarily large fullContent.
 */
export function buildConversationText(normalized) {
	const parts = [];
	let total = 0;
	for (const m of normalized) {
		const text = truncate(
			m.fullContent || m.content,
			MAX_DISTILL_MESSAGE_CHARS,
		);
		const line = `${m.role}: ${text}`;
		if (total + line.length > MAX_CONVERSATION_CHARS) break;
		parts.push(line);
		total += line.length + 2; // account for "\n\n" separator
	}
	return parts.join("\n\n");
}

/**
 * Run triage and distillation on a captured thread result.
 *
 * Shared by the agent_end hook handler and the CE afterTurn lifecycle.
 * Callers must have already completed thread append (captureResult).
 */
export async function triageAndDistill({
	client,
	cfg,
	logger,
	captureResult,
	ctx,
}) {
	if (!cfg.sessionDigest) return;
	if (!captureResult || captureResult.messagesAdded === 0) {
		logger.debug?.("capture: no new messages since last sync, skipping triage");
		return;
	}

	const cooldownMs = (cfg.digestMinInterval ?? 300) * 1000;
	if (cooldownMs > 0 && captureResult.threadId) {
		const lastCapture = _lastCaptureAt.get(captureResult.threadId) || 0;
		if (Date.now() - lastCapture < cooldownMs) {
			logger.debug?.(
				`capture: triage cooldown active for ${captureResult.threadId}, skipping`,
			);
			return;
		}
	}

	if (
		!captureResult.normalized ||
		captureResult.normalized.length < MIN_MESSAGES_FOR_DISTILL
	) {
		return;
	}

	const conversationText = buildConversationText(captureResult.normalized);
	if (conversationText.length < 100) return;

	if (cooldownMs > 0 && captureResult.threadId) {
		_setLastCapture(captureResult.threadId, Date.now());
	}

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
			threadId: captureResult.threadId,
			title: buildThreadTitle(ctx, "distilled"),
			content: conversationText,
		});

		const count =
			distillResult?.memories_created ??
			distillResult?.created_memories?.length ??
			0;
		logger.info(
			`capture: distilled ${count} memories from ${captureResult.threadId}`,
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.warn(`capture: triage/distill failed: ${message}`);
	}
}

/**
 * Capture thread + LLM-based distillation after a successful agent run.
 *
 * When the context engine is active, this hook is a no-op — afterTurn
 * handles capture and distillation through the CE lifecycle.
 *
 * Heartbeat sessions (ctx.trigger === "heartbeat") are skipped — they
 * produce repetitive status pings that aren't worth preserving.
 */
export function buildAgentEndCaptureHandler(client, cfg, logger) {
	return async (event, ctx) => {
		if (ceState.active) return;
		if (!event?.success) return;
		if (ctx?.trigger === "heartbeat") return;

		const captureResult = await appendOrCreateThread({
			client,
			logger,
			event,
			ctx,
			reason: "agent_end",
			maxMessageChars: cfg.maxThreadMessageChars,
		});

		await triageAndDistill({ client, cfg, logger, captureResult, ctx });
	};
}

/**
 * Capture thread messages before reset or after compaction.
 * Thread-only (no distillation) — these are lifecycle checkpoints.
 *
 * When the context engine is active, this hook is a no-op — afterTurn
 * handles capture through the CE lifecycle.
 *
 * Heartbeat sessions are skipped (same rationale as agent_end).
 */
export function buildBeforeResetCaptureHandler(client, _cfg, logger) {
	return async (event, ctx) => {
		if (ceState.active) return;
		if (ctx?.trigger === "heartbeat") return;
		const reason = typeof event?.reason === "string" ? event.reason : undefined;
		await appendOrCreateThread({
			client,
			logger,
			event,
			ctx,
			reason,
			maxMessageChars: _cfg?.maxThreadMessageChars,
		});
	};
}
