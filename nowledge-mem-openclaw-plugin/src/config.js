export const API_DEFAULT_URL = "http://127.0.0.1:14242";

/**
 * Check whether an API URL points to the local default server.
 * Useful for mode detection (local vs remote) in UI, CORS, diagnostics.
 */
export function isDefaultApiUrl(url) {
	const trimmed = (url || "").trim().replace(/\/+$/, "");
	return !trimmed || trimmed === API_DEFAULT_URL;
}

const ALLOWED_KEYS = new Set([
	"autoRecall",
	"autoCapture",
	"captureMinInterval",
	"maxRecallResults",
	"apiUrl",
	"apiKey",
]);

// --- env var helpers ---------------------------------------------------

function envStr(name) {
	const v = process.env[name];
	return typeof v === "string" ? v.trim() : undefined;
}

function envBool(name) {
	const v = envStr(name);
	if (v === undefined) return undefined;
	return v === "true" || v === "1" || v === "yes";
}

function envInt(name) {
	const v = envStr(name);
	if (v === undefined) return undefined;
	const n = Number.parseInt(v, 10);
	return Number.isFinite(n) ? n : undefined;
}

// -----------------------------------------------------------------------

/**
 * Parse plugin config with cascade: pluginConfig > env vars > defaults.
 *
 * Environment variables (all optional):
 *   NMEM_AUTO_RECALL      — true/1/yes to enable
 *   NMEM_AUTO_CAPTURE     — true/1/yes to enable
 *   NMEM_CAPTURE_MIN_INTERVAL — seconds (0–86400)
 *   NMEM_MAX_RECALL_RESULTS   — integer (1–20)
 *   NMEM_API_URL          — remote server URL
 *   NMEM_API_KEY          — API key (never logged)
 *
 * This makes the plugin configurable even when OpenClaw strips
 * plugin config entries from openclaw.json (>= 2026.2.25).
 */
export function parseConfig(raw) {
	const obj = raw && typeof raw === "object" ? raw : {};

	// Strict: reject unknown keys so users catch typos immediately.
	// If OpenClaw adds new platform-level keys that should pass through,
	// add them to ALLOWED_KEYS rather than silently accepting anything.
	const unknownKeys = Object.keys(obj).filter((k) => !ALLOWED_KEYS.has(k));
	if (unknownKeys.length > 0) {
		throw new Error(
			`nowledge-mem: unknown config key${unknownKeys.length > 1 ? "s" : ""}: ${unknownKeys.join(", ")}. ` +
				`Allowed keys: ${[...ALLOWED_KEYS].join(", ")}`,
		);
	}

	// apiUrl: pluginConfig > env var > local default
	const apiUrl =
		(typeof obj.apiUrl === "string" && obj.apiUrl.trim()) ||
		envStr("NMEM_API_URL") ||
		"";

	// apiKey: pluginConfig > env var — never logged, never in CLI args
	const apiKey =
		(typeof obj.apiKey === "string" && obj.apiKey.trim()) ||
		envStr("NMEM_API_KEY") ||
		"";

	// autoRecall: pluginConfig > env var > false
	const autoRecall =
		typeof obj.autoRecall === "boolean"
			? obj.autoRecall
			: (envBool("NMEM_AUTO_RECALL") ?? false);

	// autoCapture: pluginConfig > env var > false
	const autoCapture =
		typeof obj.autoCapture === "boolean"
			? obj.autoCapture
			: (envBool("NMEM_AUTO_CAPTURE") ?? false);

	// captureMinInterval: pluginConfig > env var > 300
	const rawInterval =
		typeof obj.captureMinInterval === "number" &&
		Number.isFinite(obj.captureMinInterval)
			? obj.captureMinInterval
			: envInt("NMEM_CAPTURE_MIN_INTERVAL");
	const captureMinInterval =
		rawInterval !== undefined
			? Math.min(86400, Math.max(0, Math.trunc(rawInterval)))
			: 300;

	// maxRecallResults: pluginConfig > env var > 5
	const rawMax =
		typeof obj.maxRecallResults === "number" &&
		Number.isFinite(obj.maxRecallResults)
			? obj.maxRecallResults
			: envInt("NMEM_MAX_RECALL_RESULTS");
	const maxRecallResults =
		rawMax !== undefined
			? Math.min(20, Math.max(1, Math.trunc(rawMax)))
			: 5;

	return {
		autoRecall,
		autoCapture,
		captureMinInterval,
		maxRecallResults,
		apiUrl,
		apiKey,
	};
}
