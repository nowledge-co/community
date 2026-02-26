export function createThreadFetchTool(client, logger) {
	return {
		name: "nowledge_mem_thread_fetch",
		description:
			"Fetch full messages from a conversation thread. Use to read the complete context " +
			"around a memory — pass the sourceThreadId from memory_search or memory_get results, " +
			"or a threadId from nowledge_mem_thread_search. " +
			"Supports pagination for long conversations: set offset to skip earlier messages. " +
			"Useful for progressive retrieval — fetch the first page, then request more if needed.",
		parameters: {
			type: "object",
			properties: {
				threadId: {
					type: "string",
					description:
						"Thread ID from nowledge_mem_thread_search, or sourceThreadId from memory_search / memory_get results",
				},
				offset: {
					type: "number",
					description: "Skip first N messages (for pagination, default 0)",
				},
				limit: {
					type: "number",
					description: "Max messages to return (1-200, default 50)",
				},
			},
			required: ["threadId"],
		},
		async execute(_toolCallId, params) {
			const safeParams = params && typeof params === "object" ? params : {};
			const threadId = String(safeParams.threadId ?? "").trim();
			const offset = Math.max(
				0,
				Math.trunc(Number(safeParams.offset ?? 0) || 0),
			);
			const limit = Math.min(
				200,
				Math.max(1, Math.trunc(Number(safeParams.limit ?? 50) || 50)),
			);

			if (!threadId) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								threadId: "",
								error: "threadId is required",
							}),
						},
					],
				};
			}

			try {
				const thread = await client.fetchThread(threadId, {
					offset,
					limit,
				});

				const hasMore =
					thread.messageCount > 0 &&
					offset + thread.messages.length < thread.messageCount;

				const result = {
					threadId: thread.threadId,
					title: thread.title,
					source: thread.source,
					totalMessages: thread.messageCount,
					offset,
					limit,
					returnedMessages: thread.messages.length,
					hasMore,
					messages: thread.messages,
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
					details: {
						threadId: thread.threadId,
						messageCount: thread.messages.length,
					},
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				logger.error(`nowledge_mem_thread_fetch failed: ${message}`);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								threadId,
								error: message,
							}),
						},
					],
				};
			}
		},
	};
}
