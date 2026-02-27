import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const API_DEFAULT_URL = "http://127.0.0.1:14242";

/**
 * Check whether an API URL points to the local default server.
 * Useful for mode detection (local vs remote) in UI, CORS, diagnostics.
 */
export function isDefaultApiUrl(url) {
	const trimmed = (url || "").trim().replace(/\/+$/, "");
	return !trimmed || trimmed === API_DEFAULT_URL;
}

// Canonical names (user-facing).
// Legacy aliases (autoRecall, autoCapture) accepted silently for backward compat.
const ALLOWED_KEYS = new Set([
	"sessionContext",
	"sessionDigest",
	"captureMinInterval",
	"maxRecallResults",
	"apiUrl",
	"apiKey",
	// Legacy aliases — accepted but not advertised
	"autoRecall",
	"autoCapture",
]);

// --- config file ---------------------------------------------------------

const CONFIG_DIR = join(homedir(), ".nowledge-mem");
const CONFIG_PATH = join(CONFIG_DIR, "openclaw.json");

const DEFAULT_CONFIG = {
	sessionContext: false,
	sessionDigest: false,
	captureMinInterval: 300,
	maxRecallResults: 5,
	apiUrl: "",
	apiKey: "",
};

/**
 * Read ~/.nowledge-mem/openclaw.json.
 * Creates the file with defaults on first run.
 * Returns {} on any error — never crashes.
 */
function readConfigFile(logger) {
	try {
		if (!existsSync(CONFIG_PATH)) {
			mkdirSync(CONFIG_DIR, { recursive: true });
			writeFileSync(
				CONFIG_PATH,
				JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n",
				"utf-8",
			);
			logger?.info?.(
				`nowledge-mem: created config at ${CONFIG_PATH} — edit to customize`,
			);
			return { ...DEFAULT_CONFIG };
		}
		const content = readFileSync(CONFIG_PATH, "utf-8").trim();
		if (!content) return {};
		return JSON.parse(content);
	} catch (err) {
		logger?.warn?.(
			`nowledge-mem: could not read ${CONFIG_PATH}: ${err instanceof Error ? err.message : err}`,
		);
		return {};
	}
}

/** Exported for tests / CLI tooling. */
export { CONFIG_PATH };

// --- env var helpers -----------------------------------------------------

function envStr(name) {
	const v = process.env[name];
	return typeof v === "string" ? v.trim() : undefined;
}

function envBool(name, fallbackName) {
	const v = envStr(name) ?? envStr(fallbackName);
	if (v === undefined) return undefined;
	return v === "true" || v === "1" || v === "yes";
}

function envInt(name) {
	const v = envStr(name);
	if (v === undefined) return undefined;
	const n = Number.parseInt(v, 10);
	return Number.isFinite(n) ? n : undefined;
}

// --- helpers to read a boolean/number from merged sources ----------------

/** Read a boolean: new name wins over legacy alias. */
function pickBool(obj, key, legacyKey) {
	if (typeof obj[key] === "boolean") return obj[key];
	if (legacyKey && typeof obj[legacyKey] === "boolean") return obj[legacyKey];
	return undefined;
}

function pickNum(obj, key) {
	if (typeof obj[key] === "number" && Number.isFinite(obj[key])) return obj[key];
	return undefined;
}

// -------------------------------------------------------------------------

/**
 * Parse plugin config with cascade:
 *   pluginConfig > ~/.nowledge-mem/openclaw.json > env vars > defaults
 *
 * Canonical keys: sessionContext, sessionDigest, captureMinInterval,
 *                 maxRecallResults, apiUrl, apiKey
 *
 * Legacy aliases: autoRecall → sessionContext, autoCapture → sessionDigest
 * (accepted from all sources; never shown in docs)
 *
 * Environment variables (all optional):
 *   NMEM_SESSION_CONTEXT       — true/1/yes to enable (alias: NMEM_AUTO_RECALL)
 *   NMEM_SESSION_DIGEST        — true/1/yes to enable (alias: NMEM_AUTO_CAPTURE)
 *   NMEM_CAPTURE_MIN_INTERVAL  — seconds (0–86400)
 *   NMEM_MAX_RECALL_RESULTS    — integer (1–20)
 *   NMEM_API_URL               — remote server URL
 *   NMEM_API_KEY               — API key (never logged)
 */
export function parseConfig(raw, logger) {
	const pluginCfg = raw && typeof raw === "object" ? raw : {};
	const fileCfg = readConfigFile(logger);

	// Strict: reject unknown keys in pluginConfig (typo catcher).
	// File config is our own — validated by shape, no strict check needed.
	const unknownKeys = Object.keys(pluginCfg).filter(
		(k) => !ALLOWED_KEYS.has(k),
	);
	if (unknownKeys.length > 0) {
		throw new Error(
			`nowledge-mem: unknown config key${unknownKeys.length > 1 ? "s" : ""}: ${unknownKeys.join(", ")}. ` +
				`Allowed keys: ${[...ALLOWED_KEYS].filter((k) => k !== "autoRecall" && k !== "autoCapture").join(", ")}`,
		);
	}

	// --- sessionContext (legacy: autoRecall) ---
	const sessionContext =
		pickBool(pluginCfg, "sessionContext", "autoRecall") ??
		pickBool(fileCfg, "sessionContext", "autoRecall") ??
		envBool("NMEM_SESSION_CONTEXT", "NMEM_AUTO_RECALL") ??
		false;

	// --- sessionDigest (legacy: autoCapture) ---
	const sessionDigest =
		pickBool(pluginCfg, "sessionDigest", "autoCapture") ??
		pickBool(fileCfg, "sessionDigest", "autoCapture") ??
		envBool("NMEM_SESSION_DIGEST", "NMEM_AUTO_CAPTURE") ??
		false;

	// --- captureMinInterval ---
	const rawInterval =
		pickNum(pluginCfg, "captureMinInterval") ??
		pickNum(fileCfg, "captureMinInterval") ??
		envInt("NMEM_CAPTURE_MIN_INTERVAL");
	const captureMinInterval =
		rawInterval !== undefined
			? Math.min(86400, Math.max(0, Math.trunc(rawInterval)))
			: 300;

	// --- maxRecallResults ---
	const rawMax =
		pickNum(pluginCfg, "maxRecallResults") ??
		pickNum(fileCfg, "maxRecallResults") ??
		envInt("NMEM_MAX_RECALL_RESULTS");
	const maxRecallResults =
		rawMax !== undefined
			? Math.min(20, Math.max(1, Math.trunc(rawMax)))
			: 5;

	// --- apiUrl: pluginConfig > file > env > "" ---
	const apiUrl =
		(typeof pluginCfg.apiUrl === "string" && pluginCfg.apiUrl.trim()) ||
		(typeof fileCfg.apiUrl === "string" && fileCfg.apiUrl.trim()) ||
		envStr("NMEM_API_URL") ||
		"";

	// --- apiKey: pluginConfig > file > env > "" ---
	const apiKey =
		(typeof pluginCfg.apiKey === "string" && pluginCfg.apiKey.trim()) ||
		(typeof fileCfg.apiKey === "string" && fileCfg.apiKey.trim()) ||
		envStr("NMEM_API_KEY") ||
		"";

	return {
		// Canonical names used internally throughout the plugin.
		// Hooks/capture code reads these — keep the field names stable.
		autoRecall: sessionContext,
		autoCapture: sessionDigest,
		captureMinInterval,
		maxRecallResults,
		apiUrl,
		apiKey,
	};
}
