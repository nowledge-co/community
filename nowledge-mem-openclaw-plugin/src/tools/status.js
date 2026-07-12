/**
 * nowledge_mem_status - verify config, connectivity, and backend health.
 *
 * Lets the user (or agent) confirm that apiUrl, apiKey, and other
 * settings are taking effect, and that the backend is reachable.
 * Shows where each config value comes from (file, pluginConfig, env, default).
 */
import { isDefaultApiUrl } from "../config.js";
import {
	NOWLEDGE_MEM_CONTEXT_ENGINE_COMPAT_ALIAS,
	NOWLEDGE_MEM_CONTEXT_ENGINE_ID,
	isNowledgeMemContextEngineSlot,
} from "../context-engine-ids.js";

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
			const pluginId = "openclaw-nowledge-mem";

			// 0a. Plugin trust check — detect missing plugins.allow
			const pluginsAllow = runtimeInfo.pluginsAllow;
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

			// 0b. Effective tool policy. OpenClaw profiles are restrictive; the
			// plugin id expands to this plugin's declared tool contract.
			const toolsProfile = runtimeInfo.toolsProfile;
			const toolsAllow = Array.isArray(runtimeInfo.toolsAllow)
				? runtimeInfo.toolsAllow
				: null;
			const toolsAlsoAllow = Array.isArray(runtimeInfo.toolsAlsoAllow)
				? runtimeInfo.toolsAlsoAllow
				: null;
			const profileRestrictsPlugins =
				typeof toolsProfile === "string" && toolsProfile !== "full";
			const pluginExplicitlyAllowed =
				toolsAllow?.includes(pluginId) || toolsAlsoAllow?.includes(pluginId);
			const toolPolicyBlocksPlugin =
				(toolsAllow !== null && !toolsAllow.includes(pluginId)) ||
				(profileRestrictsPlugins && !pluginExplicitlyAllowed);
			details.toolsProfile = toolsProfile ?? "(not set)";
			details.pluginToolsAllowed = !toolPolicyBlocksPlugin;
			if (toolPolicyBlocksPlugin) {
				lines.push(
					`⚠ Tool policy does not expose the complete ${pluginId} tool contract.`,
				);
				if (toolsAllow !== null) {
					lines.push(
						`  Fix: preserve tools.allow and add "${pluginId}" to that list.`,
					);
				} else {
					lines.push(
						`  Fix: preserve tools.alsoAllow and add "${pluginId}" to that list.`,
					);
				}
				lines.push(
					"  Do not list individual nowledge_mem_* tools; use the plugin id so the manifest contract stays complete.",
				);
				lines.push("");
			} else if (toolsProfile) {
				lines.push(
					`Tool policy: ${toolsProfile} profile + ${pluginId} (complete contract allowed)`,
				);
			}

			// 0c. Memory slot check — show current mode and options
			const memorySlot = runtimeInfo.memorySlot;
			const contextEngineSlot = runtimeInfo.contextEngineSlot;
			const contextEngineRegistered =
				runtimeInfo.contextEngineRegistered === true;
			const contextEngineRegistrationError =
				typeof runtimeInfo.contextEngineRegistrationError === "string" &&
				runtimeInfo.contextEngineRegistrationError.trim()
					? runtimeInfo.contextEngineRegistrationError.trim()
					: null;
			const corpusSupplementConfigured = cfg.corpusSupplement === true;
			const corpusSupplementActive =
				runtimeInfo.corpusSupplementActive === true;
			const corpusSupplementRegistrationError =
				typeof runtimeInfo.corpusSupplementRegistrationError === "string" &&
				runtimeInfo.corpusSupplementRegistrationError.trim()
					? runtimeInfo.corpusSupplementRegistrationError.trim()
					: null;
			details.memorySlot = memorySlot ?? "(unknown)";
			details.corpusSupplementConfigured = corpusSupplementConfigured;
			details.corpusSupplementActive = corpusSupplementActive;
			if (corpusSupplementRegistrationError) {
				details.corpusSupplementRegistrationError =
					corpusSupplementRegistrationError;
			}
			const ceSlot =
				typeof contextEngineSlot === "string" && contextEngineSlot.trim()
					? contextEngineSlot.trim()
					: "legacy";
			details.contextEngineSlot = ceSlot;
			details.contextEngineRegistered = contextEngineRegistered;
			if (memorySlot && memorySlot !== "openclaw-nowledge-mem") {
				if (corpusSupplementConfigured && corpusSupplementActive) {
					lines.push(`Memory slot: "${memorySlot}" + corpus supplement active`);
					lines.push(
						"  Nowledge Mem feeds into memory-core's recall and dreaming pipeline. All tools available.",
					);
				} else if (corpusSupplementConfigured && !corpusSupplementActive) {
					lines.push(`ℹ Memory slot: "${memorySlot}"`);
					lines.push(
						"  corpusSupplement is configured, but host registration is unavailable in this runtime.",
					);
					if (cfg.sessionContext) {
						lines.push(
							"  Fallback active: Nowledge Mem still injects startup context and uses its own recall path.",
						);
					} else {
						lines.push(
							"  Fallback: Nowledge Mem tools remain available. Enable sessionContext for prompt-time startup context and recall.",
						);
					}
					if (corpusSupplementRegistrationError) {
						lines.push(
							`  Supplement registration detail: ${corpusSupplementRegistrationError}`,
						);
					}
				} else {
					lines.push(`ℹ Memory slot: "${memorySlot}"`);
					lines.push("  Two options:");
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

			// 0d. Capture routing — hooks vs context engine
			const ceActive =
				isNowledgeMemContextEngineSlot(ceSlot) && contextEngineRegistered;
			const hookCaptureAllowed = runtimeInfo.allowConversationAccess === true;
			details.allowConversationAccess = hookCaptureAllowed;
			const captureMode = !cfg.sessionDigest
				? "disabled"
				: ceActive
					? hookCaptureAllowed
						? "context-engine+hooks"
						: "context-engine"
					: hookCaptureAllowed
						? "hooks"
						: "blocked";
			details.captureMode = captureMode;
			if (ceActive) {
				if (ceSlot === NOWLEDGE_MEM_CONTEXT_ENGINE_COMPAT_ALIAS) {
					lines.push(
						`Context Engine slot: ${NOWLEDGE_MEM_CONTEXT_ENGINE_COMPAT_ALIAS} (active via compatibility alias)`,
					);
					lines.push(
						`  OpenClaw selected the plugin id for the context-engine slot. ${NOWLEDGE_MEM_CONTEXT_ENGINE_ID} remains the canonical manual setting.`,
					);
				} else {
					lines.push(
						`Context Engine slot: ${NOWLEDGE_MEM_CONTEXT_ENGINE_ID} (active)`,
					);
				}
				lines.push(
					hookCaptureAllowed
						? "  Thread capture runs through Context Engine afterTurn with hook fallback (agent_end, after_compaction, before_reset)."
						: "  Thread capture runs through Context Engine afterTurn; the agent_end fallback is blocked by OpenClaw policy.",
				);
			} else if (isNowledgeMemContextEngineSlot(ceSlot)) {
				if (ceSlot === NOWLEDGE_MEM_CONTEXT_ENGINE_COMPAT_ALIAS) {
					lines.push(
						`Context Engine slot: ${NOWLEDGE_MEM_CONTEXT_ENGINE_COMPAT_ALIAS} (compatibility alias, fallback to hooks)`,
					);
					lines.push(
						`  OpenClaw selected the plugin id for the context-engine slot. ${NOWLEDGE_MEM_CONTEXT_ENGINE_ID} remains the canonical manual setting.`,
					);
				} else {
					lines.push(
						`Context Engine slot: ${NOWLEDGE_MEM_CONTEXT_ENGINE_ID} (configured, fallback to hooks)`,
					);
				}
				lines.push(
					"  The slot points to Nowledge Mem, but Context Engine registration is not active in this runtime. Thread capture is using hooks only.",
				);
				if (contextEngineRegistrationError) {
					lines.push(
						`  CE registration detail: ${contextEngineRegistrationError}`,
					);
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
				if (!hookCaptureAllowed) {
					lines.push(
						"⚠ Hook fallback blocked: set plugins.entries.openclaw-nowledge-mem.hooks.allowConversationAccess=true.",
					);
					lines.push(
						"  OpenClaw requires this explicit grant before a non-bundled plugin can read agent_end conversation content.",
					);
				}
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

			// 3. Backend health. Memory tools and thread capture travel through
			// different surfaces: most reads/writes use the nmem CLI, while thread
			// auto-sync writes directly to the HTTP API so large transcripts do not
			// become argv-sized blobs. Report them separately; otherwise `nmem status`
			// can produce a false green for users whose conversation capture is broken.
			let cliHealthy = false;
			try {
				cliHealthy = await client.checkHealth();
			} catch {
				// checkHealth already returns false on error
			}
			details.cliBackendReachable = cliHealthy;

			lines.push(`CLI backend: ${cliHealthy ? "reachable" : "not reachable"}`);

			let httpHealthy = false;
			try {
				const health = await client.apiJson("GET", "/health", undefined, 5000);
				httpHealthy = true;
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
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				details.httpHealthError = message;
			}
			details.httpBackendReachable = httpHealthy;

			let threadApiHealthy = false;
			try {
				await client.apiJson("GET", "/threads/sources", undefined, 5000);
				threadApiHealthy = true;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				details.threadSyncHttpError = message;
			}
			details.threadSyncHttpReachable = threadApiHealthy;
			details.healthy = cliHealthy && threadApiHealthy;

			if (threadApiHealthy) {
				lines.push("Thread sync HTTP API: reachable");
			} else {
				lines.push("Thread sync HTTP API: not reachable");
				lines.push(
					"  Conversation capture writes to the Mem HTTP API. It will not sync while this is unreachable, even if memory tools still work through the CLI.",
				);
				if (details.threadSyncHttpError) {
					lines.push(`  Detail: ${details.threadSyncHttpError}`);
				}
			}

			if (cliHealthy && threadApiHealthy) {
				lines.push("Backend: reachable");
			} else if (cliHealthy || threadApiHealthy || httpHealthy) {
				lines.push("Backend: partially reachable");
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
			if (corpusSupplementConfigured) {
				const fallbackText = cfg.sessionContext
					? "configured but unavailable (fallback to plugin recall)"
					: "configured but unavailable (sessionContext disabled)";
				lines.push(
					`  corpusSupplement runtime: ${corpusSupplementActive ? "active" : fallbackText}`,
				);
			}

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
					active: corpusSupplementActive,
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
