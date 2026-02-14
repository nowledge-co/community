import type { NowledgeMemClient } from "../client"
import type { NowledgeMemConfig } from "../config"
import type { OpenClawLogger } from "../../types/openclaw"

/**
 * Extracts the last user→assistant turn from a message array.
 */
function getLastTurn(messages: unknown[]): string {
  let lastUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (
      msg &&
      typeof msg === "object" &&
      (msg as Record<string, unknown>).role === "user"
    ) {
      lastUserIdx = i
      break
    }
  }

  const turn = lastUserIdx >= 0 ? messages.slice(lastUserIdx) : messages
  const parts: string[] = []

  for (const msg of turn) {
    if (!msg || typeof msg !== "object") continue
    const m = msg as Record<string, unknown>
    const role = m.role as string
    if (role !== "user" && role !== "assistant") continue

    const content = m.content
    if (typeof content === "string") {
      parts.push(`[${role}]: ${content}`)
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (
          block &&
          typeof block === "object" &&
          (block as Record<string, unknown>).type === "text"
        ) {
          parts.push(`[${role}]: ${(block as Record<string, unknown>).text}`)
        }
      }
    }
  }

  return parts.join("\n\n")
}

/**
 * Builds the agent_end hook handler.
 * Saves the conversation thread when a session ends successfully.
 */
export function buildCaptureHandler(
  client: NowledgeMemClient,
  _cfg: NowledgeMemConfig,
  logger: OpenClawLogger
) {
  return async (event: Record<string, unknown>) => {
    if (!event.success || !Array.isArray(event.messages)) return

    const lastTurn = getLastTurn(event.messages)
    if (lastTurn.length < 20) return

    try {
      // Save thread rather than extracting individual memories —
      // let Nowledge Mem's Background Intelligence handle distillation
      const summary = lastTurn.slice(0, 200)
      await client.saveThread(summary)
      logger.debug("capture: thread saved")
    } catch (err) {
      logger.error(`capture failed: ${err}`)
    }
  }
}
