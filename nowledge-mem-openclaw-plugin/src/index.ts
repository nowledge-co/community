import type { OpenClawPluginApi } from "../types/openclaw"
import { NowledgeMemClient } from "./client"
import { parseConfig } from "./config"
import { createSearchTool } from "./tools/search"
import { createStoreTool } from "./tools/store"
import { createWorkingMemoryTool } from "./tools/working-memory"
import { buildRecallHandler } from "./hooks/recall"
import { buildCaptureHandler } from "./hooks/capture"
import { createRememberCommand, createRecallCommand } from "./commands/slash"
import { createCliRegistrar } from "./commands/cli"

export default {
  id: "nowledge-mem",
  name: "Nowledge Mem",
  description: "Local-first personal memory for AI agents, powered by nmem CLI",
  kind: "memory" as const,

  register(api: OpenClawPluginApi) {
    const cfg = parseConfig(api.pluginConfig)
    const logger = api.logger
    const client = new NowledgeMemClient(logger)

    // Tools — always registered
    api.registerTool(createSearchTool(client, logger))
    api.registerTool(createStoreTool(client, logger))
    api.registerTool(createWorkingMemoryTool(client, logger))

    // Hooks — conditional on config
    if (cfg.autoRecall) {
      api.on("before_agent_start", buildRecallHandler(client, cfg, logger))
    }

    if (cfg.autoCapture) {
      api.on("agent_end", buildCaptureHandler(client, cfg, logger))
    }

    // Slash commands — always registered
    api.registerCommand(createRememberCommand(client, logger))
    api.registerCommand(createRecallCommand(client, logger))

    // CLI subcommands
    api.registerCli(createCliRegistrar(client, logger), { commands: ["nowledge-mem"] })

    logger.info(
      `nowledge-mem: initialized (recall=${cfg.autoRecall}, capture=${cfg.autoCapture})`
    )
  },
}
