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

// Canonical config keys (new names).
const ALLOWED_KEYS = new Set([
	"sessionContext",
	"sessionDigest",
	"digestMinInterval",
	"maxContextResults",
	"apiUrl",
	"apiKey",
	// Legacy aliases — accepted but not advertised
	"autoRecall",
	"autoCapture",
	"captureMinInterval",
	"maxRecallResults",
]);

// Backward-compatible aliases (old names → new names).
// Accepted silently so existing users' configs keep working.
const ALIAS_KEYS = {
	autoRecall: "sessionContext",
	autoCapture: "sessionDigest",
	captureMinInterval: "digestMinInterval",
	maxRecallResults: "maxContextResults",
};

// --- config file ---------------------------------------------------------

const CONFIG_DIR = join(homedir(), ".nowledge-mem");
const CONFIG_PATH = join(CONFIG_DIR, "openclaw.json");

const DEFAULT_CONFIG = {
	sessionContext: false,
	sessionDigest: true,
	digestMinInterval: 300,
	maxContextResults: 5,
	apiUrl: "",
	apiKey: "",
};

/**
 * Read ~/.nowledge-mem/openclaw.json.
 * On first run, creates the file seeded with values from pluginConfig
 * (if any) — this migrates settings before OpenClaw strips them.
 * Returns {} on any error — never crashes.
 */
function readConfigFile(logger, pluginCfg) {
	try {
		if (!existsSync(CONFIG_PATH)) {
			// Seed from pluginConfig + env vars for migration.
			// Users on older OpenClaw get their values written to the file
			// BEFORE a future OpenClaw update can strip them.
			const initial = { ...DEFAULT_CONFIG };
			if (pluginCfg && typeof pluginCfg === "object") {
				// Resolve aliases in pluginConfig for seeding
				const resolved = { ...pluginCfg };
				for (const [oldKey, newKey] of Object.entries(ALIAS_KEYS)) {
					if (oldKey in resolved) {
						if (!(newKey in resolved)) {
							resolved[newKey] = resolved[oldKey];
						}
						delete resolved[oldKey];
					}
				}

				if (typeof resolved.sessionContext === "boolean")
					initial.sessionContext = resolved.sessionContext;
				if (typeof resolved.sessionDigest === "boolean")
					initial.sessionDigest = resolved.sessionDigest;
				if (
					typeof resolved.digestMinInterval === "number" &&
					Number.isFinite(resolved.digestMinInterval)
				)
					initial.digestMinInterval = resolved.digestMinInterval;
				if (
					typeof resolved.maxContextResults === "number" &&
					Number.isFinite(resolved.maxContextResults)
				)
					initial.maxContextResults = resolved.maxContextResults;
				if (typeof resolved.apiUrl === "string" && resolved.apiUrl.trim())
					initial.apiUrl = resolved.apiUrl.trim();
				// apiKey intentionally NOT written to disk — keep in env/pluginConfig only
			}

			mkdirSync(CONFIG_DIR, { recursive: true });
			writeFileSync(
				CONFIG_PATH,
				JSON.stringify(initial, null, 2) + "\n",
				"utf-8",
			);
			logger?.info?.(
				`nowledge-mem: created config at ${CONFIG_PATH} — edit to customize`,
			);
			return { ...initial };
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

// --- helpers to read a boolean/number from resolved sources --------------

function pickBool(obj, key) {
	if (typeof obj[key] === "boolean") return obj[key];
	return undefined;
}

function pickNum(obj, key) {
	if (typeof obj[key] === "number" && Number.isFinite(obj[key])) return obj[key];
	return undefined;
}

/** Resolve legacy aliases in an object: old names → new names. */
function resolveAliases(obj) {
	const resolved = { ...obj };
	for (const [oldKey, newKey] of Object.entries(ALIAS_KEYS)) {
		if (oldKey in resolved) {
			if (!(newKey in resolved)) {
				resolved[newKey] = resolved[oldKey];
			}
			delete resolved[oldKey];
		}
	}
	return resolved;
}

// -------------------------------------------------------------------------

/**
 * Parse plugin config with cascade:
 *   pluginConfig > ~/.nowledge-mem/openclaw.json > env vars > defaults
 *
 * Canonical keys: sessionContext, sessionDigest, digestMinInterval,
 *                 maxContextResults, apiUrl, apiKey
 *
 * Legacy aliases (accepted from all sources; never shown in docs):
 *   autoRecall → sessionContext
 *   autoCapture → sessionDigest
 *   captureMinInterval → digestMinInterval
 *   maxRecallResults → maxContextResults
 *
 * Environment variables (all optional):
 *   NMEM_SESSION_CONTEXT       — true/1/yes to enable (alias: NMEM_AUTO_RECALL)
 *   NMEM_SESSION_DIGEST        — true/1/yes to enable (alias: NMEM_AUTO_CAPTURE)
 *   NMEM_DIGEST_MIN_INTERVAL   — seconds (0–86400)
 *   NMEM_MAX_CONTEXT_RESULTS   — integer (1–20)
 *   NMEM_API_URL               — remote server URL
 *   NMEM_API_KEY               — API key (never logged)
 */
export function parseConfig(raw, logger) {
	const pluginCfg = raw && typeof raw === "object" ? raw : {};
	const fileCfg = readConfigFile(logger, pluginCfg);

	// Resolve aliases in both sources
	const resolvedPlugin = resolveAliases(pluginCfg);
	const resolvedFile = resolveAliases(fileCfg);

	// Strict: reject unknown keys in pluginConfig (typo catcher).
	// File config is our own — validated by shape, no strict check needed.
	const unknownKeys = Object.keys(resolvedPlugin).filter(
		(k) => !ALLOWED_KEYS.has(k),
	);
	if (unknownKeys.length > 0) {
		throw new Error(
			`nowledge-mem: unknown config key${unknownKeys.length > 1 ? "s" : ""}: ${unknownKeys.join(", ")}. ` +
				`Allowed keys: ${[...ALLOWED_KEYS].filter((k) => !Object.keys(ALIAS_KEYS).includes(k)).join(", ")}`,
		);
	}

	// --- sessionContext ---
	const sessionContext =
		pickBool(resolvedPlugin, "sessionContext") ??
		pickBool(resolvedFile, "sessionContext") ??
		envBool("NMEM_SESSION_CONTEXT", "NMEM_AUTO_RECALL") ??
		false;

	// --- sessionDigest ---
	const sessionDigest =
		pickBool(resolvedPlugin, "sessionDigest") ??
		pickBool(resolvedFile, "sessionDigest") ??
		envBool("NMEM_SESSION_DIGEST", "NMEM_AUTO_CAPTURE") ??
		true;

	// --- digestMinInterval ---
	const rawInterval =
		pickNum(resolvedPlugin, "digestMinInterval") ??
		pickNum(resolvedFile, "digestMinInterval") ??
		envInt("NMEM_DIGEST_MIN_INTERVAL") ??
		envInt("NMEM_CAPTURE_MIN_INTERVAL");
	const digestMinInterval =
		rawInterval !== undefined
			? Math.min(86400, Math.max(0, Math.trunc(rawInterval)))
			: 300;

	// --- maxContextResults ---
	const rawMax =
		pickNum(resolvedPlugin, "maxContextResults") ??
		pickNum(resolvedFile, "maxContextResults") ??
		envInt("NMEM_MAX_CONTEXT_RESULTS") ??
		envInt("NMEM_MAX_RECALL_RESULTS");
	const maxContextResults =
		rawMax !== undefined
			? Math.min(20, Math.max(1, Math.trunc(rawMax)))
			: 5;

	// --- apiUrl: pluginConfig > file > env > "" ---
	const apiUrl =
		(typeof resolvedPlugin.apiUrl === "string" && resolvedPlugin.apiUrl.trim()) ||
		(typeof resolvedFile.apiUrl === "string" && resolvedFile.apiUrl.trim()) ||
		envStr("NMEM_API_URL") ||
		"";

	// --- apiKey: pluginConfig > file > env > "" ---
	const apiKey =
		(typeof resolvedPlugin.apiKey === "string" && resolvedPlugin.apiKey.trim()) ||
		(typeof resolvedFile.apiKey === "string" && resolvedFile.apiKey.trim()) ||
		envStr("NMEM_API_KEY") ||
		"";

	return {
		sessionContext,
		sessionDigest,
		digestMinInterval,
		maxContextResults,
		apiUrl,
		apiKey,
	};
}
