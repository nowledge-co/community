import { describe, expect, it } from "vitest"

import { resolveConfig } from "../src/config"
import type { ResolvedConfig } from "../src/config"

/** Empty environment used as the baseline for resolution tests. */
const EMPTY_ENV: Readonly<Record<string, string | undefined>> = {}

/**
 * Placeholder API-key fixtures used only to assert precedence. The literal
 * prefix `placeholder-` keeps these visibly non-real so they are not mistaken
 * for production credentials.
 */
const ENV_KEY_FIXTURE = "placeholder-env-key"
const CONFIG_KEY_FIXTURE = "placeholder-config-key"

/** A shared-config reader that returns the given object. */
function sharedConfig(value: Record<string, unknown>): () => Record<string, unknown> {
  return () => value
}

describe("resolveConfig", () => {
  it("returns hardcoded defaults when nothing is set", () => {
    const config = resolveConfig(EMPTY_ENV, sharedConfig({}))

    expect(config).toEqual<ResolvedConfig>({
      apiUrl: "http://127.0.0.1:14242",
      apiKey: undefined,
      ambientSpaceId: undefined,
      ambientAgentId: undefined,
      ambientHostAgentId: undefined,
      autoSyncEnabled: true,
      autoSyncDebounceMs: 1500,
      bootstrapEnabled: true,
      debugLogging: false,
    })
  })

  it("strips trailing slashes from the API URL", () => {
    const config = resolveConfig({ NMEM_API_URL: "https://example.com///" }, sharedConfig({}))
    expect(config.apiUrl).toBe("https://example.com")
  })

  it("prefers environment variables over the shared config", () => {
    const config = resolveConfig(
      {
        NMEM_API_URL: "https://env.example",
        NMEM_API_KEY: ENV_KEY_FIXTURE,
        NMEM_SPACE: "env-space",
        NMEM_AGENT_ID: "env-agent",
        NMEM_HOST_AGENT_ID: "env-host",
      },
      sharedConfig({
        apiUrl: "https://config.example",
        apiKey: CONFIG_KEY_FIXTURE,
        space: "config-space",
        agentId: "config-agent",
        hostAgentId: "config-host",
      }),
    )

    expect(config.apiUrl).toBe("https://env.example")
    expect(config.apiKey).toBe(ENV_KEY_FIXTURE)
    expect(config.ambientSpaceId).toBe("env-space")
    expect(config.ambientAgentId).toBe("env-agent")
    expect(config.ambientHostAgentId).toBe("env-host")
  })

  it("falls back to the shared config when env is absent", () => {
    const config = resolveConfig(EMPTY_ENV, sharedConfig({ apiUrl: "https://config.example", apiKey: CONFIG_KEY_FIXTURE }))
    expect(config.apiUrl).toBe("https://config.example")
    expect(config.apiKey).toBe(CONFIG_KEY_FIXTURE)
  })

  it("resolves space from any of the config key variants", () => {
    expect(resolveConfig(EMPTY_ENV, sharedConfig({ space: "a" })).ambientSpaceId).toBe("a")
    expect(resolveConfig(EMPTY_ENV, sharedConfig({ spaceId: "b" })).ambientSpaceId).toBe("b")
    expect(resolveConfig(EMPTY_ENV, sharedConfig({ space_id: "c" })).ambientSpaceId).toBe("c")
  })

  it("resolves NMEM_SPACE_ID env as an alternative space source", () => {
    const config = resolveConfig({ NMEM_SPACE_ID: "id-space" }, sharedConfig({}))
    expect(config.ambientSpaceId).toBe("id-space")
  })

  it("resolves agent identity from config key variants", () => {
    expect(resolveConfig(EMPTY_ENV, sharedConfig({ agentId: "x" })).ambientAgentId).toBe("x")
    expect(resolveConfig(EMPTY_ENV, sharedConfig({ agent_id: "y" })).ambientAgentId).toBe("y")
    expect(resolveConfig(EMPTY_ENV, sharedConfig({ hostAgentId: "h1" })).ambientHostAgentId).toBe("h1")
    expect(resolveConfig(EMPTY_ENV, sharedConfig({ host_agent_id: "h2" })).ambientHostAgentId).toBe("h2")
  })

  it("treats empty/whitespace strings as unset", () => {
    const config = resolveConfig(
      { NMEM_API_URL: "   ", NMEM_API_KEY: "" },
      sharedConfig({ apiUrl: "   ", apiKey: "" }),
    )
    expect(config.apiUrl).toBe("http://127.0.0.1:14242")
    expect(config.apiKey).toBeUndefined()
  })

  it("ignores non-string config values", () => {
    const config = resolveConfig(EMPTY_ENV, sharedConfig({ apiUrl: 123, space: true }))
    expect(config.apiUrl).toBe("http://127.0.0.1:14242")
    expect(config.ambientSpaceId).toBeUndefined()
  })

  it.each(["0", "false", "off", "no", "OFF", "False"])("disables auto-sync for NMEM_AMP_AUTO_SYNC=%s", (value) => {
    const config = resolveConfig({ NMEM_AMP_AUTO_SYNC: value }, sharedConfig({}))
    expect(config.autoSyncEnabled).toBe(false)
  })

  it.each(["1", "true", "on", "yes"])("enables auto-sync for NMEM_AMP_AUTO_SYNC=%s", (value) => {
    const config = resolveConfig({ NMEM_AMP_AUTO_SYNC: value }, sharedConfig({}))
    expect(config.autoSyncEnabled).toBe(true)
  })

  it("uses a custom debounce value", () => {
    const config = resolveConfig({ NMEM_AMP_AUTO_SYNC_DEBOUNCE_MS: "5000" }, sharedConfig({}))
    expect(config.autoSyncDebounceMs).toBe(5000)
  })

  it("clamps debounce below the minimum to the documented minimum", () => {
    const config = resolveConfig({ NMEM_AMP_AUTO_SYNC_DEBOUNCE_MS: "10" }, sharedConfig({}))
    expect(config.autoSyncDebounceMs).toBe(250)
  })

  it("falls back to the default debounce for non-numeric values", () => {
    const config = resolveConfig({ NMEM_AMP_AUTO_SYNC_DEBOUNCE_MS: "not-a-number" }, sharedConfig({}))
    expect(config.autoSyncDebounceMs).toBe(1500)
  })

  it.each(["0", "false", "off", "no", "OFF", "False"])("disables bootstrap for NMEM_AMP_BOOTSTRAP=%s", (value) => {
    const config = resolveConfig({ NMEM_AMP_BOOTSTRAP: value }, sharedConfig({}))
    expect(config.bootstrapEnabled).toBe(false)
  })

  it.each(["1", "true", "on", "yes"])("enables bootstrap for NMEM_AMP_BOOTSTRAP=%s", (value) => {
    const config = resolveConfig({ NMEM_AMP_BOOTSTRAP: value }, sharedConfig({}))
    expect(config.bootstrapEnabled).toBe(true)
  })

  it("enables bootstrap by default when NMEM_AMP_BOOTSTRAP is unset", () => {
    const config = resolveConfig(EMPTY_ENV, sharedConfig({}))
    expect(config.bootstrapEnabled).toBe(true)
  })

  it("keeps debug logging off by default when NMEM_AMP_DEBUG is unset", () => {
    const config = resolveConfig(EMPTY_ENV, sharedConfig({}))
    expect(config.debugLogging).toBe(false)
  })

  it.each(["0", "false", "off", "no", "OFF", "False"])("keeps debug logging off for NMEM_AMP_DEBUG=%s", (value) => {
    const config = resolveConfig({ NMEM_AMP_DEBUG: value }, sharedConfig({}))
    expect(config.debugLogging).toBe(false)
  })

  it.each(["1", "true", "on", "yes", "ON", "True"])("enables debug logging for NMEM_AMP_DEBUG=%s", (value) => {
    const config = resolveConfig({ NMEM_AMP_DEBUG: value }, sharedConfig({}))
    expect(config.debugLogging).toBe(true)
  })
})
