const LOCAL_API_URL = "http://127.0.0.1:14242";

/**
 * Build the child env for nmem CLI execution.
 * apiKey stays in env only and is never passed as a CLI flag.
 * Clear inherited API endpoint/auth values first so the resolved plugin config wins.
 * Keep the ambient space lane unless an explicit override is provided. Prefer
 * NMEM_SPACE for the human-facing contract, while preserving legacy
 * NMEM_SPACE_ID for older setups. An explicit empty override means "stay on
 * Default", so inherited ambient space vars must be cleared too.
 */
export function buildNmemSpawnEnv(
	{ apiUrl, apiKey, spaceId, hasExplicitSpace = false } = {},
) {
	const env = { ...process.env };
	delete env.NMEM_API_URL;
	delete env.NMEM_API_KEY;
	if (hasExplicitSpace) {
		delete env.NMEM_SPACE;
		delete env.NMEM_SPACE_ID;
	}
	if (apiUrl && apiUrl !== LOCAL_API_URL) {
		env.NMEM_API_URL = apiUrl;
	}
	if (apiKey) {
		env.NMEM_API_KEY = apiKey;
	}
	if (hasExplicitSpace && typeof spaceId === "string" && spaceId.length > 0) {
		env.NMEM_SPACE = spaceId;
		env.NMEM_SPACE_ID = spaceId;
	}
	return env;
}
