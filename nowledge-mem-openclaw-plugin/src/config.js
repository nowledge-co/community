const ALLOWED_KEYS = new Set([
  "autoRecall",
  "autoCapture",
  "serverUrl",
  "maxRecallResults",
])

export function parseConfig(raw) {
  const obj = raw && typeof raw === "object" ? raw : {}

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`Unknown config key: "${key}"`)
    }
  }

  return {
    autoRecall: typeof obj.autoRecall === "boolean" ? obj.autoRecall : true,
    autoCapture: typeof obj.autoCapture === "boolean" ? obj.autoCapture : false,
    serverUrl:
      typeof obj.serverUrl === "string"
        ? obj.serverUrl
        : "http://localhost:14242",
    maxRecallResults:
      typeof obj.maxRecallResults === "number"
        ? Math.min(20, Math.max(1, obj.maxRecallResults))
        : 5,
  }
}
