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
 * - EVOLVES edges (how understanding grows over time: replaces, enriches, confirms, challenges)
 * - CRYSTALLIZED_FROM edges (crystal ← source memories it synthesized)
 * - SOURCED_FROM edges (memory ← document it was extracted from)
 * - MENTIONS edges (which entities a memory references)
 *
 * Each connection is shown WITH its relationship type and strength.
 *
 * Uses the local API directly (graph CLI isn't available yet).
 */

const EDGE_TYPE_LABELS = {
	CRYSTALLIZED_FROM: "crystallized from",
	EVOLVES: "knowledge evolution",
	SOURCED_FROM: "sourced from document",
	MENTIONS: "mentions entity",
	RELATED: "related",
};

const EVOLVES_RELATION_LABELS = {
	replaces: "supersedes — newer understanding replaces older",
	enriches: "enriches — adds depth to earlier knowledge",
	confirms: "confirms — corroborated from another source",
	challenges: "challenges — contradicts or questions",
};

function getNodeTitle(node) {
	return (
		node.label ||
		node.metadata?.title ||
		node.title ||
		node.original_name ||
		node.name ||
		"(untitled)"
	);
}

function getNodeSnippet(node) {
	const content =
		node.metadata?.content || node.content || node.summary || node.description || "";
	return content.slice(0, 150);
}

function getNodeType(node) {
	return node.node_type || node.type || "memory";
}

/**
 * Build a map from node id → node for efficient edge→node joining
 */
function buildNodeMap(nodes) {
	const map = new Map();
	for (const n of nodes) {
		map.set(n.id, n);
	}
	return map;
}

/**
 * Group edges by type, pairing each with the connected node.
 * Returns { edgeType → [{ node, edge }] }
 */
function groupConnectionsByEdgeType(edges, nodeMap, centerId) {
	const groups = new Map();

	for (const edge of edges) {
		const neighborId =
			edge.source === centerId ? edge.target : edge.source;
		const node = nodeMap.get(neighborId);
		if (!node) continue;

		const edgeType = edge.edge_type || edge.type || "RELATED";
		if (!groups.has(edgeType)) groups.set(edgeType, []);

		groups.get(edgeType).push({
			node,
			edge,
			neighborId,
			relation: edge.metadata?.relation_type || edge.content_relation || null,
			weight: edge.weight ?? edge.relevance_score ?? 0.5,
			label: edge.label || EDGE_TYPE_LABELS[edgeType] || edgeType,
		});
	}

	return groups;
}

export function createConnectionsTool(client, logger) {
	return {
		name: "nowledge_mem_connections",
		description:
			"Explore the knowledge graph around a memory or topic. Use this for:\n" +
			"(1) Cross-topic synthesis — 'How does my UV setup relate to my Docker notes?'\n" +
			"(2) Source provenance — which document (PDF, DOCX) or URL this knowledge was extracted from\n" +
			"(3) Knowledge evolution — how understanding grew or changed over time (EVOLVES chains)\n" +
			"(4) Crystal breakdown — which source memories a crystal was synthesized from\n" +
			"(5) Entity discovery — people, projects, and tools clustered around this topic\n" +
			"Each connection shows its relationship type and strength.\n" +
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

			// 1. Graph neighbors (connected memories, sources, entities) — with edge types joined
			try {
				const neighborsData = await client.graphExpand(targetId, {
					depth: 1,
					limit: 20,
				});

				const neighbors = neighborsData.neighbors || [];
				const edges = neighborsData.edges || [];
				const nodeMap = buildNodeMap(neighbors);
				const grouped = groupConnectionsByEdgeType(edges, nodeMap, targetId);

				// --- CRYSTALLIZED_FROM: crystal's source memories ---
				const crystalConns = grouped.get("CRYSTALLIZED_FROM") || [];
				if (crystalConns.length > 0) {
					const lines = crystalConns.map(({ node, weight }) => {
						const title = getNodeTitle(node);
						const snippet = getNodeSnippet(node);
						const strength = weight ? ` [${(weight * 100).toFixed(0)}%]` : "";
						return `  - ${title}${strength}${snippet ? `: ${snippet}` : ""}\n    → id: ${node.id}`;
					});
					sections.push(
						`Synthesized from ${crystalConns.length} source memor${crystalConns.length === 1 ? "y" : "ies"}:\n${lines.join("\n")}`,
					);
				}

				// --- EVOLVES: knowledge evolution edges ---
				const evolvesConns = grouped.get("EVOLVES") || [];
				if (evolvesConns.length > 0) {
					const lines = evolvesConns.map(({ node, relation }) => {
						const title = getNodeTitle(node);
						const relLabel =
							EVOLVES_RELATION_LABELS[relation] ||
							relation ||
							"related knowledge";
						return `  - ${relLabel}\n    "${title}"\n    → id: ${node.id}`;
					});
					sections.push(`Knowledge evolution:\n${lines.join("\n")}`);
				}

				// --- SOURCED_FROM: document provenance ---
				const sourceConns = grouped.get("SOURCED_FROM") || [];
				if (sourceConns.length > 0) {
					const lines = sourceConns.map(({ node }) => {
						const name = getNodeTitle(node);
						const sourceType =
							node.metadata?.source_type || node.source_type || "document";
						return `  - ${name} (${sourceType}) → id: ${node.id}`;
					});
					sections.push(
						`Sourced from document${sourceConns.length > 1 ? "s" : ""}:\n${lines.join("\n")}`,
					);
				}

				// --- MENTIONS: entity connections ---
				const mentionConns = grouped.get("MENTIONS") || [];
				if (mentionConns.length > 0) {
					const lines = mentionConns.map(({ node }) => {
						const name = getNodeTitle(node);
						const type = getNodeType(node);
						return `  - ${name} (${type})`;
					});
					sections.push(`Entities mentioned:\n${lines.join("\n")}`);
				}

				// --- Other memory connections (RELATED, etc.) ---
				for (const [edgeType, conns] of grouped.entries()) {
					if (
						["CRYSTALLIZED_FROM", "EVOLVES", "SOURCED_FROM", "MENTIONS"].includes(
							edgeType,
						)
					)
						continue;

					const memConns = conns.filter(
						({ node }) =>
							getNodeType(node) === "memory" || getNodeType(node) === "Memory",
					);
					if (memConns.length === 0) continue;

					const lines = memConns.map(({ node, weight }) => {
						const title = getNodeTitle(node);
						const snippet = getNodeSnippet(node);
						const strength = weight ? ` [${(weight * 100).toFixed(0)}%]` : "";
						return `  - ${title}${strength}: ${snippet}\n    → id: ${node.id}`;
					});
					const label =
						EDGE_TYPE_LABELS[edgeType] ||
						edgeType.toLowerCase().replace(/_/g, " ");
					sections.push(
						`Connected via "${label}" (${memConns.length}):\n${lines.join("\n")}`,
					);
				}

				if (neighbors.length === 0) {
					sections.push(
						"No direct connections yet — connections form as the Knowledge Agent processes related memories.",
					);
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.warn(`connections: graph expand failed: ${msg}`);
			}

			// 2. EVOLVES chain (full version history) — CLI v0.4.1+ / API fallback
			try {
				const evolveData = await client.graphEvolves(targetId, { limit: 10 });
				const edges = evolveData?.edges ?? [];

				if (edges.length > 0) {
					const lines = edges.map((edge) => {
						const relation = edge.content_relation || "";
						const relLabel = EVOLVES_RELATION_LABELS[relation] || relation || "";
						// Show the "other" node relative to our target
						const isOlderNode = edge.older_id === targetId;
						const otherTitle = isOlderNode
							? (edge.newer_title || "(untitled)")
							: (edge.older_title || "(untitled)");
						const direction = isOlderNode ? "→" : "←";
						return `  ${direction} ${otherTitle}${relLabel ? ` — ${relLabel}` : ""}`;
					});
					sections.push(`Knowledge evolution:\n${lines.join("\n")}`);
				}
			} catch {
				// No EVOLVES chain for this memory — normal
			}

			if (sections.length === 0 || (sections.length === 1 && sections[0].includes("No direct connections"))) {
				return {
					content: [
						{
							type: "text",
							text: `Memory ${targetId} has no graph connections yet. Connections form as the Knowledge Agent processes related knowledge.`,
						},
					],
				};
			}

			const result = [
				`Graph connections for: ${targetId}`,
				"",
				...sections,
			].join("\n\n");

			return {
				content: [{ type: "text", text: result }],
				details: {
					memoryId: targetId,
					sectionCount: sections.length,
				},
			};
		},
	};
}
