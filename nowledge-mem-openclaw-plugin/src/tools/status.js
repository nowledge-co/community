/**
 * nowledge_mem_status - verify config, connectivity, and backend health.
 *
 * Lets the user (or agent) confirm that apiUrl, apiKey, and other
 * settings are taking effect, and that the backend is reachable.
 * Shows where each config value comes from (file, pluginConfig, env, default).
 */
import { isDefaultApiUrl } from "../config.js";

export function createStatusTool(client, _logger, cfg, runtimeInfo = {}) {
	return {
		name: "nowledge_mem_status",
		description:
			"Check Nowledge Mem status: effective configuration, backend connectivity, and version. " +
			"Call this when the user wants to verify their setup is working, " +
			"especially after changing apiUrl or apiKey for remote mode.",
		parameters: {
			type: "object",
			properties: {},
		},
		async execute() {
			const lines = [];
			const details = {};
			const sources = cfg._sources || {};

			// 0a. Plugin trust check — detect missing plugins.allow
			const pluginsAllow = runtimeInfo.pluginsAllow;
			const pluginId = "openclaw-nowledge-mem";
			details.pluginsAllow = !Array.isArray(pluginsAllow)
				? "(not set)"
				: pluginsAllow.includes(pluginId)
					? "listed"
					: "set but plugin not included";

			if (
				Array.isArray(pluginsAllow) &&
				pluginsAllow.length > 0 &&
				!pluginsAllow.includes(pluginId)
			) {
				lines.push(
					`⚠ plugins.allow is set but does not include "${pluginId}".`,
				);
				lines.push(
					"  The plugin will be BLOCKED from loading unless it holds the memory slot or is explicitly enabled.",
				);
				lines.push(
					`  Fix: add "${pluginId}" to plugins.allow in your OpenClaw config.`,
				);
				lines.push("");
			} else if (!Array.isArray(pluginsAllow) || pluginsAllow.length === 0) {
				lines.push(
					"Plugin trust: plugins.allow not set (plugin loads via entries.enabled)",
				);
				lines.push(
					`  Tip: set plugins.allow to ["${pluginId}"] to pin trust explicitly.`,
				);
				lines.push("");
			} else {
				lines.push(`Plugin trust: ${pluginId} (allowlisted)`);
			}

			// 0b. Memory slot check — show current mode and options
			const memorySlot = runtimeInfo.memorySlot;
			const contextEngineSlot = runtimeInfo.contextEngineSlot;
			const contextEngineRegistered = runtimeInfo.contextEngineRegistered === true;
			const contextEngineRegistrationError =
				typeof runtimeInfo.contextEngineRegistrationError === "string" &&
				runtimeInfo.contextEngineRegistrationError.trim()
					? runtimeInfo.contextEngineRegistrationError.trim()
					: null;
			details.memorySlot = memorySlot ?? "(unknown)";
			const ceSlot = details.contextEngineSlot;
			details.contextEngineSlot = ceSlot;
			details.contextEngineRegistered = contextEngineRegistered;
			if (memorySlot && memorySlot !== "openclaw-nowledge-mem") {
				const corpusOn = cfg.corpusSupplement === true;
				if (corpusOn) {
					lines.push(
						`Memory slot: "${memorySlot}" + corpus supplement active`,
					);
					lines.push(
						"  Nowledge Mem feeds into memory-core's recall and dreaming pipeline. All tools available.",
					);
				} else {
					lines.push(
						`ℹ Memory slot: "${memorySlot}"`,
					);
					lines.push(
						"  Two options:",
					);
					lines.push(
						'  - Full mode: set plugins.slots.memory to "openclaw-nowledge-mem" for the complete tool surface',
					);
					lines.push(
						"  - Dual mode: set corpusSupplement: true to feed your cross-tool knowledge into memory-core's recall and dreaming",
					);
				}
				lines.push("");
			} else if (memorySlot === "openclaw-nowledge-mem") {
				lines.push("Memory slot: openclaw-nowledge-mem (active)");
			}

			// 0c. Capture routing — hooks vs context engine
			const ceActive = ceSlot === "nowledge-mem" && contextEngineRegistered;
			const captureMode = !cfg.sessionDigest
				? "disabled"
				: ceActive ? "context-engine+hooks" : "hooks";
			details.captureMode = captureMode;
			if (ceActive) {
				lines.push("Context Engine slot: nowledge-mem (active)");
				lines.push(
					"  Thread capture runs through Context Engine afterTurn with hook fallback (agent_end, after_compaction, before_reset).",
				);
			} else if (ceSlot === "nowledge-mem") {
				lines.push("Context Engine slot: nowledge-mem (configured, fallback to hooks)");
				lines.push(
					"  The slot points to Nowledge Mem, but Context Engine registration is not active in this runtime. Thread capture is using hooks only.",
				);
				if (contextEngineRegistrationError) {
					lines.push(`  CE registration detail: ${contextEngineRegistrationError}`);
				}
			} else {
				lines.push(
					`Context Engine slot: ${ceSlot === "legacy" ? "legacy (default)" : `"${ceSlot}"`}`,
				);
				if (cfg.sessionDigest) {
					lines.push(
						"  Thread capture runs through hooks: agent_end, after_compaction, before_reset.",
					);
				}
			}
			if (!cfg.sessionDigest) {
				lines.push("Thread capture: disabled (sessionDigest=false)");
			} else {
				lines.push(
					"  Thread identity follows OpenClaw session lifecycle: /new or /reset starts a fresh thread, while compaction stays in the same thread.",
				);
			}

			// 1. Mode + connection target
			const remote = !isDefaultApiUrl(cfg.apiUrl);
			const mode = remote ? "remote" : "local";
			details.mode = mode;
			details.apiUrl = cfg.apiUrl || "http://127.0.0.1:14242";
			details.apiKeySet = Boolean(cfg.apiKey);
			details.space = cfg.space || null;
			details.spaceSource = sources.space || "default";

			lines.push(
				`Mode: ${remote ? `Remote (${cfg.apiUrl})` : "Local (127.0.0.1:14242)"}`,
			);
			lines.push(`API key: ${cfg.apiKey ? "set" : "not set"}`);
			lines.push(
				`Ambient space: ${cfg.space ? `${cfg.space} (${details.spaceSource})` : "Default"}`,
			);
			lines.push("Memory tools: nmem CLI");
			lines.push("Thread sync: Mem HTTP API");

			// 2. CLI resolution
			try {
				const cmd = await client.resolveCommand();
				details.cli = cmd.join(" ");
				lines.push(`CLI: ${cmd.join(" ")}`);
			} catch {
				details.cli = null;
				lines.push("CLI: not found (install with: pip install nmem-cli)");
			}

			// 3. Backend health
			let healthy = false;
			try {
				healthy = await client.checkHealth();
			} catch {
				// checkHealth already returns false on error
			}
			details.healthy = healthy;

			if (healthy) {
				lines.push("Backend: reachable");
				// Fetch detailed health info
				try {
					const health = await client.apiJson(
						"GET",
						"/health",
						undefined,
						5000,
					);
					if (health.version) {
						details.version = health.version;
						lines.push(`Version: ${health.version}`);
					}
					if (health.database_connected !== undefined) {
						details.databaseConnected = health.database_connected;
						lines.push(
							`Database: ${health.database_connected ? "connected" : "disconnected"}`,
						);
					}
				} catch {
					// Health endpoint not available on older backends
				}
			} else {
				lines.push("Backend: not reachable");
				if (remote) {
					lines.push(
						"  Check that apiUrl is correct and the server is running.",
					);
					if (!cfg.apiKey) {
						lines.push("  Remote mode usually requires an API key.");
					}
				} else {
					lines.push("  Ensure the Nowledge Mem desktop app is running.");
				}
				lines.push(
					"  Memory tools may still work through the CLI, but thread auto-sync will fail while the HTTP API is unreachable.",
				);
			}

			// 4. Effective config with sources
			lines.push("");
			lines.push("Config (source):");
			lines.push(
				`  sessionContext: ${cfg.sessionContext} (${sources.sessionContext || "?"})`,
			);
			lines.push(
				`  sessionDigest: ${cfg.sessionDigest} (${sources.sessionDigest || "?"})`,
			);
			lines.push(
				`  digestMinInterval: ${cfg.digestMinInterval}s (${sources.digestMinInterval || "?"})`,
			);
			lines.push(
				`  maxContextResults: ${cfg.maxContextResults} (${sources.maxContextResults || "?"})`,
			);
			lines.push(
				`  recallMinScore: ${cfg.recallMinScore}% (${sources.recallMinScore || "?"})`,
			);
			lines.push(
				`  maxThreadMessageChars: ${cfg.maxThreadMessageChars} (${sources.maxThreadMessageChars || "?"})`,
			);
			lines.push(
				`  corpusSupplement: ${cfg.corpusSupplement} (${sources.corpusSupplement || "?"})`,
			);

			details.config = {
				sessionContext: {
					value: cfg.sessionContext,
					source: sources.sessionContext,
				},
				sessionDigest: {
					value: cfg.sessionDigest,
					source: sources.sessionDigest,
				},
				digestMinInterval: {
					value: cfg.digestMinInterval,
					source: sources.digestMinInterval,
				},
				maxContextResults: {
					value: cfg.maxContextResults,
					source: sources.maxContextResults,
				},
				recallMinScore: {
					value: cfg.recallMinScore,
					source: sources.recallMinScore,
				},
				maxThreadMessageChars: {
					value: cfg.maxThreadMessageChars,
					source: sources.maxThreadMessageChars,
				},
				corpusSupplement: {
					value: cfg.corpusSupplement,
					source: sources.corpusSupplement,
				},
				apiUrl: { value: cfg.apiUrl || "(local)", source: sources.apiUrl },
				apiKey: {
					value: cfg.apiKey ? "(set)" : "(not set)",
					source: sources.apiKey,
				},
			};

			lines.push("");
			lines.push(
				"Priority: config file > OpenClaw settings > env vars > defaults",
			);

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details,
			};
		},
	};
}
