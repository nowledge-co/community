export interface AcknowledgedCursor {
	count: number;
	lastExternalId?: string;
}

export interface AcknowledgedDelta<T> {
	start: number;
	end: number;
	messages: T[];
	next: AcknowledgedCursor;
	reset: boolean;
}

export function selectAcknowledgedDelta<T>(
	messages: T[],
	cursor: AcknowledgedCursor | undefined,
	externalId: (message: T) => string,
): AcknowledgedDelta<T> {
	let start = cursor?.count ?? 0;
	let reset = false;
	if (
		start < 0 ||
		start > messages.length ||
		(start > 0 && externalId(messages[start - 1]) !== cursor?.lastExternalId)
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
		},
		reset,
	};
}
