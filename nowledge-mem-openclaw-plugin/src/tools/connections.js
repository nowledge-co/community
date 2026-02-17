/**
 * nowledge_mem_connections — explore the knowledge graph around a topic or memory.
 *
 * This is Nowledge Mem's graph-native differentiator. Instead of isolated
 * vector search, it traverses EVOLVES chains, entity relationships,
 * source provenance (SOURCED_FROM), and memory-memory connections to
 * surface knowledge the user didn't know was connected.
 *
 * The graph contains:
 * - Memory nodes (knowledge units with 8 types)
 * - Entity nodes (people, technologies, projects)
 * - Source nodes (documents, URLs — the Library)
 * - EVOLVES edges (how understanding grows over time)
 * - SOURCED_FROM edges (which document/URL a memory came from)
 * - MENTIONS edges (which entities a memory references)
 *
 * Uses the local API directly (graph CLI isn't available yet).
 */

function formatConnection(node) {
	const title =
		node.title || node.original_name || node.name || node.label || "(untitled)";
	const type = node.node_type || node.type || "memory";
	const snippet = node.content
		? node.content.slice(0, 120)
		: node.summary || node.description || "";
	return {
		title,
		type,
		snippet,
		id: node.id || "",
		source_type: node.source_type,
		original_name: node.original_name,
	};
}

function formatEdge(edge) {
	const edgeType = edge.edge_type || edge.type || "RELATED";
	const relation = edge.content_relation || "";
	const isProgression =
		edge.is_progression !== undefined ? edge.is_progression : null;
	return { edgeType, relation, isProgression };
}

function formatEvolvesStep(step) {
	const title = step.title || "(untitled)";
	const relation = step.relation || step.content_relation || "";
	return {
		id: step.id || "",
		title,
		relation,
		version: step.version || 1,
		isLatest: step.is_latest !== false,
	};
}

export function createConnectionsTool(client, logger) {
	return {
		name: "nowledge_mem_connections",
		description:
			"Explore the knowledge graph around a memory or topic. Use this for:\n" +
			"(1) Cross-topic synthesis — 'How does my UV setup relate to my Docker notes?' or 'What connects my Python and system config memories?'\n" +
			"(2) Source provenance — which document (PDF, DOCX) or URL this knowledge was extracted from\n" +
			"(3) Knowledge evolution — how understanding grew or changed over time (EVOLVES chains)\n" +
			"(4) Entity discovery — people, projects, and tools clustered around this topic\n" +
			"Tip: call memory_search first to get a memoryId, then pass it here for deep exploration.",
		parameters: {
			type: "object",
			properties: {
				memoryId: {
					type: "string",
					description:
						"Memory ID to explore connections from (from memory_search results)",
				},
				query: {
					type: "string",
					description:
						"Topic to explore (searches first, then expands the top result's neighborhood)",
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
							text: "Provide memoryId or query to explore connections.",
						},
					],
				};
			}

			let targetId = memoryId;

			// If query provided, search first to find the best entry point
			if (!targetId && query) {
				try {
					const results = await client.search(query, 1);
					if (results.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: `No memories found for "${query}" to explore connections from.`,
								},
							],
						};
					}
					targetId = results[0].id;
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					return {
						content: [{ type: "text", text: `Search failed: ${msg}` }],
					};
				}
			}

			const sections = [];

			// 1. Graph neighbors (connected memories + entities)
			try {
				const neighborsData = await client.apiJson(
					"GET",
					`/graph/expand/${encodeURIComponent(targetId)}?depth=1&limit=15`,
				);

				const neighbors = (neighborsData.neighbors || []).map(formatConnection);
				const edges = (neighborsData.edges || []).map(formatEdge);

				if (neighbors.length > 0) {
					const memoryNeighbors = neighbors.filter(
						(n) => n.type === "Memory" || n.type === "memory",
					);
					const sourceNeighbors = neighbors.filter(
						(n) => n.type === "Source" || n.type === "source",
					);
					const entityNeighbors = neighbors.filter(
						(n) =>
							n.type !== "Memory" &&
							n.type !== "memory" &&
							n.type !== "Source" &&
							n.type !== "source",
					);

					if (memoryNeighbors.length > 0) {
						const lines = memoryNeighbors.map(
							(n) => `- ${n.title}: ${n.snippet}`,
						);
						sections.push(`Connected memories:\n${lines.join("\n")}`);
					}

					if (sourceNeighbors.length > 0) {
						const lines = sourceNeighbors.map((n) => {
							const sourceType = n.source_type || n.sourceType || "document";
							const name = n.original_name || n.originalName || n.title;
							return `- ${name} (${sourceType})${n.snippet ? `: ${n.snippet}` : ""}`;
						});
						sections.push(
							`Source documents (provenance):\n${lines.join("\n")}`,
						);
					}

					if (entityNeighbors.length > 0) {
						const lines = entityNeighbors.map(
							(n) => `- ${n.title} (${n.type})`,
						);
						sections.push(`Related entities:\n${lines.join("\n")}`);
					}

					// Surface EVOLVES edges specifically
					const evolvesEdges = edges.filter((e) => e.edgeType === "EVOLVES");
					if (evolvesEdges.length > 0) {
						const relationDescriptions = {
							replaces: "superseded by newer understanding",
							enriches: "expanded with additional detail",
							confirms: "corroborated from another source",
							challenges: "contradicted or questioned",
						};
						const lines = evolvesEdges.map((e) => {
							const desc = relationDescriptions[e.relation] || e.relation;
							return `- ${desc}${e.isProgression ? " (version chain)" : ""}`;
						});
						sections.push(`Knowledge evolution:\n${lines.join("\n")}`);
					}

					// Surface SOURCED_FROM edges (document provenance)
					const sourcedFromEdges = edges.filter(
						(e) => e.edgeType === "SOURCED_FROM",
					);
					if (sourcedFromEdges.length > 0) {
						sections.push(
							`This knowledge was extracted from ${sourcedFromEdges.length} source document(s) in the Library.`,
						);
					}
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.warn(`connections: graph expand failed: ${msg}`);
			}

			// 2. EVOLVES chain (temporal evolution of understanding)
			try {
				const chainData = await client.apiJson(
					"GET",
					`/agent/evolves?memory_id=${encodeURIComponent(targetId)}&limit=10`,
				);

				// The /agent/evolves endpoint returns edges, not a chain.
				// Try the MCP-style chain if available via a different path.
				if (Array.isArray(chainData) && chainData.length > 0) {
					const steps = chainData.map(formatEvolvesStep);
					if (steps.length > 0) {
						const lines = steps.map(
							(s) =>
								`${s.isLatest ? "→ " : "  "}${s.title}${s.relation ? ` (${s.relation})` : ""}`,
						);
						sections.push(`Version history:\n${lines.join("\n")}`);
					}
				}
			} catch {
				// EVOLVES chain may not exist for this memory — that's fine
			}

			if (sections.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `Memory ${targetId} has no graph connections yet. Connections form as more related knowledge is captured.`,
						},
					],
				};
			}

			const result = [
				`Connections for memory ${targetId}:`,
				"",
				...sections,
			].join("\n\n");

			return {
				content: [{ type: "text", text: result }],
				details: { memoryId: targetId, sectionCount: sections.length },
			};
		},
	};
}
