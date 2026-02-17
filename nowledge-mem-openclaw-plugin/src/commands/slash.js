export function createRememberCommand(client, logger) {
	return {
		name: "remember",
		description: "Save something to your knowledge base",
		acceptsArgs: true,
		async handler(ctx) {
			const text = ctx.args?.trim();
			if (!text) {
				return { text: "Usage: /remember <text to remember>" };
			}

			try {
				const id = await client.addMemory(text);
				const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text;
				logger.info(`/remember: saved ${id}`);
				return { text: `Remembered: "${preview}" (id: ${id})` };
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error(`/remember failed: ${msg}`);
				return { text: "Failed to save memory. Is nmem installed?" };
			}
		},
	};
}

export function createRecallCommand(client, logger) {
	return {
		name: "recall",
		description: "Search your knowledge base",
		acceptsArgs: true,
		async handler(ctx) {
			const query = ctx.args?.trim();
			if (!query) {
				return { text: "Usage: /recall <search query>" };
			}

			try {
				const results = await client.search(query, 5);
				if (results.length === 0) {
					return { text: `No memories found for: "${query}"` };
				}

				const lines = results.map(
					(r, i) =>
						`${i + 1}. ${r.title || "(untitled)"} (${(r.score * 100).toFixed(0)}%)\n   ${r.content.slice(0, 150)}`,
				);
				logger.debug(`/recall: found ${results.length} results`);
				return {
					text: `Found ${results.length} memories:\n\n${lines.join("\n\n")}`,
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error(`/recall failed: ${msg}`);
				return { text: "Failed to search. Is nmem installed?" };
			}
		},
	};
}
