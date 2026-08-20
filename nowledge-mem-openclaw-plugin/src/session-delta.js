import { createHash } from "node:crypto";

export function sessionSyncLaneKey(threadId, apiUrl, apiKey, spaceId) {
	const destination = createHash("sha256")
		.update(
			[String(apiUrl || ""), String(apiKey || ""), String(spaceId || "")].join(
				"\0",
			),
		)
		.digest("hex");
	return `${destination}\0${String(threadId || "")}`;
}

export function stableMessageFingerprint(message) {
	return JSON.stringify({
		role: message?.role,
		content: message?.content,
		external_id: message?.metadata?.external_id,
	});
}

export function prefixFingerprint(
	messages,
	end,
	messageFingerprint = stableMessageFingerprint,
) {
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

export function threadCreateAck(data, expectedThreadId) {
	if (data === null || typeof data !== "object") return null;
	const thread =
		data.thread !== null && typeof data.thread === "object" ? data.thread : data;
	const threadId = String(thread.thread_id ?? "").trim();
	const totalMessages = thread.message_count ?? thread.total_messages;
	if (
		threadId !== String(expectedThreadId || "").trim() ||
		!Number.isInteger(totalMessages) ||
		totalMessages < 0
	) {
		return null;
	}
	return { threadId, totalMessages };
}

export function isCheckpointedAppendAck(data) {
	return isThreadAppendAck(data) && data.append_mode === "checkpointed";
}

export function isCheckpointConflictResponse(data) {
	return (
		data !== null &&
		typeof data === "object" &&
		data.error_code === "checkpoint_conflict"
	);
}

export function selectSnapshotDelta(
	messages,
	cursor,
	externalId,
	messageFingerprint = stableMessageFingerprint,
) {
	let start = cursor?.count ?? 0;
	let reset = false;
	if (start > messages.length) {
		// OpenClaw compaction shrinks the live transcript after we already
		// stored the pre-compaction history. Reset the local cursor to the
		// compacted length so later turns append only the post-compaction tail.
		const end = messages.length;
		return {
			start: end,
			end,
			messages: [],
			next: {
				count: end,
				remoteCount: cursor?.remoteCount ?? end,
				...(end > 0 ? { lastExternalId: externalId(messages[end - 1]) } : {}),
				prefixFingerprint: prefixFingerprint(messages, end, messageFingerprint),
			},
			reset: false,
			compactionShrink: true,
		};
	}
	const acknowledgedPrefix =
		start >= 0
			? prefixFingerprint(messages, start, messageFingerprint)
			: "";
	const fingerprintTrusted = Boolean(cursor?.prefixFingerprint);
	const externalIdTrusted = Boolean(cursor?.lastExternalId);
	if (
		start < 0 ||
		(start > 0 &&
			((externalIdTrusted &&
				externalId(messages[start - 1]) !== cursor.lastExternalId) ||
				(fingerprintTrusted &&
					acknowledgedPrefix !== cursor.prefixFingerprint)))
	) {
		start = 0;
		reset = true;
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
		compactionShrink: false,
	};
}

export function contentBoundIdempotencyKey(prefix, threadId, start, end, fingerprint) {
	return `${prefix}:${threadId}:${start}-${end}:${fingerprint}`;
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
