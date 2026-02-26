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
]);

// Backward-compatible aliases (old names → new names).
// Accepted silently so existing users' configs keep working.
const ALIAS_KEYS = {
	autoRecall: "sessionContext",
	autoCapture: "sessionDigest",
	captureMinInterval: "digestMinInterval",
	maxRecallResults: "maxContextResults",
};

export function parseConfig(raw) {
	const obj = raw && typeof raw === "object" ? raw : {};

	// Resolve aliases: copy old-name values to new-name slots
	// (new name takes precedence if both are present).
	const resolved = { ...obj };
	for (const [oldKey, newKey] of Object.entries(ALIAS_KEYS)) {
		if (oldKey in resolved) {
			if (!(newKey in resolved)) {
				resolved[newKey] = resolved[oldKey];
			}
			delete resolved[oldKey];
		}
	}

	// Strict: reject unknown keys so users catch typos immediately.
	const unknownKeys = Object.keys(resolved).filter(
		(k) => !ALLOWED_KEYS.has(k),
	);
	if (unknownKeys.length > 0) {
		throw new Error(
			`nowledge-mem: unknown config key${unknownKeys.length > 1 ? "s" : ""}: ${unknownKeys.join(", ")}. ` +
				`Allowed keys: ${[...ALLOWED_KEYS].join(", ")}`,
		);
	}

	// apiUrl: config wins, then env var, then local default
	const apiUrl =
		(typeof resolved.apiUrl === "string" && resolved.apiUrl.trim()) ||
		(typeof process.env.NMEM_API_URL === "string" &&
			process.env.NMEM_API_URL.trim()) ||
		"";

	// apiKey: config wins, then env var — never logged, never in CLI args
	const apiKey =
		(typeof resolved.apiKey === "string" && resolved.apiKey.trim()) ||
		(typeof process.env.NMEM_API_KEY === "string" &&
			process.env.NMEM_API_KEY.trim()) ||
		"";

	return {
		sessionContext:
			typeof resolved.sessionContext === "boolean"
				? resolved.sessionContext
				: false,
		sessionDigest:
			typeof resolved.sessionDigest === "boolean"
				? resolved.sessionDigest
				: false,
		digestMinInterval:
			typeof resolved.digestMinInterval === "number" &&
			Number.isFinite(resolved.digestMinInterval)
				? Math.min(
						86400,
						Math.max(0, Math.trunc(resolved.digestMinInterval)),
					)
				: 300,
		maxContextResults:
			typeof resolved.maxContextResults === "number" &&
			Number.isFinite(resolved.maxContextResults)
				? Math.min(20, Math.max(1, Math.trunc(resolved.maxContextResults)))
				: 5,
		apiUrl,
		apiKey,
	};
}
