import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildStableThreadId } from "./thread-identity.js";
import {
	contentBoundIdempotencyKey,
	selectSnapshotDelta,
	stableMessageFingerprint,
} from "../session-delta.js";
export {
	_resetConversationRoots,
	buildStableThreadId,
	registerSessionEndConversation,
	registerSessionStartConversation,
} from "./thread-identity.js";

export const DEFAULT_MAX_MESSAGE_CHARS = 800;
export const MAX_DISTILL_MESSAGE_CHARS = 2000;
export const MAX_CONVERSATION_CHARS = 30_000;
export const MIN_MESSAGES_FOR_DISTILL = 4;
export const MAX_THREAD_TITLE_CHARS = 80;
const SESSION_RESET_PROMPT_PREFIX =
	"A new session was started via /new or /reset.";
const OPENCLAW_DIRECTIVE_TAG_RE =
	/\s*\[\[\s*(?:audio_as_voice|reply_to_current|reply_to\s*:\s*[^\]\n]+)\s*\]\]\s*/giu;
const OPENCLAW_INTERNAL_SENDER_BLOCK_RE =
	/^Sender \(untrusted metadata\):\s*```json\s*([\s\S]*?)\s*```\s*([\s\S]*)$/iu;

// Per-thread triage cooldown: prevents burst triage/distillation from heartbeat.
// Maps threadId -> timestamp (ms) of last successful triage.
// Evicted opportunistically when new entries are set (see _setLastCapture).
const _lastCaptureAt = new Map();
const _MAX_COOLDOWN_ENTRIES = 200;
const _acknowledgedCursors = new Map();
const _MAX_SYNC_CURSOR_ENTRIES = 500;
const CAPTURE_MESSAGE_MODE_AUTO = "auto";
const CAPTURE_MESSAGE_MODE_SNAPSHOT = "snapshot";
const CAPTURE_MESSAGE_MODE_DELTA = "delta";

function parseAgentSessionKey(sessionKey) {
	const raw = String(sessionKey || "")
		.trim()
		.toLowerCase();
	if (!raw) return null;
	const parts = raw.split(":").filter(Boolean);
	if (parts.length < 3 || parts[0] !== "agent") return null;
	const agentId = parts[1];
	const rest = parts.slice(2).join(":");
	if (!agentId || !rest) return null;
	return { agentId, rest };
}

function isAgentCronSessionKey(sessionKey) {
	const parsed = parseAgentSessionKey(sessionKey);
	return parsed?.rest?.startsWith("cron:") === true;
}

function isSubagentSessionKey(sessionKey) {
	const raw = String(sessionKey || "")
		.trim()
		.toLowerCase();
	if (!raw) return false;
	if (raw.startsWith("subagent:")) return true;
	const parsed = parseAgentSessionKey(raw);
	return parsed?.rest?.startsWith("subagent:") === true;
}

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

function _laneKey(client, threadId) {
	return typeof client?.cursorKey === "function"
		? client.cursorKey(threadId)
		: String(threadId || "");
}

function _getCursor(client, threadId) {
	return _acknowledgedCursors.get(_laneKey(client, threadId));
}

function _setAcknowledgedCursor(client, threadId, cursor) {
	if (!threadId || !cursor) return;
	_acknowledgedCursors.set(_laneKey(client, threadId), cursor);
	if (_acknowledgedCursors.size > _MAX_SYNC_CURSOR_ENTRIES) {
		const excess = _acknowledgedCursors.size - _MAX_SYNC_CURSOR_ENTRIES;
		let removed = 0;
		for (const key of _acknowledgedCursors.keys()) {
			_acknowledgedCursors.delete(key);
			removed += 1;
			if (removed >= excess) break;
		}
	}
}

export function _resetSyncCursors() {
	_acknowledgedCursors.clear();
}

// ---------------------------------------------------------------------------
// Capture exclusion filters
// ---------------------------------------------------------------------------

/**
 * Compile a glob pattern (where `*` matches within a colon-delimited segment)
 * into a RegExp. Results are cached since patterns are immutable after parse.
 */
const _compiledPatterns = new Map();
function _compileGlob(pattern) {
	const key = String(pattern).toLowerCase();
	let re = _compiledPatterns.get(key);
	if (!re) {
		re = new RegExp(
			`^${key.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^:]*")}$`,
		);
		_compiledPatterns.set(key, re);
	}
	return re;
}

/**
 * Test whether a session key matches any exclusion glob pattern.
 * Glob `*` matches within a colon-delimited segment (not across colons).
 * Example: "agent:*:cron:*" matches "agent:main:cron:abc123"
 *
 * Exported for reuse by Context Engine and other capture paths.
 */
export function matchesExcludePattern(sessionKey, patterns) {
	if (!Array.isArray(patterns) || patterns.length === 0) return false;
	const key = String(sessionKey || "").toLowerCase();
	return patterns.some((pattern) => _compileGlob(pattern).test(key));
}

/**
 * Whether automatic thread capture should skip this OpenClaw session.
 *
 * - Agent-scoped cron / isolated-agent keys follow OpenClaw's canonical
 *   `agent:<id>:cron:*` session-key shape.
 * - Bare `cron:*` keys are still excluded: some internal paths (e.g. delivery /
 *   failure bookkeeping) use that shape without the `agent:` prefix, and
 *   agent-scoped parsing intentionally does not classify bare keys.
 */
export function isCronCaptureSessionKey(sessionKey) {
	const raw = String(sessionKey || "")
		.trim()
		.toLowerCase();
	if (!raw) return false;
	if (raw.startsWith("cron:")) return true;
	return isAgentCronSessionKey(raw);
}

/**
 * Check if any message contains the skip marker text.
 * Scans both raw message content and nested message objects.
 *
 * Exported for reuse by Context Engine and other capture paths.
 */
export function hasSkipMarker(messages, marker) {
	if (!marker || typeof marker !== "string" || !Array.isArray(messages))
		return false;
	const markerLc = marker.toLowerCase();
	return messages.some((msg) => {
		const text = extractText(msg?.content ?? msg?.message?.content);
		return text.toLowerCase().includes(markerLc);
	});
}

/**
 * Internal helper / system sessions should not become user-facing Mem threads.
 *
 * - temp:* covers OpenClaw helper sessions such as slug generation
 * - subagent sessions are execution internals, not first-class user chats
 */
export function isInternalCaptureSessionKey(sessionKey) {
	const raw = String(sessionKey || "")
		.trim()
		.toLowerCase();
	if (!raw) return false;
	if (raw.startsWith("temp:")) return true;
	return isSubagentSessionKey(raw);
}

function stripOpenClawDirectiveTags(text) {
	return String(text || "")
		.replace(OPENCLAW_DIRECTIVE_TAG_RE, " ")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function stripInternalSenderMetadata(text) {
	const raw = String(text || "").trim();
	if (!raw.startsWith("Sender (untrusted metadata):")) return raw;
	const match = raw.match(OPENCLAW_INTERNAL_SENDER_BLOCK_RE);
	if (!match) return raw;
	const [, jsonBlock, remainder] = match;
	try {
		const parsed = JSON.parse(jsonBlock);
		const label = String(parsed?.label || "")
			.trim()
			.toLowerCase();
		const id = String(parsed?.id || "")
			.trim()
			.toLowerCase();
		if (label === "openclaw-control-ui" || id === "openclaw-control-ui") {
			return String(remainder || "").trim();
		}
	} catch {
		return raw;
	}
	return raw;
}

// ---------------------------------------------------------------------------
// Message normalization utilities
// ---------------------------------------------------------------------------

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
	const extractedText = extractText(msg.content);
	if (!extractedText) return null;
	const cleanedText = stripInternalSenderMetadata(extractedText);
	if (role === "user" && cleanedText.startsWith(SESSION_RESET_PROMPT_PREFIX)) {
		return null;
	}
	const text = stripOpenClawDirectiveTags(cleanedText);
	if (!text) return null;
	if (role === "user" && text.startsWith("/")) return null;

	let timestamp;
	if (typeof msg.timestamp === "string") {
		timestamp = msg.timestamp;
	} else if (
		typeof msg.timestamp === "number" &&
		Number.isFinite(msg.timestamp)
	) {
		// OpenClaw emits epoch milliseconds, while Mem's thread API deliberately
		// accepts textual timestamps so every connector shares one wire contract.
		timestamp = new Date(msg.timestamp).toISOString();
	}

	const openclawMeta =
		msg.__openclaw && typeof msg.__openclaw === "object"
			? msg.__openclaw
			: raw.__openclaw && typeof raw.__openclaw === "object"
				? raw.__openclaw
				: null;
	const msgMetadata =
		msg.metadata && typeof msg.metadata === "object" ? msg.metadata : null;
	const rawMetadata =
		raw.metadata && typeof raw.metadata === "object" ? raw.metadata : null;
	const externalHint = [
		openclawMeta?.mirrorIdentity,
		openclawMeta?.idempotencyKey,
		msg.idempotencyKey,
		msg.idempotency_key,
		msg.external_id,
		msg.externalId,
		msg.message_id,
		msg.messageId,
		msg.openclaw_entry_id,
		msg.openclawEntryId,
		msg.id,
		raw.idempotencyKey,
		raw.idempotency_key,
		raw.external_id,
		raw.externalId,
		raw.message_id,
		raw.messageId,
		raw.openclaw_entry_id,
		raw.openclawEntryId,
		raw.id,
		msgMetadata?.external_id,
		msgMetadata?.externalId,
		msgMetadata?.message_id,
		msgMetadata?.messageId,
		rawMetadata?.external_id,
		rawMetadata?.externalId,
		rawMetadata?.message_id,
		rawMetadata?.messageId,
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

function humanizeChannel(value) {
	const normalized = String(value || "")
		.trim()
		.toLowerCase();
	if (!normalized) return "";
	const known = {
		dashboard: "Dashboard",
		"openclaw-weixin": "WeChat",
		weixin: "WeChat",
		wechat: "WeChat",
		telegram: "Telegram",
		discord: "Discord",
		whatsapp: "WhatsApp",
	};
	if (known[normalized]) return known[normalized];
	return normalized
		.replace(/^openclaw[-_]/, "")
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export function buildThreadTitle(ctx, normalizedMessages = []) {
	const firstUserMessage = normalizedMessages.find(
		(message) => message?.role === "user",
	);
	const userText = String(
		firstUserMessage?.fullContent || firstUserMessage?.content || "",
	)
		.replace(/\s+/gu, " ")
		.trim();
	if (userText) return truncate(userText, MAX_THREAD_TITLE_CHARS);

	const explicitChannel = ctx?.channel || ctx?.channelId;
	const sessionKey = String(ctx?.sessionKey || "");
	const sessionParts = sessionKey.split(":").filter(Boolean);
	const sessionChannel =
		sessionParts[0]?.toLowerCase() === "agent" ? sessionParts[2] : "";
	const channel = humanizeChannel(explicitChannel || sessionChannel);
	return channel ? `OpenClaw · ${channel}` : "OpenClaw conversation";
}

function sanitizeIdPart(input, max = 48) {
	const normalized = String(input || "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!normalized) return "session";
	return normalized.slice(0, max);
}

function buildExternalId({
	normalized,
	index,
	threadId,
	sessionKey,
	event,
	ctx,
	messageMode,
}) {
	if (normalized.externalHint) {
		return `oc:${sanitizeIdPart(normalized.externalHint, 96)}`;
	}
	const runId =
		messageMode === CAPTURE_MESSAGE_MODE_DELTA
			? String(ctx?.runId || event?.runId || "").trim()
			: "";
	const seedParts = [threadId, sessionKey];
	if (runId) seedParts.push(`run:${runId}`);
	seedParts.push(index, normalized.role, normalized.content);
	const seed = seedParts.join("|");
	const digest = createHash("sha1").update(seed).digest("hex");
	return `oc-msg:${digest}`;
}

function messageExternalId(message) {
	return String(message?.metadata?.external_id || "");
}

function buildContentBoundIdempotencyKey(threadId, reason, start, end, fingerprint) {
	return contentBoundIdempotencyKey(
		`oc:${String(reason || "event")}`,
		threadId,
		start,
		end,
		fingerprint,
	);
}

function hasStableExternalHints(normalized) {
	return (
		Array.isArray(normalized) &&
		normalized.length > 0 &&
		normalized.every(
			(message) =>
				typeof message?.externalHint === "string" &&
				message.externalHint.trim().length > 0,
		)
	);
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
	resolvedMessages,
	messageMode = CAPTURE_MESSAGE_MODE_SNAPSHOT,
}) {
	const rawMessages = resolvedMessages ?? (await resolveHookMessages(event));
	if (!Array.isArray(rawMessages) || rawMessages.length === 0) return;

	const threadId = buildStableThreadId(event, ctx);
	const sessionKey = String(ctx?.sessionKey || ctx?.sessionId || "session");
	const sessionId = String(ctx?.sessionId || "").trim();
	const normalized = rawMessages
		.map((message) => normalizeRoleMessage(message, maxMessageChars))
		.filter(Boolean);
	if (normalized.length === 0) return;
	const title = buildThreadTitle(ctx, normalized);

	const buildMessages = (resolvedMessageMode) =>
		normalized.map((message, index) => ({
			role: message.role,
			content: message.content,
			timestamp: message.timestamp,
			metadata: {
				external_id: buildExternalId({
					normalized: message,
					index,
					threadId,
					sessionKey,
					event,
					ctx,
					messageMode: resolvedMessageMode,
				}),
				source: "openclaw",
				session_key: sessionKey,
				session_id: sessionId || undefined,
			},
		}));

	let allMessages = buildMessages(
		messageMode === CAPTURE_MESSAGE_MODE_DELTA
			? CAPTURE_MESSAGE_MODE_DELTA
			: CAPTURE_MESSAGE_MODE_SNAPSHOT,
	);

	let cursor = _getCursor(client, threadId);
	if (cursor === undefined) {
		const remoteCount = await client.getThreadMessageCount(threadId);
		if (remoteCount !== null && Number.isFinite(remoteCount) && remoteCount >= 0) {
			cursor = {
				count: Math.trunc(remoteCount),
				remoteCount: Math.trunc(remoteCount),
				prefixFingerprint: "",
			};
		}
	}

	const resolvedMessageMode =
		messageMode === CAPTURE_MESSAGE_MODE_DELTA ||
		(messageMode === CAPTURE_MESSAGE_MODE_AUTO &&
			hasStableExternalHints(normalized))
			? CAPTURE_MESSAGE_MODE_DELTA
			: CAPTURE_MESSAGE_MODE_SNAPSHOT;
	if (resolvedMessageMode === CAPTURE_MESSAGE_MODE_DELTA) {
		allMessages = buildMessages(CAPTURE_MESSAGE_MODE_DELTA);
		const next = {
			count: allMessages.length,
			remoteCount: cursor?.remoteCount ?? allMessages.length,
			...(allMessages.length > 0
				? { lastExternalId: messageExternalId(allMessages[allMessages.length - 1]) }
				: {}),
			prefixFingerprint: stableMessageFingerprint(allMessages[allMessages.length - 1] || {}),
		};
		return persistMessages({
			client,
			logger,
			threadId,
			title,
			reason,
			normalized,
			allMessages,
			toSend: allMessages,
			start: 0,
			end: allMessages.length,
			next,
			cursor,
			reset: false,
			label: "delta",
		});
	}

	const delta = selectSnapshotDelta(
		allMessages,
		cursor,
		messageExternalId,
	);
	if (delta.compactionShrink) {
		_setAcknowledgedCursor(client, threadId, delta.next);
		return { threadId, normalized, messagesAdded: 0 };
	}
	if (delta.messages.length === 0) {
		return { threadId, normalized, messagesAdded: 0 };
	}
	return persistMessages({
		client,
		logger,
		threadId,
		title,
		reason,
		normalized,
		allMessages,
		toSend: delta.messages,
		start: delta.start,
		end: delta.end,
		next: delta.next,
		cursor,
		reset: delta.reset,
		label: "snapshot",
	});
}

async function persistMessages({
	client,
	logger,
	threadId,
	title,
	reason,
	normalized,
	allMessages,
	toSend,
	start,
	end,
	next,
	cursor,
	reset,
	label,
}) {
	const fingerprint = next.prefixFingerprint;
	const idempotencyKey = buildContentBoundIdempotencyKey(
		threadId,
		reason,
		start,
		end,
		fingerprint,
	);
	const expectedMessageCount =
		!reset && Number.isInteger(cursor?.remoteCount) && cursor.prefixFingerprint
			? cursor.remoteCount
			: undefined;

	const acknowledge = (remoteCount, added) => {
		_setAcknowledgedCursor(client, threadId, {
			...next,
			remoteCount,
		});
		return { threadId, normalized, messagesAdded: added };
	};

	try {
		const appended = await client.appendThread({
			threadId,
			messages: toSend,
			deduplicate: true,
			idempotencyKey,
			expectedMessageCount,
		});
		const added = appended.messagesAdded ?? 0;
		const total =
			Number.isInteger(appended.totalMessages) && appended.totalMessages >= 0
				? appended.totalMessages
				: toSend.length;
		logger.info(
			`capture: appended ${added} ${label} messages to ${threadId} (${reason || "event"})`,
		);
		return acknowledge(total, added);
	} catch (err) {
		if (client.isCheckpointConflictError?.(err)) {
			try {
				const reconciled = await client.appendThread({
					threadId,
					messages: allMessages,
					deduplicate: true,
					idempotencyKey: buildContentBoundIdempotencyKey(
						threadId,
						`${reason || "event"}-reconcile`,
						0,
						allMessages.length,
						fingerprint,
					),
				});
				const added = reconciled.messagesAdded ?? allMessages.length;
				const total =
					Number.isInteger(reconciled.totalMessages) &&
					reconciled.totalMessages >= 0
						? reconciled.totalMessages
						: allMessages.length;
				logger.info(
					`capture: reconciled ${added} messages to ${threadId} (${reason || "event"})`,
				);
				return acknowledge(total, added);
			} catch (reconcileErr) {
				const message =
					reconcileErr instanceof Error
						? reconcileErr.message
						: String(reconcileErr);
				logger.warn(
					`capture: thread reconcile failed for ${threadId}: ${message}`,
				);
				return null;
			}
		}
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
			messages: allMessages,
			source: "openclaw",
		});
		logger.info(
			`capture: created thread ${createdId} with ${allMessages.length} ${label} messages (${reason || "event"})`,
		);
		return acknowledge(allMessages.length, allMessages.length);
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
			title: buildThreadTitle(ctx, captureResult.normalized),
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
 * Even when the context engine is active, this hook remains as a safety net.
 * Thread append/create is already idempotent, so the hook path can safely
 * backstop CE afterTurn without duplicating stored messages.
 *
 * Heartbeat sessions (ctx.trigger === "heartbeat") are skipped — they
 * produce repetitive status pings that aren't worth preserving.
 * Other sessions use incremental tail sync: we preserve the real
 * transcript, but only append messages that are not already stored.
 */
export function buildAgentEndCaptureHandler(client, cfg, logger) {
	return async (event, ctx) => {
		if (!event?.success) return;
		if (ctx?.trigger === "heartbeat") return;

		const sessionKey = String(ctx?.sessionKey || ctx?.sessionId || "");
		if (isCronCaptureSessionKey(sessionKey)) {
			logger.debug?.(`capture: skipped cron session ${sessionKey}`);
			return;
		}
		if (isInternalCaptureSessionKey(sessionKey)) {
			logger.debug?.(`capture: skipped internal session ${sessionKey}`);
			return;
		}

		// Pattern-based exclusion (e.g. subagent sessions, custom jobs)
		if (matchesExcludePattern(sessionKey, cfg.captureExclude)) {
			logger.debug?.(`capture: skipped excluded session ${sessionKey}`);
			return;
		}

		// Layer 2: marker-based exclusion (user typed #nmem-skip in conversation)
		const resolvedMessages = await resolveHookMessages(event);
		if (hasSkipMarker(resolvedMessages, cfg.captureSkipMarker)) {
			logger.debug?.(`capture: skipped session with skip marker ${sessionKey}`);
			return;
		}

		const captureResult = await appendOrCreateThread({
			client,
			logger,
			event,
			ctx,
			reason: "agent_end",
			maxMessageChars: cfg.maxThreadMessageChars,
			resolvedMessages,
			messageMode: CAPTURE_MESSAGE_MODE_AUTO,
		});

		await triageAndDistill({ client, cfg, logger, captureResult, ctx });
	};
}

/**
 * Capture thread messages before reset or after compaction.
 * Thread-only (no distillation) — these are lifecycle checkpoints.
 *
 * This hook also stays enabled when the context engine is active.
 * The shared tail-sync dedup keeps the fallback path cheap and safe.
 *
 * Heartbeat sessions are skipped (same rationale as agent_end).
 */
export function buildBeforeResetCaptureHandler(client, cfg, logger) {
	return async (event, ctx) => {
		if (ctx?.trigger === "heartbeat") return;

		const sessionKey = String(ctx?.sessionKey || ctx?.sessionId || "");
		if (isCronCaptureSessionKey(sessionKey)) {
			logger.debug?.(`capture: skipped cron session ${sessionKey}`);
			return;
		}
		if (isInternalCaptureSessionKey(sessionKey)) {
			logger.debug?.(`capture: skipped internal session ${sessionKey}`);
			return;
		}

		if (matchesExcludePattern(sessionKey, cfg.captureExclude)) {
			logger.debug?.(`capture: skipped excluded session ${sessionKey}`);
			return;
		}

		// Layer 2: marker-based exclusion
		const resolvedMessages = await resolveHookMessages(event);
		if (hasSkipMarker(resolvedMessages, cfg.captureSkipMarker)) {
			logger.debug?.(`capture: skipped session with skip marker ${sessionKey}`);
			return;
		}

		const reason = typeof event?.reason === "string" ? event.reason : undefined;
		await appendOrCreateThread({
			client,
			logger,
			event,
			ctx,
			reason,
			maxMessageChars: cfg.maxThreadMessageChars,
			resolvedMessages,
		});
	};
}
