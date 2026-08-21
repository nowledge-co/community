/**
 * Pure configuration resolution for the Nowledge Mem Amp connector.
 *
 * This module turns two injected inputs — the process environment and a reader
 * for the shared client config file — into a single {@link ResolvedConfig}. It
 * holds no state and performs no I/O of its own, so it is fully unit-testable.
 *
 * Resolution precedence (highest first):
 *   1. environment variables (`NMEM_*`)
 *   2. shared config file (`~/.nowledge-mem/config.json`)
 *   3. hardcoded defaults
 */

/** Default Nowledge Mem local endpoint. */
const DEFAULT_API_URL = "http://127.0.0.1:14242"

/** Default debounce window (milliseconds) for automatic session capture. */
const DEFAULT_AUTO_SYNC_DEBOUNCE_MS = 1500

/** Minimum debounce window (milliseconds); values below this are clamped up. */
const MIN_AUTO_SYNC_DEBOUNCE_MS = 250

/** Truthy string values that disable automatic session capture. */
const AUTO_SYNC_DISABLED_VALUES = new Set(["0", "false", "off", "no"])

/** Truthy string values that disable the agent.start Context Bundle bootstrap. */
const BOOTSTRAP_DISABLED_VALUES = new Set(["0", "false", "off", "no"])

/** Truthy string values that enable verbose connector lifecycle logging. */
const DEBUG_ENABLED_VALUES = new Set(["1", "true", "on", "yes"])

/** Default HTTP timeout (milliseconds) for automatic thread sync. */
const DEFAULT_THREAD_SYNC_TIMEOUT_MS = 120_000

/** Minimum accepted `NMEM_SYNC_TIMEOUT_MS` value. */
const MIN_THREAD_SYNC_TIMEOUT_MS = 1_000

/** Maximum accepted `NMEM_SYNC_TIMEOUT_MS` value (30 minutes). */
const MAX_THREAD_SYNC_TIMEOUT_MS = 30 * 60_000

/**
 * Fully resolved connector configuration.
 *
 * All optional ambient fields are `undefined` when unset, never empty strings,
 * so downstream code can test with a simple truthiness check.
 */
export interface ResolvedConfig {
  /** Nowledge Mem server base URL, trailing slashes stripped. */
  readonly apiUrl: string
  /** API key for remote access, or `undefined` for local unauthenticated use. */
  readonly apiKey: string | undefined
  /** Ambient space id for this session, or `undefined` for the default space. */
  readonly ambientSpaceId: string | undefined
  /** Stable Nowledge AI Identity for this run, or `undefined`. */
  readonly ambientAgentId: string | undefined
  /** Advanced external-alias mapping for the host agent, or `undefined`. */
  readonly ambientHostAgentId: string | undefined
  /** Whether automatic session capture is enabled. */
  readonly autoSyncEnabled: boolean
  /** Debounce window (milliseconds) for automatic session capture. */
  readonly autoSyncDebounceMs: number
  /** Whether the `agent.start` Context Bundle bootstrap injection is enabled. */
  readonly bootstrapEnabled: boolean
  /** Whether verbose connector lifecycle logging (`loaded`/`disposed`) is enabled. */
  readonly debugLogging: boolean
  /** HTTP timeout (milliseconds) for automatic thread sync. */
  readonly threadSyncTimeoutMs: number
}

/**
 * Normalises a value to a trimmed non-empty string, or returns `undefined`.
 *
 * @param value - Raw value from environment or config.
 * @returns The trimmed string when non-empty, otherwise `undefined`.
 */
function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Reads a config key from the environment first, then the shared config object.
 *
 * Multiple keys are accepted because the shared config file uses different
 * casing conventions (`space` vs `spaceId` vs `space_id`); the first non-empty
 * match wins in each layer.
 *
 * @param env - Process environment record.
 * @param sharedConfig - Parsed shared config object.
 * @param envKeys - Environment variable names to check, in priority order.
 * @param configKeys - Shared config keys to check, in priority order.
 * @returns The resolved value, or `undefined` when nothing is set.
 */
function readEnvOrConfig(
  env: Readonly<Record<string, string | undefined>>,
  sharedConfig: Record<string, unknown>,
  envKeys: readonly string[],
  configKeys: readonly string[],
): string | undefined {
  for (const key of envKeys) {
    const value = nonEmptyString(env[key])
    if (value !== undefined) return value
  }
  for (const key of configKeys) {
    const value = nonEmptyString(sharedConfig[key])
    if (value !== undefined) return value
  }
  return undefined
}

/**
 * Resolves the connector configuration from environment and shared config.
 *
 * @param env - Process environment record (injected for testability).
 * @param readSharedConfig - Reader for `~/.nowledge-mem/config.json`.
 * @returns The fully resolved configuration.
 */
export function resolveConfig(
  env: Readonly<Record<string, string | undefined>>,
  readSharedConfig: () => Record<string, unknown>,
): ResolvedConfig {
  const sharedConfig = readSharedConfig()

  const rawApiUrl =
    nonEmptyString(env.NMEM_API_URL) ??
    nonEmptyString(sharedConfig.apiUrl) ??
    DEFAULT_API_URL
  const apiUrl = rawApiUrl.replace(/\/+$/, "")

  const apiKey = nonEmptyString(env.NMEM_API_KEY) ?? nonEmptyString(sharedConfig.apiKey)

  const ambientSpaceId = readEnvOrConfig(
    env,
    sharedConfig,
    ["NMEM_SPACE", "NMEM_SPACE_ID"],
    ["space", "spaceId", "space_id"],
  )

  const ambientAgentId = readEnvOrConfig(
    env,
    sharedConfig,
    ["NMEM_AGENT_ID"],
    ["agentId", "agent_id"],
  )

  const ambientHostAgentId = readEnvOrConfig(
    env,
    sharedConfig,
    ["NMEM_HOST_AGENT_ID"],
    ["hostAgentId", "host_agent_id"],
  )

  const autoSyncRaw = nonEmptyString(env.NMEM_AMP_AUTO_SYNC) ?? "1"
  const autoSyncEnabled = !AUTO_SYNC_DISABLED_VALUES.has(autoSyncRaw.toLowerCase())

  const debounceRaw = Number(nonEmptyString(env.NMEM_AMP_AUTO_SYNC_DEBOUNCE_MS) ?? String(DEFAULT_AUTO_SYNC_DEBOUNCE_MS))
  const autoSyncDebounceMs =
    Number.isFinite(debounceRaw)
      ? Math.max(MIN_AUTO_SYNC_DEBOUNCE_MS, debounceRaw)
      : DEFAULT_AUTO_SYNC_DEBOUNCE_MS

  const bootstrapRaw = nonEmptyString(env.NMEM_AMP_BOOTSTRAP) ?? "1"
  const bootstrapEnabled = !BOOTSTRAP_DISABLED_VALUES.has(bootstrapRaw.toLowerCase())

  const debugRaw = nonEmptyString(env.NMEM_AMP_DEBUG) ?? "0"
  const debugLogging = DEBUG_ENABLED_VALUES.has(debugRaw.toLowerCase())

  const threadSyncTimeoutMs = resolveThreadSyncTimeoutMs(env.NMEM_SYNC_TIMEOUT_MS)

  return {
    apiUrl,
    apiKey,
    ambientSpaceId,
    ambientAgentId,
    ambientHostAgentId,
    autoSyncEnabled,
    autoSyncDebounceMs,
    bootstrapEnabled,
    debugLogging,
    threadSyncTimeoutMs,
  }
}

/**
 * Resolves the automatic thread-sync timeout from `NMEM_SYNC_TIMEOUT_MS`.
 *
 * Unset, empty, or non-integer values fall back to two minutes. Values are
 * clamped to the same 1-second–30-minute bounds used by the Pi and OpenCode
 * connectors. The explicit manual save tool keeps its own existing timeout.
 *
 * @param raw - Raw environment value.
 * @returns A timeout in milliseconds.
 */
export function resolveThreadSyncTimeoutMs(raw: string | undefined): number {
  const parsed = Number(raw)
  if (!raw?.trim() || !Number.isSafeInteger(parsed) || parsed <= 0) {
    return DEFAULT_THREAD_SYNC_TIMEOUT_MS
  }
  return Math.min(MAX_THREAD_SYNC_TIMEOUT_MS, Math.max(MIN_THREAD_SYNC_TIMEOUT_MS, parsed))
}
