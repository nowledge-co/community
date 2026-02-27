import { existsSync, readFileSync } from "node:fs";
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

/**
 * Read ~/.nowledge-mem/openclaw.json if it exists.
 * Returns {} when the file is missing or unreadable.
 */
function readConfigFile(logger) {
	try {
		if (!existsSync(CONFIG_PATH)) {
			return {};
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
	if (typeof obj[key] === "number" && Number.isFinite(obj[key]))
		return obj[key];
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

/**
 * Return the first option whose value is not undefined.
 * Each option is { value, source } where source is a label like
 * "file", "pluginConfig", "env", or "default".
 */
function firstDefined(...options) {
	for (const opt of options) {
		if (opt.value !== undefined) return opt;
	}
	return options[options.length - 1];
}

// -------------------------------------------------------------------------

/**
 * Parse plugin config with cascade:
 *   ~/.nowledge-mem/openclaw.json > pluginConfig > env vars > defaults
 *
 * The config file (if it exists) takes highest priority so users who
 * create it get predictable behavior. Most users won't have one and
 * will configure via OpenClaw's plugin settings UI (pluginConfig).
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
 *   NMEM_DIGEST_MIN_INTERVAL   — seconds (0-86400)
 *   NMEM_MAX_CONTEXT_RESULTS   — integer (1-20)
 *   NMEM_API_URL               — remote server URL
 *   NMEM_API_KEY               — API key (never logged)
 */
export function parseConfig(raw, logger) {
	const pluginCfg = raw && typeof raw === "object" ? raw : {};
	const fileCfg = readConfigFile(logger);

	// Resolve aliases in both sources
	const resolvedPlugin = resolveAliases(pluginCfg);
	const resolvedFile = resolveAliases(fileCfg);

	// Strict: reject unknown keys in pluginConfig (typo catcher).
	const unknownKeys = Object.keys(resolvedPlugin).filter(
		(k) => !ALLOWED_KEYS.has(k),
	);
	if (unknownKeys.length > 0) {
		throw new Error(
			`nowledge-mem: unknown config key${unknownKeys.length > 1 ? "s" : ""}: ${unknownKeys.join(", ")}. ` +
				`Allowed keys: ${[...ALLOWED_KEYS].filter((k) => !Object.keys(ALIAS_KEYS).includes(k)).join(", ")}`,
		);
	}

	const _sources = {};

	// --- sessionContext: file > pluginConfig > env > default ---
	const sc = firstDefined(
		{ value: pickBool(resolvedFile, "sessionContext"), source: "file" },
		{
			value: pickBool(resolvedPlugin, "sessionContext"),
			source: "pluginConfig",
		},
		{
			value: envBool("NMEM_SESSION_CONTEXT", "NMEM_AUTO_RECALL"),
			source: "env",
		},
		{ value: false, source: "default" },
	);
	const sessionContext = sc.value;
	_sources.sessionContext = sc.source;

	// --- sessionDigest: file > pluginConfig > env > default ---
	const sd = firstDefined(
		{ value: pickBool(resolvedFile, "sessionDigest"), source: "file" },
		{
			value: pickBool(resolvedPlugin, "sessionDigest"),
			source: "pluginConfig",
		},
		{
			value: envBool("NMEM_SESSION_DIGEST", "NMEM_AUTO_CAPTURE"),
			source: "env",
		},
		{ value: true, source: "default" },
	);
	const sessionDigest = sd.value;
	_sources.sessionDigest = sd.source;

	// --- digestMinInterval: file > pluginConfig > env > default ---
	const dmiEnv =
		envInt("NMEM_DIGEST_MIN_INTERVAL") ?? envInt("NMEM_CAPTURE_MIN_INTERVAL");
	const dmi = firstDefined(
		{ value: pickNum(resolvedFile, "digestMinInterval"), source: "file" },
		{
			value: pickNum(resolvedPlugin, "digestMinInterval"),
			source: "pluginConfig",
		},
		{ value: dmiEnv, source: "env" },
		{ value: 300, source: "default" },
	);
	const digestMinInterval = Math.min(86400, Math.max(0, Math.trunc(dmi.value)));
	_sources.digestMinInterval = dmi.source;

	// --- maxContextResults: file > pluginConfig > env > default ---
	const mcrEnv =
		envInt("NMEM_MAX_CONTEXT_RESULTS") ?? envInt("NMEM_MAX_RECALL_RESULTS");
	const mcr = firstDefined(
		{ value: pickNum(resolvedFile, "maxContextResults"), source: "file" },
		{
			value: pickNum(resolvedPlugin, "maxContextResults"),
			source: "pluginConfig",
		},
		{ value: mcrEnv, source: "env" },
		{ value: 5, source: "default" },
	);
	const maxContextResults = Math.min(20, Math.max(1, Math.trunc(mcr.value)));
	_sources.maxContextResults = mcr.source;

	// --- apiUrl: file > pluginConfig > env > "" ---
	const fileUrl =
		typeof resolvedFile.apiUrl === "string" && resolvedFile.apiUrl.trim();
	const pluginUrl =
		typeof resolvedPlugin.apiUrl === "string" && resolvedPlugin.apiUrl.trim();
	const au = firstDefined(
		{ value: fileUrl || undefined, source: "file" },
		{ value: pluginUrl || undefined, source: "pluginConfig" },
		{ value: envStr("NMEM_API_URL"), source: "env" },
		{ value: "", source: "default" },
	);
	const apiUrl = au.value;
	_sources.apiUrl = au.source;

	// --- apiKey: file > pluginConfig > env > "" ---
	const fileKey =
		typeof resolvedFile.apiKey === "string" && resolvedFile.apiKey.trim();
	const pluginKey =
		typeof resolvedPlugin.apiKey === "string" && resolvedPlugin.apiKey.trim();
	const ak = firstDefined(
		{ value: fileKey || undefined, source: "file" },
		{ value: pluginKey || undefined, source: "pluginConfig" },
		{ value: envStr("NMEM_API_KEY"), source: "env" },
		{ value: "", source: "default" },
	);
	const apiKey = ak.value;
	_sources.apiKey = ak.source;

	return {
		sessionContext,
		sessionDigest,
		digestMinInterval,
		maxContextResults,
		apiUrl,
		apiKey,
		_sources,
	};
}
