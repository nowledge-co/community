import { createHash } from "node:crypto";

export function sessionSyncLaneKey(threadId, apiUrl, apiKey, spaceId) {
	const destination = createHash("sha256")
		.update([String(apiUrl || ""), String(apiKey || ""), String(spaceId || "")].join("\0"))
		.digest("hex");
	return `${destination}\0${String(threadId || "")}`;
}

export function stableMessageFingerprint(message) {
	return JSON.stringify({ role: message?.role, content: message?.content });
}

function prefixFingerprint(messages, end, messageFingerprint) {
	const hash = createHash("sha256");
	for (const message of messages.slice(0, end)) {
		const value = messageFingerprint(message);
		hash.update(String(Buffer.byteLength(value)));
		hash.update(":");
		hash.update(value);
	}
	return hash.digest("hex");
}

export function isThreadAppendAck(data) {
	return (
		data !== null &&
		typeof data === "object" &&
		data.success === true &&
		Number.isInteger(data.messages_added) &&
		Number.isInteger(data.total_messages)
	);
}

export function isCheckpointedAppendAck(data) {
	return isThreadAppendAck(data) && data.append_mode === "checkpointed";
}

export function isCheckpointConflictResponse(data) {
	return data !== null && typeof data === "object" && data.error_code === "checkpoint_conflict";
}

export function isThreadNotFoundResponse(status, data) {
	if (
		data !== null &&
		typeof data === "object" &&
		data.error_code === "thread_not_found"
	) {
		return true;
	}
	if (status === 404) return true;
	return JSON.stringify(data ?? {}).toLowerCase().includes("thread not found");
}

export function selectAcknowledgedDelta(
	messages,
	cursor,
	externalId,
	messageFingerprint = stableMessageFingerprint,
) {
	let start = cursor?.count ?? 0;
	let reset = false;
	if (start < 0 || start > messages.length) {
		start = 0;
		reset = true;
	} else if (start > 0) {
		const fingerprintTrusted = Boolean(cursor?.prefixFingerprint);
		const externalIdTrusted = Boolean(cursor?.lastExternalId);
		const prefix = prefixFingerprint(messages, start, messageFingerprint);
		if (
			(externalIdTrusted && externalId(messages[start - 1]) !== cursor.lastExternalId) ||
			(fingerprintTrusted && prefix !== cursor.prefixFingerprint)
		) {
			start = 0;
			reset = true;
		}
	}
	const end = messages.length;
	return {
		start,
		end,
		messages: messages.slice(start),
		next: {
			count: end,
			remoteCount: cursor?.remoteCount ?? end,
			...(end > 0 ? { lastExternalId: externalId(messages[end - 1]) } : {}),
			prefixFingerprint: prefixFingerprint(messages, end, messageFingerprint),
		},
		reset,
	};
}

export function contentBoundIdempotencyKey(prefix, threadId, start, end, fingerprint) {
	return `${prefix}:${threadId}:${start}-${end}:${fingerprint}`;
}

export function planAutomaticFlush({
	messages,
	cursor,
	threadId,
	externalId = (message) =>
		typeof message?.external_id === "string" && message.external_id
			? message.external_id
			: stableMessageFingerprint(message),
	prefix = "alma-thread",
}) {
	const delta = selectAcknowledgedDelta(messages, cursor, externalId);
	const trusted =
		!delta.reset &&
		Number.isInteger(cursor?.remoteCount) &&
		Boolean(cursor?.prefixFingerprint);
	return {
		delta,
		expectedMessageCount: trusted ? cursor.remoteCount : undefined,
		idempotencyKey: contentBoundIdempotencyKey(
			prefix,
			threadId,
			delta.start,
			delta.end,
			delta.next.prefixFingerprint,
		),
	};
}

export function hasUserAndAssistant(messages) {
	if (!Array.isArray(messages) || messages.length < 2) return false;
	let hasUser = false;
	let hasAssistant = false;
	for (const message of messages) {
		if (message?.role === "user") hasUser = true;
		else if (message?.role === "assistant") hasAssistant = true;
		if (hasUser && hasAssistant) return true;
	}
	return false;
}

/**
 * In-flight coalescing for per-thread automatic flush.
 * A second flush requested while one is running is remembered and replayed
 * after the in-flight persist finishes, so later turns are not dropped.
 */
export function beginInFlightFlush(state) {
	if (state.flushing) {
		state.pending = true;
		return "wait";
	}
	state.flushing = true;
	state.pending = false;
	return "run";
}

export function finishInFlightFlush(state) {
	state.flushing = false;
	if (!state.pending) return "done";
	state.pending = false;
	return "rerun";
}
