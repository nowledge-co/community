import { createBridgeStartupHint } from './agent-bridge-startup.mjs'

const startupHint = createBridgeStartupHint()

export default {
  async 'experimental.chat.messages.transform'(_input, output) {
    const message = output.messages.at(-1)
    if (message?.info.role !== 'user') return

    const textIndex = message.parts.findIndex(part => part.type === 'text' && !part.synthetic && !part.ignored)
    if (textIndex === -1) return

    const hint = startupHint(message.info.sessionID)
    if (!hint) return

    const parts = [...message.parts]
    const part = parts[textIndex]
    const text = [part.text, '', '<system-reminder>', hint, '</system-reminder>'].join('\n')
    parts[textIndex] = { ...part, text }
    output.messages[output.messages.length - 1] = { ...message, parts }
  },
}
