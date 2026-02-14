import type { NowledgeMemClient } from "../client"
import type { NowledgeMemConfig } from "../config"
import type { OpenClawLogger } from "../../types/openclaw"

/**
 * Builds the before_agent_start hook handler.
 * Loads Working Memory briefing and optionally searches for
 * memories relevant to the current prompt.
 */
export function buildRecallHandler(
  client: NowledgeMemClient,
  cfg: NowledgeMemConfig,
  logger: OpenClawLogger
) {
  return async (event: Record<string, unknown>) => {
    const prompt = event.prompt as string | undefined
    if (!prompt || prompt.length < 5) return

    const sections: string[] = []

    // 1. Working Memory — daily briefing
    try {
      const wm = await client.readWorkingMemory()
      if (wm.available) {
        sections.push(`## Daily Briefing\n${wm.content}`)
      }
    } catch (err) {
      logger.error(`recall: working memory read failed: ${err}`)
    }

    // 2. Relevant memories for the current prompt
    try {
      const results = await client.search(prompt, cfg.maxRecallResults)
      if (results.length > 0) {
        const lines = results.map(
          (r) =>
            `- ${r.title || "(untitled)"} (${(r.score * 100).toFixed(0)}%): ${r.content.slice(0, 200)}`
        )
        sections.push(`## Relevant Memories\n${lines.join("\n")}`)
      }
    } catch (err) {
      logger.error(`recall: search failed: ${err}`)
    }

    if (sections.length === 0) return

    const context = [
      "<nowledge-mem-context>",
      "The following is recalled context from your personal knowledge base. Reference it when relevant.",
      "",
      ...sections,
      "",
      "Use these memories naturally — don't force them into every response.",
      "</nowledge-mem-context>",
    ].join("\n")

    logger.debug(`recall: injecting ${context.length} chars`)
    return { prependContext: context }
  }
}
