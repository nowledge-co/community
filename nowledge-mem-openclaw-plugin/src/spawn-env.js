const LOCAL_API_URL = "http://127.0.0.1:14242";

/**
 * Build the child env for nmem CLI execution.
 * apiKey stays in env only and is never passed as a CLI flag.
 * Clear inherited NMEM_* values first so the resolved plugin config wins.
 */
export function buildNmemSpawnEnv({ apiUrl, apiKey } = {}) {
	const env = { ...process.env };
	env.NMEM_API_URL = undefined;
	env.NMEM_API_KEY = undefined;
	if (apiUrl && apiUrl !== LOCAL_API_URL) {
		env.NMEM_API_URL = apiUrl;
	}
	if (apiKey) {
		env.NMEM_API_KEY = apiKey;
	}
	return env;
}
