/**
 * Extracts the last user/assistant turn from a message array.
 */
function getLastTurn(messages) {
  let lastUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg && typeof msg === "object" && msg.role === "user") {
      lastUserIdx = i
      break
    }
  }

  const turn = lastUserIdx >= 0 ? messages.slice(lastUserIdx) : messages
  const parts = []

  for (const msg of turn) {
    if (!msg || typeof msg !== "object") continue
    const role = msg.role
    if (role !== "user" && role !== "assistant") continue

    const content = msg.content
    if (typeof content === "string") {
      parts.push(`[${role}]: ${content}`)
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block === "object" && block.type === "text") {
          parts.push(`[${role}]: ${block.text}`)
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
export function buildCaptureHandler(client, _cfg, logger) {
  return async (event) => {
    if (!event.success || !Array.isArray(event.messages)) return

    const lastTurn = getLastTurn(event.messages)
    if (lastTurn.length < 20) return

    try {
      const summary = lastTurn.slice(0, 200)
      await client.saveThread(summary)
      logger.debug("capture: thread saved")
    } catch (err) {
      logger.error(`capture failed: ${err}`)
    }
  }
}
