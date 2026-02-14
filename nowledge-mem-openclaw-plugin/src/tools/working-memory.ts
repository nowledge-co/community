import type { NowledgeMemClient } from "../client"
import type { OpenClawLogger, ToolDefinition, ToolResult } from "../../types/openclaw"

export function createWorkingMemoryTool(
  client: NowledgeMemClient,
  logger: OpenClawLogger
): ToolDefinition {
  return {
    name: "nowledge_mem_working_memory",
    description:
      "Read your daily Working Memory briefing. Contains active focus areas, priorities, unresolved flags, and recent changes. Call at session start for context.",
    parameters: {
      type: "object",
      properties: {},
    },
    async execute(): Promise<ToolResult> {
      try {
        const wm = await client.readWorkingMemory()

        if (!wm.available) {
          return {
            content: [
              {
                type: "text",
                text: "Working Memory not available. Ensure Nowledge Mem is running with Background Intelligence enabled.",
              },
            ],
          }
        }

        return {
          content: [{ type: "text", text: wm.content }],
          details: { available: true },
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error(`working memory read failed: ${msg}`)
        return {
          content: [
            { type: "text", text: `Failed to read Working Memory: ${msg}` },
          ],
        }
      }
    },
  }
}
