/**
 * MemoryCorpusSupplement implementation for OpenClaw's memory-core recall pipeline.
 *
 * When registered, Nowledge Mem's knowledge graph becomes searchable through
 * memory-core's native `memory_search` tool and its dreaming promotion pipeline.
 * This means memories stored in Nowledge Mem participate in OpenClaw's recall
 * scoring, temporal decay, and short-term-to-long-term promotion — without the
 * user needing to explicitly call Nowledge Mem tools.
 *
 * Enable via config: `corpusSupplement: true`
 *
 * Designed to coexist with the plugin's own tools and hooks:
 * - Working Memory injection: still handled by the recall hook / CE (only we know about WM)
 * - Search-based recall: handled by this supplement when active, by hooks/CE when not
 *
 * Error handling: both search() and get() catch all errors and return [] / null.
 * Supplement failures must never break OpenClaw's recall pipeline.
 */

/** Max snippet length in search results (matches memory-search.js truncation). */
const SNIPPET_MAX_CHARS = 700;

/**
 * Parse a memory ID from a path or bare ID string.
 * Handles `nowledgemem://memory/<id>` URIs and bare alphanumeric IDs.
 */
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

/**
 * Slice lines from text content with 1-based line indexing.
 */
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

/**
 * Create a MemoryCorpusSupplement backed by the Nowledge Mem knowledge graph.
 *
 * @param {import('./client.js').NowledgeMemClient} client
 * @param {object} cfg  Parsed plugin config (corpusMaxResults, corpusMinScore)
 * @param {object} logger
 * @returns {{ search: Function, get: Function }}
 */
export function createNowledgeMemCorpusSupplement(client, cfg, logger) {
	const maxResults = cfg.corpusMaxResults ?? 5;
	const minScore = (cfg.corpusMinScore ?? 0) / 100; // config is 0-100, API is 0-1

	return {
		/**
		 * Search Nowledge Mem's knowledge graph for memories matching the query.
		 * Called by memory-core's recall pipeline on every turn.
		 */
		async search({ query, maxResults: requestedMax }) {
			try {
				const limit = Math.min(20, Math.max(1, requestedMax ?? maxResults));
				const results = await client.search(query, limit);

				const filtered =
					minScore > 0
						? results.filter((r) => (r.score ?? 0) >= minScore)
						: results;

				return filtered.map((m) => {
					const snippet = String(m.content || "").slice(0, SNIPPET_MAX_CHARS);
					const lineCount = Math.max(1, snippet.split(/\r?\n/u).length);
					const result = {
						corpus: "nowledge-mem",
						path: `nowledgemem://memory/${m.id}`,
						score: Number(m.score ?? 0),
						snippet,
						title: m.title || undefined,
						kind: m.labels?.[0] || undefined,
						id: m.id,
						startLine: 1,
						endLine: lineCount,
						provenanceLabel: "Nowledge Mem",
						source: "nowledge-mem",
						sourceType: "knowledge-graph",
					};
					return result;
				});
			} catch (err) {
				logger.warn?.(
					`corpus-supplement: search failed: ${err instanceof Error ? err.message : err}`,
				);
				return [];
			}
		},

		/**
		 * Retrieve a specific memory by path or ID.
		 * Called when memory-core's agent requests full content for a search result.
		 */
		async get({ lookup, fromLine, lineCount }) {
			try {
				// Handle Working Memory alias
				const lowerLookup = String(lookup || "")
					.trim()
					.toLowerCase();
				if (lowerLookup === "memory.md" || lowerLookup === "memory") {
					const wm = await client.readWorkingMemory();
					if (!wm.available) return null;
					const slice = sliceLines(wm.content, fromLine, lineCount);
					return {
						corpus: "nowledge-mem",
						path: "nowledgemem://working-memory",
						title: "Working Memory",
						content: slice.text,
						fromLine: slice.startLine,
						lineCount: slice.endLine - slice.startLine + 1,
						provenanceLabel: "Nowledge Mem",
						sourceType: "working-memory",
					};
				}

				const memoryId = parseMemoryId(lookup);
				if (!memoryId) return null;

				const memory = await client.getMemory(memoryId);
				if (!memory) return null;
				const slice = sliceLines(memory.content ?? "", fromLine, lineCount);

				return {
					corpus: "nowledge-mem",
					path: `nowledgemem://memory/${memoryId}`,
					title: memory.title || undefined,
					content: slice.text,
					fromLine: slice.startLine,
					lineCount: slice.endLine - slice.startLine + 1,
					id: memoryId,
					provenanceLabel: "Nowledge Mem",
					sourceType: "knowledge-graph",
				};
			} catch (err) {
				logger.warn?.(
					`corpus-supplement: get failed: ${err instanceof Error ? err.message : err}`,
				);
				return null;
			}
		},
	};
}
