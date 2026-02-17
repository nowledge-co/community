function truncateSnippet(text, maxChars = 700) {
	const value = String(text || "").trim();
	if (!value) return "";
	if (value.length <= maxChars) return value;
	return `${value.slice(0, maxChars)}…`;
}

function toMemoryPath(memoryId) {
	return `nowledgemem://memory/${memoryId}`;
}

export function createMemorySearchTool(client, logger) {
	return {
		name: "memory_search",
		description:
			"Search the user's knowledge graph for prior work, decisions, preferences, and facts. " +
			"Supports natural language queries including temporal context (e.g. 'Python setup this month', 'database decision last week'). " +
			"Returns snippets with memoryIds — pass a memoryId to nowledge_mem_connections for cross-topic synthesis and source provenance.",
		parameters: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Natural language query",
				},
				maxResults: {
					type: "number",
					description: "Max result count (1-20, default 5)",
				},
				minScore: {
					type: "number",
					description: "Optional score threshold in [0, 1]",
				},
			},
			required: ["query"],
		},
		async execute(_toolCallId, params) {
			const safeParams = params && typeof params === "object" ? params : {};
			const query = String(safeParams.query ?? "").trim();
			const maxResults = Math.min(
				20,
				Math.max(
					1,
					Math.trunc(
						Number(safeParams.maxResults ?? safeParams.limit ?? 5) || 5,
					),
				),
			);
			const minScore = Number(safeParams.minScore);
			const hasMinScore = Number.isFinite(minScore);

			if (!query) {
				return {
					content: [{ type: "text", text: JSON.stringify({ results: [] }) }],
				};
			}

			try {
				const rawResults = await client.search(query, maxResults);
				const filtered = hasMinScore
					? rawResults.filter((entry) => Number(entry.score ?? 0) >= minScore)
					: rawResults;

				const results = filtered.map((entry) => {
					const path = toMemoryPath(entry.id);
					const snippet = truncateSnippet(entry.content);
					const lineCount = Math.max(1, snippet.split(/\r?\n/u).length);
					return {
						path,
						startLine: 1,
						endLine: lineCount,
						score: Number(entry.score ?? 0),
						title: entry.title || "(untitled)",
						snippet,
						memoryId: entry.id,
					};
				});

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									results,
									provider: "nmem",
									mode: "semantic",
								},
								null,
								2,
							),
						},
					],
					details: { query, resultCount: results.length },
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				logger.error(`memory_search failed: ${message}`);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								results: [],
								disabled: true,
								error: message,
							}),
						},
					],
				};
			}
		},
	};
}
