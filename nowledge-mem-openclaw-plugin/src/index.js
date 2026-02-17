import { NowledgeMemClient } from "./client.js";
import { createCliRegistrar } from "./commands/cli.js";
import {
	createForgetCommand,
	createRecallCommand,
	createRememberCommand,
} from "./commands/slash.js";
import { parseConfig } from "./config.js";
import {
	buildAgentEndCaptureHandler,
	buildBeforeResetCaptureHandler,
} from "./hooks/capture.js";
import { buildRecallHandler } from "./hooks/recall.js";
import { createConnectionsTool } from "./tools/connections.js";
import { createContextTool } from "./tools/context.js";
import { createForgetTool } from "./tools/forget.js";
import { createMemoryGetTool } from "./tools/memory-get.js";
import { createMemorySearchTool } from "./tools/memory-search.js";
import { createSaveTool } from "./tools/save.js";
import { createTimelineTool } from "./tools/timeline.js";

export default {
	id: "openclaw-nowledge-mem",
	name: "Nowledge Mem",
	description:
		"Local-first knowledge graph memory for AI agents — cross-AI continuity, powered by Nowledge Mem",
	kind: "memory",

	register(api) {
		const cfg = parseConfig(api.pluginConfig);
		const logger = api.logger;
		const client = new NowledgeMemClient(logger, {
			apiUrl: cfg.apiUrl,
			apiKey: cfg.apiKey,
		});

		// OpenClaw memory-slot compatibility (required for system prompt activation)
		api.registerTool(createMemorySearchTool(client, logger));
		api.registerTool(createMemoryGetTool(client, logger));

		// Nowledge Mem native tools (our differentiators)
		api.registerTool(createSaveTool(client, logger));
		api.registerTool(createContextTool(client, logger));
		api.registerTool(createConnectionsTool(client, logger));
		api.registerTool(createTimelineTool(client, logger));
		api.registerTool(createForgetTool(client, logger));

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
			api.on("before_reset", threadCaptureHandler);
		}

		// Slash commands
		api.registerCommand(createRememberCommand(client, logger));
		api.registerCommand(createRecallCommand(client, logger));
		api.registerCommand(createForgetCommand(client, logger));

		// CLI subcommands
		api.registerCli(createCliRegistrar(client, logger), {
			commands: ["nowledge-mem"],
		});

		const remoteMode = cfg.apiUrl && cfg.apiUrl !== "http://127.0.0.1:14242";
		logger.info(
			`nowledge-mem: initialized (recall=${cfg.autoRecall}, capture=${cfg.autoCapture}, mode=${remoteMode ? `remote → ${cfg.apiUrl}` : "local"})`,
		);
	},
};
