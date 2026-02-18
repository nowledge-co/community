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

export function createForgetCommand(client, logger) {
	return {
		name: "forget",
		description: "Delete a memory from your knowledge base",
		acceptsArgs: true,
		async handler(ctx) {
			const text = ctx.args?.trim();
			if (!text) {
				return { text: "Usage: /forget <memory id or search query>" };
			}

			const isLikelyId = /^[a-zA-Z0-9_-]{8,}$/u.test(text);

			try {
				if (isLikelyId) {
					client.exec(["--json", "m", "delete", "-f", text]);
					logger.info(`/forget: deleted memory ${text}`);
					return { text: `Forgotten: memory ${text} deleted.` };
				}

				const results = await client.search(text, 5);
				if (results.length === 0) {
					return { text: `No matching memories found for: "${text}"` };
				}

				if (results[0].score >= 0.85) {
					const target = results[0];
					client.exec(["--json", "m", "delete", "-f", target.id]);
					logger.info(`/forget: deleted memory ${target.id}`);
					const preview = target.title || target.content.slice(0, 60);
					return {
						text: `Forgotten: "${preview}" (id: ${target.id})`,
					};
				}

				const lines = results.map(
					(r, i) =>
						`${i + 1}. ${r.title || "(untitled)"} (${(r.score * 100).toFixed(0)}%) — id: ${r.id}`,
				);
				return {
					text: `Multiple matches. Use /forget <id> with one of:\n\n${lines.join("\n")}`,
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error(`/forget failed: ${msg}`);
				return { text: `Failed to delete memory: ${msg}` };
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
				logger.debug?.(`/recall: found ${results.length} results`);
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
