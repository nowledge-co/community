function sliceLines(text, from, lines) {
	const allLines = String(text || "").split(/\r?\n/u);
	const start = Math.max(1, Math.trunc(Number(from) || 1));
	const maxLines = Math.max(1, Math.trunc(Number(lines) || allLines.length));
	const startIdx = start - 1;
	const endIdx = Math.min(allLines.length, startIdx + maxLines);
	const selected = allLines.slice(startIdx, endIdx);
	return {
		text: selected.join("\n"),
		startLine: start,
		endLine: Math.max(start, start + selected.length - 1),
		totalLines: allLines.length,
	};
}

function parseMemoryId(pathValue) {
	const value = String(pathValue || "").trim();
	if (!value) return null;

	const fromDeeplink = value.match(
		/^nowledgemem:\/\/memory\/([a-zA-Z0-9_-]+)$/u,
	);
	if (fromDeeplink) return fromDeeplink[1];

	if (/^[a-zA-Z0-9_-]{8,}$/u.test(value)) {
		return value;
	}

	return null;
}

export function createMemoryGetTool(client, logger) {
	return {
		name: "memory_get",
		description:
			"Read a specific memory snippet by path from memory_search (nowledgemem://memory/<id>) or by raw memory ID.",
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description:
						"Memory path from memory_search (nowledgemem://memory/<id>) or raw memory ID",
				},
				from: {
					type: "number",
					description: "Optional 1-based starting line number",
				},
				lines: {
					type: "number",
					description: "Optional number of lines to return",
				},
			},
			required: ["path"],
		},
		async execute(_toolCallId, params) {
			const safeParams = params && typeof params === "object" ? params : {};
			const path = String(safeParams.path ?? "").trim();
			if (!path) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								path: "",
								text: "",
								error: "path is required",
							}),
						},
					],
				};
			}

			try {
				const lowerPath = path.toLowerCase();
				if (lowerPath === "memory.md" || lowerPath === "memory") {
					const wm = await client.readWorkingMemory();
					if (!wm.available) {
						return {
							content: [
								{
									type: "text",
									text: JSON.stringify({
										path,
										text: "",
										error: "Working Memory not available",
									}),
								},
							],
						};
					}
					const snippet = sliceLines(
						wm.content,
						safeParams.from,
						safeParams.lines,
					);
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									path,
									text: snippet.text,
									startLine: snippet.startLine,
									endLine: snippet.endLine,
									totalLines: snippet.totalLines,
									source: "working-memory",
								}),
							},
						],
					};
				}

				const memoryId = parseMemoryId(path);
				if (!memoryId) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									path,
									text: "",
									error:
										"Unsupported path. Use memory_search result path (nowledgemem://memory/<id>).",
								}),
							},
						],
					};
				}

				const memory = await client.getMemory(memoryId);
				const snippet = sliceLines(
					memory.content ?? "",
					safeParams.from,
					safeParams.lines,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								path,
								memoryId,
								title: memory.title || "(untitled)",
								text: snippet.text,
								startLine: snippet.startLine,
								endLine: snippet.endLine,
								totalLines: snippet.totalLines,
							}),
						},
					],
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				logger.error(`memory_get failed: ${message}`);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ path, text: "", error: message }),
						},
					],
				};
			}
		},
	};
}
