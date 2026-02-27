/**
 * nowledge_mem_status - verify config, connectivity, and backend health.
 *
 * Lets the user (or agent) confirm that apiUrl, apiKey, and other
 * settings are taking effect, and that the backend is reachable.
 */
import { isDefaultApiUrl } from "../config.js";

export function createStatusTool(client, _logger, cfg) {
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

			// 1. Mode + connection target
			const remote = !isDefaultApiUrl(cfg.apiUrl);
			const mode = remote ? "remote" : "local";
			details.mode = mode;
			details.apiUrl = cfg.apiUrl || "http://127.0.0.1:14242";
			details.apiKeySet = Boolean(cfg.apiKey);

			lines.push(`Mode: ${remote ? `Remote (${cfg.apiUrl})` : "Local (127.0.0.1:14242)"}`);
			lines.push(`API key: ${cfg.apiKey ? "set" : "not set"}`);

			// 2. CLI resolution
			try {
				const cmd = client.resolveCommand();
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
					const health = await client.apiJson("GET", "/health", undefined, 5000);
					if (health.version) {
						details.version = health.version;
						lines.push(`Version: ${health.version}`);
					}
					if (health.database_connected !== undefined) {
						details.databaseConnected = health.database_connected;
						lines.push(`Database: ${health.database_connected ? "connected" : "disconnected"}`);
					}
				} catch {
					// Health endpoint not available on older backends
				}
			} else {
				lines.push("Backend: not reachable");
				if (remote) {
					lines.push("  Check that apiUrl is correct and the server is running.");
					if (!cfg.apiKey) {
						lines.push("  Remote mode usually requires an API key.");
					}
				} else {
					lines.push("  Ensure the Nowledge Mem desktop app is running.");
				}
			}

			// 4. Effective config
			lines.push("");
			lines.push("Config:");
			lines.push(`  sessionContext: ${cfg.sessionContext}`);
			lines.push(`  sessionDigest: ${cfg.sessionDigest}`);
			lines.push(`  digestMinInterval: ${cfg.digestMinInterval}s`);
			lines.push(`  maxContextResults: ${cfg.maxContextResults}`);

			details.sessionContext = cfg.sessionContext;
			details.sessionDigest = cfg.sessionDigest;
			details.digestMinInterval = cfg.digestMinInterval;
			details.maxContextResults = cfg.maxContextResults;

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details,
			};
		},
	};
}
