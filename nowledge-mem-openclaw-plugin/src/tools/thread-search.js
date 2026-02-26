function truncateSnippet(text, maxChars = 400) {
	const value = String(text || "").trim();
	if (!value) return "";
	if (value.length <= maxChars) return value;
	return `${value.slice(0, maxChars)}…`;
}

export function createThreadSearchTool(client, logger) {
	return {
		name: "nowledge_mem_thread_search",
		description:
			"Search past conversations by keyword. Use when the user asks about a past discussion, " +
			"wants to find a conversation from a specific time, or when you want to explore the full context " +
			"around a topic beyond what memory_search returned. " +
			"Returns matched threads with message snippets and relevance scores. " +
			"To read full messages from a thread, pass its threadId to nowledge_mem_thread_fetch.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search keywords or natural language query",
				},
				limit: {
					type: "number",
					description: "Max threads to return (1-20, default 5)",
				},
				source: {
					type: "string",
					description:
						"Filter by source platform (e.g. 'openclaw', 'claude-code'). Omit to search all sources.",
				},
			},
			required: ["query"],
		},
		async execute(_toolCallId, params) {
			const safeParams = params && typeof params === "object" ? params : {};
			const query = String(safeParams.query ?? "").trim();
			const limit = Math.min(
				20,
				Math.max(1, Math.trunc(Number(safeParams.limit ?? 5) || 5)),
			);
			const source = safeParams.source
				? String(safeParams.source).trim()
				: undefined;

			if (!query) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ threads: [], totalFound: 0 }),
						},
					],
				};
			}

			try {
				const { threads, totalFound } = await client.searchThreadsFull(query, {
					limit,
					source,
				});

				const results = threads.map((t) => {
					const msgs = (t.matched_messages ?? []).slice(0, 3);
					return {
						threadId: t.thread_id ?? t.id,
						title: t.title || "(untitled thread)",
						source: t.source ?? "unknown",
						messageCount: Number(t.message_count ?? 0),
						lastActivity: t.last_activity ?? null,
						relevanceScore: Number(t.relevance_score ?? 0),
						matchedMessages: msgs.map((m) => ({
							role: m.role,
							snippet: truncateSnippet(m.snippet),
						})),
					};
				});

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ threads: results, totalFound }, null, 2),
						},
					],
					details: { query, threadCount: results.length },
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				logger.error(`nowledge_mem_thread_search failed: ${message}`);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								threads: [],
								totalFound: 0,
								error: message,
							}),
						},
					],
				};
			}
		},
	};
}
