const LOCAL_API_URL = "http://127.0.0.1:14242";

/**
 * Build the child env for nmem CLI execution.
 * apiKey stays in env only and is never passed as a CLI flag.
 * Clear inherited API endpoint/auth values first so the resolved plugin config wins.
 * Keep NMEM_SPACE_ID unless an explicit override is provided, because it is an
 * ambient session lane rather than a transport secret.
 */
export function buildNmemSpawnEnv({ apiUrl, apiKey, spaceId } = {}) {
	const env = { ...process.env };
	delete env.NMEM_API_URL;
	delete env.NMEM_API_KEY;
	if (apiUrl && apiUrl !== LOCAL_API_URL) {
		env.NMEM_API_URL = apiUrl;
	}
	if (apiKey) {
		env.NMEM_API_KEY = apiKey;
	}
	if (spaceId) {
		env.NMEM_SPACE_ID = spaceId;
	}
	return env;
}
