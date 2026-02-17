import { NowledgeMemClient } from "./client.js";
import { createCliRegistrar } from "./commands/cli.js";
import {
	createRecallCommand,
	createRememberCommand,
} from "./commands/slash.js";
import { parseConfig } from "./config.js";
import {
	buildAgentEndCaptureHandler,
	buildBeforeResetCaptureHandler,
} from "./hooks/capture.js";
import { buildRecallHandler } from "./hooks/recall.js";
import { createSearchTool } from "./tools/search.js";
import { createMemorySearchTool } from "./tools/memory-search.js";
import { createMemoryGetTool } from "./tools/memory-get.js";
import { createStoreTool } from "./tools/store.js";
import { createWorkingMemoryTool } from "./tools/working-memory.js";

export default {
	id: "openclaw-nowledge-mem",
	name: "Nowledge Mem",
	description: "Local-first personal memory for AI agents, powered by nmem CLI",
	kind: "memory",

	register(api) {
		const cfg = parseConfig(api.pluginConfig);
		const logger = api.logger;
		const client = new NowledgeMemClient(logger);

		// Tools
		api.registerTool(createMemorySearchTool(client, logger));
		api.registerTool(createMemoryGetTool(client, logger));
		api.registerTool(createSearchTool(client, logger));
		api.registerTool(createStoreTool(client, logger));
		api.registerTool(createWorkingMemoryTool(client, logger));

		// Hooks
		if (cfg.autoRecall) {
			api.on("before_agent_start", buildRecallHandler(client, cfg, logger));
		}

		if (cfg.autoCapture) {
			const threadCaptureHandler = buildBeforeResetCaptureHandler(
				client,
				cfg,
				logger,
			);
			api.on("agent_end", buildAgentEndCaptureHandler(client, cfg, logger));
			api.on("after_compaction", (event, ctx) =>
				threadCaptureHandler({ ...event, reason: "compaction" }, ctx),
			);
			api.on(
				"before_reset",
				threadCaptureHandler,
			);
		}

		// Slash commands
		api.registerCommand(createRememberCommand(client, logger));
		api.registerCommand(createRecallCommand(client, logger));

		// CLI subcommands
		api.registerCli(createCliRegistrar(client, logger), {
			commands: ["nowledge-mem"],
		});

		logger.info(
			`nowledge-mem: initialized (recall=${cfg.autoRecall}, capture=${cfg.autoCapture})`,
		);
	},
};
