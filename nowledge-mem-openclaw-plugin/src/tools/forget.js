/**
 * nowledge_mem_forget — delete a memory by ID or by search query.
 *
 * Supports two modes:
 * 1. Direct delete by memoryId (fast, deterministic)
 * 2. Search-then-confirm by query (finds candidates, deletes if single high-confidence match)
 */
export function createForgetTool(client, logger) {
	return {
		name: "nowledge_mem_forget",
		description:
			"Delete a memory from your knowledge base. Provide memoryId for direct delete, or query to find and remove. If multiple matches, returns candidates for user confirmation.",
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
						"Search query to find the memory to delete. If a single high-confidence match is found, it is deleted directly.",
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
					client.exec(["--json", "m", "delete", "-f", memoryId]);
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

				// Single high-confidence match — delete directly
				if (results.length === 1 || results[0].score >= 0.85) {
					const target = results[0];
					try {
						client.exec(["--json", "m", "delete", "-f", target.id]);
						logger.info(`forget: deleted memory ${target.id} via search`);
						return {
							content: [
								{
									type: "text",
									text: `Deleted: "${target.title || target.content.slice(0, 60)}" (id: ${target.id})`,
								},
							],
							details: { action: "deleted", id: target.id },
						};
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						return {
							content: [
								{
									type: "text",
									text: `Found match but delete failed: ${message}`,
								},
							],
						};
					}
				}

				// Multiple candidates — return list for user to pick
				const candidates = results.map(
					(r, i) =>
						`${i + 1}. ${r.title || "(untitled)"} (${(r.score * 100).toFixed(0)}%) — id: ${r.id}\n   ${r.content.slice(0, 100)}`,
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
