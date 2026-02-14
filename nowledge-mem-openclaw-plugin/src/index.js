import { NowledgeMemClient } from "./client.js"
import { parseConfig } from "./config.js"
import { createSearchTool } from "./tools/search.js"
import { createStoreTool } from "./tools/store.js"
import { createWorkingMemoryTool } from "./tools/working-memory.js"
import { buildRecallHandler } from "./hooks/recall.js"
import { buildCaptureHandler } from "./hooks/capture.js"
import { createRememberCommand, createRecallCommand } from "./commands/slash.js"
import { createCliRegistrar } from "./commands/cli.js"

export default {
  id: "nowledge-mem",
  name: "Nowledge Mem",
  description: "Local-first personal memory for AI agents, powered by nmem CLI",
  kind: "memory",

  register(api) {
    const cfg = parseConfig(api.pluginConfig)
    const logger = api.logger
    const client = new NowledgeMemClient(logger)

    // Tools
    api.registerTool(createSearchTool(client, logger))
    api.registerTool(createStoreTool(client, logger))
    api.registerTool(createWorkingMemoryTool(client, logger))

    // Hooks
    if (cfg.autoRecall) {
      api.on("before_agent_start", buildRecallHandler(client, cfg, logger))
    }

    if (cfg.autoCapture) {
      api.on("agent_end", buildCaptureHandler(client, cfg, logger))
    }

    // Slash commands
    api.registerCommand(createRememberCommand(client, logger))
    api.registerCommand(createRecallCommand(client, logger))

    // CLI subcommands
    api.registerCli(createCliRegistrar(client, logger), { commands: ["nowledge-mem"] })

    logger.info(
      `nowledge-mem: initialized (recall=${cfg.autoRecall}, capture=${cfg.autoCapture})`
    )
  },
}
