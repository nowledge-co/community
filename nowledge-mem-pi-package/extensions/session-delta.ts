import { createHash } from "node:crypto";

export interface AcknowledgedCursor {
	count: number;
	lastExternalId?: string;
	prefixFingerprint: string;
}

export interface AcknowledgedDelta<T> {
	start: number;
	end: number;
	messages: T[];
	next: AcknowledgedCursor;
	reset: boolean;
}

export function stableMessageFingerprint(message: unknown): string {
	return JSON.stringify(message);
}

function prefixFingerprint<T>(
	messages: T[],
	end: number,
	messageFingerprint: (message: T) => string,
): string {
	const hash = createHash("sha256");
	for (const message of messages.slice(0, end)) {
		const value = messageFingerprint(message);
		hash.update(String(Buffer.byteLength(value)));
		hash.update(":");
		hash.update(value);
	}
	return hash.digest("hex");
}

export function sessionSyncLaneKey(
	threadId: string,
	apiUrl: string,
	apiKey: string | undefined,
	spaceId: string | undefined,
	agentId: string | undefined,
	hostAgentId: string | undefined,
): string {
	const destination = createHash("sha256")
		.update([apiUrl, apiKey || "", spaceId || "", agentId || "", hostAgentId || ""].join("\0"))
		.digest("hex");
	return `${destination}\0${threadId}`;
}

export function isCheckpointedAppendAck(data: unknown): boolean {
	return (
		isThreadAppendAck(data) &&
		(data as { append_mode?: unknown }).append_mode === "checkpointed"
	);
}

export function isThreadAppendAck(data: unknown): boolean {
	return (
		typeof data === "object" &&
		data !== null &&
		(data as { success?: unknown }).success === true &&
		Number.isInteger((data as { messages_added?: unknown }).messages_added) &&
		Number.isInteger((data as { total_messages?: unknown }).total_messages)
	);
}

export function isThreadCreateAck(data: unknown): boolean {
	if (typeof data !== "object" || data === null) return false;
	const thread = (data as { thread?: unknown }).thread;
	return (
		typeof thread === "object" &&
		thread !== null &&
		typeof (thread as { thread_id?: unknown }).thread_id === "string" &&
		(thread as { thread_id: string }).thread_id.length > 0
	);
}

export function selectAcknowledgedDelta<T>(
	messages: T[],
	cursor: AcknowledgedCursor | undefined,
	externalId: (message: T) => string,
	messageFingerprint: (message: T) => string = stableMessageFingerprint,
): AcknowledgedDelta<T> {
	let start = cursor?.count ?? 0;
	let reset = false;
	const acknowledgedPrefix =
		start >= 0 && start <= messages.length
			? prefixFingerprint(messages, start, messageFingerprint)
			: "";
	if (
		start < 0 ||
		start > messages.length ||
		(start > 0 &&
			(externalId(messages[start - 1]) !== cursor?.lastExternalId ||
				acknowledgedPrefix !== cursor?.prefixFingerprint))
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
			...(end > 0 ? { lastExternalId: externalId(messages[end - 1]) } : {}),
			prefixFingerprint: prefixFingerprint(messages, end, messageFingerprint),
		},
		reset,
	};
}
