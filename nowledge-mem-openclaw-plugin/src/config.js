const ALLOWED_KEYS = new Set([
	"autoRecall",
	"autoCapture",
	"maxRecallResults",
	"apiUrl",
	"apiKey",
]);

export function parseConfig(raw) {
	const obj = raw && typeof raw === "object" ? raw : {};

	for (const key of Object.keys(obj)) {
		if (!ALLOWED_KEYS.has(key)) {
			throw new Error(`Unknown config key: "${key}"`);
		}
	}

	// apiUrl: config wins, then env var, then local default
	const apiUrl =
		(typeof obj.apiUrl === "string" && obj.apiUrl.trim()) ||
		(typeof process.env.NMEM_API_URL === "string" &&
			process.env.NMEM_API_URL.trim()) ||
		"";

	// apiKey: config wins, then env var — never logged, never in CLI args
	const apiKey =
		(typeof obj.apiKey === "string" && obj.apiKey.trim()) ||
		(typeof process.env.NMEM_API_KEY === "string" &&
			process.env.NMEM_API_KEY.trim()) ||
		"";

	return {
		autoRecall: typeof obj.autoRecall === "boolean" ? obj.autoRecall : true,
		autoCapture: typeof obj.autoCapture === "boolean" ? obj.autoCapture : false,
		maxRecallResults:
			typeof obj.maxRecallResults === "number" &&
			Number.isFinite(obj.maxRecallResults)
				? Math.min(20, Math.max(1, Math.trunc(obj.maxRecallResults)))
				: 5,
		apiUrl,
		apiKey,
	};
}
