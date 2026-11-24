/**
 * nowledge_mem_forget — delete a memory by ID or by search query.
 *
 * Supports two modes:
 * 1. Direct delete by memoryId (fast, deterministic)
 * 2. Search by query: lists candidates, never deletes (a search score is not an identity)
 */
export function createForgetTool(client, logger) {
	return {
		name: "nowledge_mem_forget",
		description:
			"Delete a memory from your knowledge base. Provide memoryId to delete. A query only lists candidates; ask the user which one, then call again with its memoryId.",
		parameters: {
			type: "object",
			properties: {
				memoryId: {
					type: "string",
					description:
						"Specific memory ID to delete (from memory_search results or /recall output)",
				},
				query: {
					type: "string",
					description:
						"Search query to find candidates. Never deletes by itself; returns candidates to confirm.",
				},
			},
		},
		async execute(_toolCallId, params) {
			const safeParams = params && typeof params === "object" ? params : {};
			const memoryId = safeParams.memoryId
				? String(safeParams.memoryId).trim()
				: "";
			const query = safeParams.query ? String(safeParams.query).trim() : "";

			if (!memoryId && !query) {
				return {
					content: [
						{
							type: "text",
							text: "Provide memoryId or query to find the memory to delete.",
						},
					],
				};
			}

			// Mode 1: Direct delete by ID
			if (memoryId) {
				try {
					await client.exec(["--json", "m", "delete", "-f", memoryId]);
					logger.info(`forget: deleted memory ${memoryId}`);
					return {
						content: [
							{
								type: "text",
								text: `Memory ${memoryId} deleted.`,
							},
						],
						details: { action: "deleted", id: memoryId },
					};
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					logger.error(`forget by id failed: ${message}`);
					return {
						content: [
							{
								type: "text",
								text: `Failed to delete memory ${memoryId}: ${message}`,
							},
						],
					};
				}
			}

			// Mode 2: Search-then-confirm
			try {
				const results = await client.search(query, 5);

				if (results.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `No matching memories found for: "${query}"`,
							},
						],
						details: { found: 0 },
					};
				}

				// A query never deletes. Deletion is irreversible and a search score
				// is not an identity: some backends scale scores to the top hit of
				// each batch (https://github.com/nowledge-co/mem/issues/11091).
				// Return the candidates; the caller deletes by memoryId.
				const candidates = results.map(
					(r, i) =>
						`${i + 1}. ${r.title || "(untitled)"} — id: ${r.id}\n   ${r.content.slice(0, 100)}`,
				);

				return {
					content: [
						{
							type: "text",
							text: `Found ${results.length} candidates. Ask user which to delete, then call again with memoryId:\n\n${candidates.join("\n\n")}`,
						},
					],
					details: {
						action: "candidates",
						candidates: results.map((r) => ({
							id: r.id,
							title: r.title,
							score: r.score,
						})),
					},
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				logger.error(`forget search failed: ${message}`);
				return {
					content: [
						{
							type: "text",
							text: `Failed to search for memory to delete: ${message}`,
						},
					],
				};
			}
		},
	};
}
