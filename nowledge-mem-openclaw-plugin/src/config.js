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
	"recallMinScore",
	"maxThreadMessageChars",
	"captureExclude",
	"captureSkipMarker",
	"corpusSupplement",
	"corpusMaxResults",
	"corpusMinScore",
	"dreaming",
	"apiUrl",
	"apiKey",
	"space",
	"spaceTemplate",
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

// --- config files --------------------------------------------------------

const CONFIG_DIR = join(homedir(), ".nowledge-mem");

// Legacy dedicated config (deprecated — still honored for backward compat)
const CONFIG_PATH = join(CONFIG_DIR, "openclaw.json");

// Shared config read by all Nowledge Mem integrations (nmem CLI, Bub, Claude Code, etc.)
const SHARED_CONFIG_PATH = join(CONFIG_DIR, "config.json");

/**
 * Read ~/.nowledge-mem/openclaw.json if it exists.
 * Deprecated: new users should use the OpenClaw dashboard for plugin settings
 * and ~/.nowledge-mem/config.json for shared credentials (apiUrl, apiKey).
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

/**
 * Read apiUrl and apiKey from the shared ~/.nowledge-mem/config.json.
 * Only credentials are extracted — plugin-specific keys are ignored.
 * Returns { apiUrl?, apiKey? } or {} when the file is missing or unreadable.
 */
function readSharedConfig(logger) {
	try {
		if (!existsSync(SHARED_CONFIG_PATH)) {
			return {};
		}
		const content = readFileSync(SHARED_CONFIG_PATH, "utf-8").trim();
		if (!content) return {};
		const parsed = JSON.parse(content);
		const result = {};
		if (typeof parsed.apiUrl === "string" && parsed.apiUrl.trim()) {
			result.apiUrl = parsed.apiUrl.trim();
		}
		if (typeof parsed.apiKey === "string" && parsed.apiKey.trim()) {
			result.apiKey = parsed.apiKey.trim();
		}
		return result;
	} catch (err) {
		logger?.warn?.(
			`nowledge-mem: could not read ${SHARED_CONFIG_PATH}: ${err instanceof Error ? err.message : err}`,
		);
		return {};
	}
}

/** Exported for tests / CLI tooling. */
export { CONFIG_PATH, SHARED_CONFIG_PATH };

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

function pickStr(obj, key) {
	if (typeof obj[key] !== "string") return undefined;
	const trimmed = obj[key].trim();
	return trimmed || undefined;
}

function resolveEnvTemplate(value) {
	return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
		const envValue = process.env[envVar];
		if (typeof envValue !== "string" || !envValue.trim()) {
			throw new Error(
				`nowledge-mem: environment variable ${envVar} is required by spaceTemplate`,
			);
		}
		return envValue.trim();
	});
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
		const value = typeof opt.resolve === "function" ? opt.resolve() : opt.value;
		if (value !== undefined) return { ...opt, value };
	}
	return options[options.length - 1];
}

// -------------------------------------------------------------------------

/**
 * Parse plugin config with cascade:
 *
 *   Plugin-specific keys (sessionContext, sessionDigest, etc.):
 *     openclaw.json (legacy) > pluginConfig (dashboard) > env vars > defaults
 *
 *   Credentials (apiUrl, apiKey):
 *     openclaw.json (legacy) > pluginConfig (dashboard) > config.json (shared) > env vars > defaults
 *
 * Most users configure via the OpenClaw dashboard (pluginConfig) and
 * ~/.nowledge-mem/config.json for shared credentials across all tools.
 *
 * ~/.nowledge-mem/openclaw.json is still honored for backward compat
 * but is no longer the recommended path.
 *
 * Canonical keys: sessionContext, sessionDigest, digestMinInterval,
 *                 maxContextResults, recallMinScore, maxThreadMessageChars,
 *                 apiUrl, apiKey, space, spaceTemplate, dreaming
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
 *   NMEM_RECALL_MIN_SCORE      — integer (0-100)
 *   NMEM_MAX_THREAD_MESSAGE_CHARS — integer (200-20000)
 *   NMEM_CORPUS_SUPPLEMENT      — true/1/yes to register as MemoryCorpusSupplement
 *   NMEM_CORPUS_MAX_RESULTS    — integer (1-20)
 *   NMEM_CORPUS_MIN_SCORE      — integer (0-100)
 *   NMEM_API_URL               — remote server URL
 *   NMEM_API_KEY               — API key (never logged)
 *   NMEM_SPACE                 — ambient space name (legacy: NMEM_SPACE_ID)
 *
 * Host-owned pass-through key:
 *   dreaming                   — OpenClaw's native dreaming config object.
 *                                This plugin does not interpret it, but must
 *                                tolerate it when OpenClaw stores dreaming
 *                                settings on the selected memory-slot owner.
 */
export function parseConfig(raw, logger) {
	const pluginCfg = raw && typeof raw === "object" ? raw : {};
	const fileCfg = readConfigFile(logger);
	const sharedCfg = readSharedConfig(logger);

	// Resolve aliases in both sources
	const resolvedPlugin = resolveAliases(pluginCfg);
	const resolvedFile = resolveAliases(fileCfg);

	const validateKnownKeys = (obj, sourceLabel) => {
		const unknownKeys = Object.keys(obj).filter((k) => !ALLOWED_KEYS.has(k));
		if (unknownKeys.length > 0) {
			throw new Error(
				`nowledge-mem: unknown config key${unknownKeys.length > 1 ? "s" : ""} in ${sourceLabel}: ${unknownKeys.join(", ")}. ` +
					`Allowed keys: ${[...ALLOWED_KEYS].filter((k) => !Object.keys(ALIAS_KEYS).includes(k)).join(", ")}`,
			);
		}
	};

	// Strict: reject unknown keys in both legacy file config and dashboard config.
	validateKnownKeys(resolvedFile, "~/.nowledge-mem/openclaw.json");
	validateKnownKeys(resolvedPlugin, "plugin config");

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

	// --- recallMinScore: file > pluginConfig > env > default ---
	const rmsEnv = envInt("NMEM_RECALL_MIN_SCORE");
	const rms = firstDefined(
		{ value: pickNum(resolvedFile, "recallMinScore"), source: "file" },
		{
			value: pickNum(resolvedPlugin, "recallMinScore"),
			source: "pluginConfig",
		},
		{ value: rmsEnv, source: "env" },
		{ value: 0, source: "default" },
	);
	const recallMinScore = Math.min(100, Math.max(0, Math.trunc(rms.value)));
	_sources.recallMinScore = rms.source;

	// --- maxThreadMessageChars: file > pluginConfig > env > default ---
	const mtmcEnv = envInt("NMEM_MAX_THREAD_MESSAGE_CHARS");
	const mtmc = firstDefined(
		{ value: pickNum(resolvedFile, "maxThreadMessageChars"), source: "file" },
		{
			value: pickNum(resolvedPlugin, "maxThreadMessageChars"),
			source: "pluginConfig",
		},
		{ value: mtmcEnv, source: "env" },
		{ value: 800, source: "default" },
	);
	const maxThreadMessageChars = Math.min(
		20000,
		Math.max(200, Math.trunc(mtmc.value)),
	);
	_sources.maxThreadMessageChars = mtmc.source;

	// --- apiUrl: file (legacy) > pluginConfig > sharedConfig > env > "" ---
	const fileUrl =
		typeof resolvedFile.apiUrl === "string" && resolvedFile.apiUrl.trim();
	const pluginUrl =
		typeof resolvedPlugin.apiUrl === "string" && resolvedPlugin.apiUrl.trim();
	const au = firstDefined(
		{ value: fileUrl || undefined, source: "file" },
		{ value: pluginUrl || undefined, source: "pluginConfig" },
		{ value: sharedCfg.apiUrl || undefined, source: "sharedConfig" },
		{ value: envStr("NMEM_API_URL"), source: "env" },
		{ value: "", source: "default" },
	);
	const apiUrl = au.value;
	_sources.apiUrl = au.source;

	// --- apiKey: file (legacy) > pluginConfig > sharedConfig > env > "" ---
	const fileKey =
		typeof resolvedFile.apiKey === "string" && resolvedFile.apiKey.trim();
	const pluginKey =
		typeof resolvedPlugin.apiKey === "string" && resolvedPlugin.apiKey.trim();
	const ak = firstDefined(
		{ value: fileKey || undefined, source: "file" },
		{ value: pluginKey || undefined, source: "pluginConfig" },
		{ value: sharedCfg.apiKey || undefined, source: "sharedConfig" },
		{ value: envStr("NMEM_API_KEY"), source: "env" },
		{ value: "", source: "default" },
	);
	const apiKey = ak.value;
	_sources.apiKey = ak.source;

	// --- space: file (legacy) > pluginConfig > template > env > default ---
	// OpenClaw's schema stores the default as `space: ""`. Treat that as
	// "not set" so launch-time ambient space can still scope test runs and
	// scripted agent sessions. A non-empty configured space remains stronger.
	const fs = pickStr(resolvedFile, "space");
	const ps = pickStr(resolvedPlugin, "space");
	const fst = pickStr(resolvedFile, "spaceTemplate");
	const pst = pickStr(resolvedPlugin, "spaceTemplate");
	const spaceChoice = firstDefined(
		{ value: fs, source: "file" },
		{ value: ps, source: "pluginConfig" },
		{
			resolve: () => (fst ? resolveEnvTemplate(fst) : undefined),
			source: "file:template",
		},
		{
			resolve: () => (pst ? resolveEnvTemplate(pst) : undefined),
			source: "pluginConfig:template",
		},
		{
			value: envStr("NMEM_SPACE") ?? envStr("NMEM_SPACE_ID"),
			source: "env",
		},
		{ value: "", source: "default" },
	);
	const space = spaceChoice.value || "";
	_sources.space = spaceChoice.source;

	// --- corpusSupplement: file > pluginConfig > env > default ---
	const cs = firstDefined(
		{ value: pickBool(resolvedFile, "corpusSupplement"), source: "file" },
		{
			value: pickBool(resolvedPlugin, "corpusSupplement"),
			source: "pluginConfig",
		},
		{
			value: envBool("NMEM_CORPUS_SUPPLEMENT"),
			source: "env",
		},
		{ value: false, source: "default" },
	);
	const corpusSupplement = cs.value;
	_sources.corpusSupplement = cs.source;

	// --- corpusMaxResults: file > pluginConfig > env > default ---
	const cmr = firstDefined(
		{ value: pickNum(resolvedFile, "corpusMaxResults"), source: "file" },
		{
			value: pickNum(resolvedPlugin, "corpusMaxResults"),
			source: "pluginConfig",
		},
		{ value: envInt("NMEM_CORPUS_MAX_RESULTS"), source: "env" },
		{ value: 5, source: "default" },
	);
	const corpusMaxResults = Math.min(20, Math.max(1, Math.trunc(cmr.value)));
	_sources.corpusMaxResults = cmr.source;

	// --- corpusMinScore: file > pluginConfig > env > default ---
	const cmsEnv = envInt("NMEM_CORPUS_MIN_SCORE");
	const cms = firstDefined(
		{ value: pickNum(resolvedFile, "corpusMinScore"), source: "file" },
		{
			value: pickNum(resolvedPlugin, "corpusMinScore"),
			source: "pluginConfig",
		},
		{ value: cmsEnv, source: "env" },
		{ value: 0, source: "default" },
	);
	const corpusMinScore = Math.min(100, Math.max(0, Math.trunc(cms.value)));
	_sources.corpusMinScore = cms.source;

	// --- captureExclude: file > pluginConfig > default ---
	const captureExclude = (() => {
		const fromFile = Array.isArray(resolvedFile.captureExclude)
			? resolvedFile.captureExclude
			: null;
		const fromPlugin = Array.isArray(resolvedPlugin.captureExclude)
			? resolvedPlugin.captureExclude
			: null;
		_sources.captureExclude = fromFile
			? "file"
			: fromPlugin
				? "pluginConfig"
				: "default";
		const entries = fromFile ?? fromPlugin ?? [];
		return entries
			.filter((v) => typeof v === "string" && v.trim())
			.map((v) => v.trim());
	})();

	// --- captureSkipMarker: file > pluginConfig > default ---
	const captureSkipMarker = (() => {
		const fromFile =
			typeof resolvedFile.captureSkipMarker === "string"
				? resolvedFile.captureSkipMarker.trim()
				: undefined;
		const fromPlugin =
			typeof resolvedPlugin.captureSkipMarker === "string"
				? resolvedPlugin.captureSkipMarker.trim()
				: undefined;
		_sources.captureSkipMarker = fromFile
			? "file"
			: fromPlugin
				? "pluginConfig"
				: "default";
		return fromFile || fromPlugin || "#nmem-skip";
	})();

	return {
		sessionContext,
		sessionDigest,
		digestMinInterval,
		maxContextResults,
		recallMinScore,
		maxThreadMessageChars,
		captureExclude,
		captureSkipMarker,
		corpusSupplement,
		corpusMaxResults,
		corpusMinScore,
		apiUrl,
		apiKey,
		space,
		_sources,
	};
}
