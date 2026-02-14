export function createSearchTool(client, logger) {
  return {
    name: "nowledge_mem_search",
    description:
      "Search your personal knowledge base. Returns memories ranked by relevance with confidence scores. Use for finding past decisions, debugging solutions, patterns, and insights.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query",
        },
        limit: {
          type: "number",
          description: "Max results (1-20, default 5)",
        },
      },
      required: ["query"],
    },
    async execute(params) {
      const query = String(params.query ?? "")
      const limit = Number(params.limit ?? 5)

      try {
        const results = await client.search(query, limit)

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: "No matching memories found." }],
          }
        }

        const formatted = results
          .map(
            (r, i) =>
              `[${i + 1}] ${r.title} (score: ${(r.score * 100).toFixed(0)}%)\n${r.content}`
          )
          .join("\n\n")

        return {
          content: [{ type: "text", text: formatted }],
          details: { resultCount: results.length, query },
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error(`search failed: ${msg}`)
        return {
          content: [{ type: "text", text: `Search failed: ${msg}` }],
        }
      }
    },
  }
}
