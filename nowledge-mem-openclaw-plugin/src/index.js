import { NowledgeMemClient } from "./client.js";
import { createCliRegistrar } from "./commands/cli.js";
import {
	createForgetCommand,
	createRecallCommand,
	createRememberCommand,
} from "./commands/slash.js";
import { isDefaultApiUrl, parseConfig } from "./config.js";
import { buildBehavioralHook } from "./hooks/behavioral.js";
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
import { createStatusTool } from "./tools/status.js";
import { createThreadFetchTool } from "./tools/thread-fetch.js";
import { createThreadSearchTool } from "./tools/thread-search.js";
import { createTimelineTool } from "./tools/timeline.js";

export default {
	id: "openclaw-nowledge-mem",
	name: "Nowledge Mem",
	description:
		"Local-first knowledge graph memory for AI agents — cross-AI continuity, powered by Nowledge Mem",
	kind: "memory",

	register(api) {
		const logger = api.logger;
		const cfg = parseConfig(api.pluginConfig, logger);
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

		// Thread tools (progressive conversation retrieval)
		api.registerTool(createThreadSearchTool(client, logger));
		api.registerTool(createThreadFetchTool(client, logger));

		// Diagnostics
		api.registerTool(createStatusTool(client, logger, cfg));

		// Always-on: behavioral guidance so the agent proactively saves and searches.
		// Fires every turn via before_prompt_build — ~50 tokens, negligible cost.
		// When sessionContext is on, guidance adjusts to avoid redundant searches.
		api.on("before_prompt_build", buildBehavioralHook(logger, cfg));

		// Session context: inject Working Memory + recalled memories at prompt time.
		if (cfg.sessionContext) {
			api.on("before_prompt_build", buildRecallHandler(client, cfg, logger));
		}

		// Session digest: capture threads + LLM distillation at lifecycle events.
		if (cfg.sessionDigest) {
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

		const remoteMode = !isDefaultApiUrl(cfg.apiUrl);
		const remoteAuthError = client.getRemoteAuthConfigError?.();
		logger.info(
			`nowledge-mem: initialized (context=${cfg.sessionContext}, digest=${cfg.sessionDigest}, mode=${remoteMode ? `remote → ${cfg.apiUrl}` : "local"})`,
		);
		if (remoteAuthError) {
			logger.warn(`nowledge-mem: ${remoteAuthError}`);
		}
	},
};
