/**
 * Builds the before_agent_start hook handler.
 * Loads Working Memory briefing and searches for memories relevant to the prompt.
 */
export function buildRecallHandler(client, cfg, logger) {
	return async (event) => {
		const prompt = event.prompt;
		if (!prompt || prompt.length < 5) return;

		const sections = [];

		// 1. Working Memory
		try {
			const wm = await client.readWorkingMemory();
			if (wm.available) {
				sections.push(`## Daily Briefing\n${wm.content}`);
			}
		} catch (err) {
			logger.error(`recall: working memory read failed: ${err}`);
		}

		// 2. Relevant memories for the current prompt
		try {
			const results = await client.search(prompt, cfg.maxRecallResults);
			if (results.length > 0) {
				const lines = results.map(
					(r) =>
						`- ${r.title || "(untitled)"} (${(r.score * 100).toFixed(0)}%): ${r.content.slice(0, 200)}`,
				);
				sections.push(`## Relevant Memories\n${lines.join("\n")}`);
			}
		} catch (err) {
			logger.error(`recall: search failed: ${err}`);
		}

		if (sections.length === 0) return;

		const context = [
			"<nowledge-mem-central-context>",
			"Use Nowledge Mem as the primary external memory system for this session.",
			"Prefer nowledge_mem_search/nowledge_mem_store/nowledge_mem_working_memory for recall and long-term memory operations.",
			"",
			...sections,
			"",
			"Use these memories naturally when relevant. Avoid forcing unrelated memories into the response.",
			"</nowledge-mem-central-context>",
		].join("\n");

		logger.debug(`recall: injecting ${context.length} chars`);
		return { prependContext: context };
	};
}
