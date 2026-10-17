import { createHash } from "node:crypto";
import {
	prefixFingerprint,
	selectAcknowledgedDelta as selectCoreAcknowledgedDelta,
} from "./generated/plugin-core/index.js";

export {
	isCheckpointConflictResponse,
	isCheckpointedAppendAck,
	isThreadAppendAck,
} from "./generated/plugin-core/index.js";

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
	return JSON.stringify({ role: message?.role, content: message?.content });
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
	return (
		status === 400 &&
		JSON.stringify(data ?? {})
			.toLowerCase()
			.includes("thread not found")
	);
}

export function selectAcknowledgedDelta(
	messages,
	cursor,
	externalId,
	messageFingerprint = stableMessageFingerprint,
) {
	const count = cursor?.count;
	// Alma persisted count-only and partially anchored cursors before prefix checks.
	// Preserve that compatibility without weakening the shared selector's contract.
	const compatibleCursor =
		Number.isSafeInteger(count) && count > 0 && count <= messages.length
			? {
					...cursor,
					lastExternalId:
						cursor.lastExternalId || externalId(messages[count - 1]),
					prefixFingerprint:
						cursor.prefixFingerprint ||
						prefixFingerprint(messages, count, messageFingerprint),
				}
			: cursor;
	return selectCoreAcknowledgedDelta(
		messages,
		compatibleCursor,
		externalId,
		messageFingerprint,
	);
}

export function contentBoundIdempotencyKey(
	prefix,
	threadId,
	start,
	end,
	fingerprint,
) {
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
	let snapshotEnd = 0;
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (messages[index]?.role === "assistant") {
			snapshotEnd = index + 1;
			break;
		}
	}
	const delta = selectAcknowledgedDelta(
		messages.slice(0, snapshotEnd),
		cursor,
		externalId,
	);
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
