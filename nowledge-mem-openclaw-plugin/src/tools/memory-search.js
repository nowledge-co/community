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
			"Search the user's knowledge graph using a multi-signal scoring pipeline: " +
			"semantic (embedding), BM25 keyword, label match, graph & community signals, and recency/importance decay — " +
			"not just simple vector similarity. " +
			"Finds prior work, decisions, preferences, and facts. " +
			"Returns snippets with memoryIds. " +
			"Pass a memoryId to nowledge_mem_connections for cross-topic synthesis or source provenance. " +
			"Supports bi-temporal filtering: event_date_from/to (when the fact HAPPENED) and " +
			"recorded_date_from/to (when it was SAVED). Format: YYYY, YYYY-MM, or YYYY-MM-DD. " +
			"For browsing recent activity by day use nowledge_mem_timeline instead.",
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
				event_date_from: {
					type: "string",
					description:
						"Filter by when the fact/event HAPPENED — e.g. '2024', '2024-Q1', '2024-03', '2024-03-15'",
				},
				event_date_to: {
					type: "string",
					description:
						"Upper bound for event date (YYYY, YYYY-MM, or YYYY-MM-DD)",
				},
				recorded_date_from: {
					type: "string",
					description:
						"Filter by when this memory was SAVED to Nowledge Mem (YYYY-MM-DD)",
				},
				recorded_date_to: {
					type: "string",
					description: "Upper bound for record date (YYYY-MM-DD)",
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

			const eventDateFrom = safeParams.event_date_from
				? String(safeParams.event_date_from).trim()
				: undefined;
			const eventDateTo = safeParams.event_date_to
				? String(safeParams.event_date_to).trim()
				: undefined;
			const recordedDateFrom = safeParams.recorded_date_from
				? String(safeParams.recorded_date_from).trim()
				: undefined;
			const recordedDateTo = safeParams.recorded_date_to
				? String(safeParams.recorded_date_to).trim()
				: undefined;

			const hasTemporalFilter =
				eventDateFrom || eventDateTo || recordedDateFrom || recordedDateTo;

			if (!query) {
				return {
					content: [{ type: "text", text: JSON.stringify({ results: [] }) }],
				};
			}

			try {
				let rawResults;

				if (hasTemporalFilter) {
					// Bi-temporal path: filter by event or record time
					const { memories } = await client.searchTemporal(query, {
						limit: maxResults,
						eventDateFrom,
						eventDateTo,
						recordedDateFrom,
						recordedDateTo,
					});
					rawResults = memories;
				} else {
					// Always use the rich API path to get relevance_reason + full metadata
					rawResults = await client.searchRich(query, maxResults);
				}

				const filtered = hasMinScore
					? rawResults.filter((entry) => Number(entry.score ?? 0) >= minScore)
					: rawResults;

				const results = filtered.map((entry) => {
					const path = toMemoryPath(entry.id);
					const snippet = truncateSnippet(entry.content);
					const lineCount = Math.max(1, snippet.split(/\r?\n/u).length);
					const result = {
						path,
						startLine: 1,
						endLine: lineCount,
						score: Number(entry.score ?? 0),
						title: entry.title || "(untitled)",
						snippet,
						memoryId: entry.id,
					};
					// Scoring transparency: show which signals fired
					if (entry.relevanceReason)
						result.matchedVia = entry.relevanceReason;
					// Importance context
					if (entry.importance !== undefined && entry.importance !== null)
						result.importance = Number(entry.importance);
					// Temporal metadata
					if (entry.eventStart) result.eventStart = entry.eventStart;
					if (entry.eventEnd) result.eventEnd = entry.eventEnd;
					if (entry.temporalContext)
						result.temporalContext = entry.temporalContext;
					return result;
				});

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									results,
									provider: "nmem",
									mode: "multi-signal",
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
