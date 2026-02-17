export function createStoreTool(client, logger) {
	return {
		name: "nowledge_mem_store",
		description:
			"Save an insight, decision, or important finding to your personal knowledge base. Write atomic, actionable memories with clear context.",
		parameters: {
			type: "object",
			properties: {
				text: {
					type: "string",
					description: "Memory content, atomic and actionable",
				},
				title: {
					type: "string",
					description: "Searchable title (50-60 chars)",
				},
				importance: {
					type: "number",
					description:
						"0.8-1.0: critical decisions/breakthroughs, 0.5-0.7: useful insights, 0.3-0.4: minor tips",
				},
			},
			required: ["text"],
		},
		async execute(_toolCallId, params) {
			const safeParams = params && typeof params === "object" ? params : {};
			const text = String(safeParams.text ?? "").trim();
			const title = safeParams.title ? String(safeParams.title) : undefined;
			const hasImportance =
				safeParams.importance !== undefined && safeParams.importance !== null;
			const importance = hasImportance
				? Number(safeParams.importance)
				: undefined;

			if (!text) {
				return {
					content: [
						{ type: "text", text: "Failed to save memory: text is required." },
					],
				};
			}

			try {
				const id = await client.addMemory(text, title, importance);
				logger.info(`Memory stored: ${id}`);
				return {
					content: [
						{
							type: "text",
							text: `Memory saved${title ? `: ${title}` : ""} (id: ${id})`,
						},
					],
					details: { id, title, importance },
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error(`store failed: ${msg}`);
				return {
					content: [{ type: "text", text: `Failed to save memory: ${msg}` }],
				};
			}
		},
	};
}
