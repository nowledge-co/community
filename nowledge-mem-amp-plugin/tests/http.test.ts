import { afterEach, describe, expect, it, vi } from "vitest"

import { createNmemHttp } from "../src/http"
import type { ResolvedConfig } from "../src/config"

/**
 * Placeholder auth fixture. The `dummy-` prefix and `secret`-less wording keep
 * this visibly non-real so it is not mistaken for a production credential; it
 * exists only to assert that auth headers are attached.
 */
const AUTH_FIXTURE = "dummy-auth-value"

/** Base config pointing at the local Mem endpoint with no auth. */
const NO_AUTH_CONFIG: ResolvedConfig = {
  apiUrl: "http://127.0.0.1:14242",
  apiKey: undefined,
  ambientSpaceId: undefined,
  ambientAgentId: undefined,
  ambientHostAgentId: undefined,
  autoSyncEnabled: true,
  autoSyncDebounceMs: 1500,
  bootstrapEnabled: true,
  debugLogging: false,
  threadSyncTimeoutMs: 120_000,
}

/** Config carrying the placeholder auth fixture. */
const AUTHED_CONFIG: ResolvedConfig = { ...NO_AUTH_CONFIG, apiKey: AUTH_FIXTURE }

/** Config with an ambient space. */
const SPACED_CONFIG: ResolvedConfig = { ...NO_AUTH_CONFIG, ambientSpaceId: "Research" }

afterEach(() => {
  vi.restoreAllMocks()
})

/** A minimal Response-like object for the fake fetch. */
interface FakeResponse {
  readonly ok: boolean
  readonly status: number
  readonly json: () => Promise<unknown>
}

/** Builds a fake fetch that returns the given response. */
function fakeFetch(response: FakeResponse): typeof globalThis.fetch {
  return vi.fn(async () => response) as unknown as typeof globalThis.fetch
}

/** Builds a real AbortController so the abort path is exercisable. */
function realAbortController(): AbortController {
  return new AbortController()
}

/** Captures the request a fake fetch received. */
function recordingFetch(response: FakeResponse): { fetch: typeof globalThis.fetch; captured: { url: string; init: RequestInit }[] } {
  const captured: { url: string; init: RequestInit }[] = []
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    captured.push({ url, init })
    return response
  }) as unknown as typeof globalThis.fetch
  return { fetch, captured }
}

describe("createNmemHttp", () => {
  it("POSTs JSON to the base URL and returns the parsed body", async () => {
    const { fetch, captured } = recordingFetch({ ok: true, status: 200, json: async () => ({ id: "T-1" }) })
    const nmemApi = createNmemHttp(NO_AUTH_CONFIG, { fetch, createAbortController: realAbortController })

    const result = await nmemApi("/threads", { title: "x" })

    expect(result).toEqual({ ok: true, status: 200, data: { id: "T-1" } })
    expect(captured[0]?.url).toBe("http://127.0.0.1:14242/threads")
    expect(captured[0]?.init.method).toBe("POST")
    expect(captured[0]?.init.headers).toEqual({ "Content-Type": "application/json" })
  })

  it("adds auth headers when an API auth value is configured", async () => {
    const { fetch, captured } = recordingFetch({ ok: true, status: 200, json: async () => null })
    const nmemApi = createNmemHttp(AUTHED_CONFIG, { fetch, createAbortController: realAbortController })
    await nmemApi("/threads", {})

    const headers = captured[0]?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${AUTH_FIXTURE}`)
    expect(headers["X-NMEM-API-Key"]).toBe(AUTH_FIXTURE)
  })

  it("injects ambient space_id into the body", async () => {
    const { fetch, captured } = recordingFetch({ ok: true, status: 200, json: async () => null })
    const nmemApi = createNmemHttp(SPACED_CONFIG, { fetch, createAbortController: realAbortController })
    await nmemApi("/threads", { messages: [] })
    expect(captured[0]?.init.body).toBe(JSON.stringify({ messages: [], space_id: "Research" }))
  })

  it("returns a normalised error for a non-ok status", async () => {
    const fetch = fakeFetch({ ok: false, status: 409, json: async () => ({ detail: "exists" }) })
    const nmemApi = createNmemHttp(NO_AUTH_CONFIG, { fetch, createAbortController: realAbortController })
    const result = await nmemApi("/threads", {})
    expect(result).toEqual({ ok: false, status: 409, data: { detail: "exists" } })
  })

  it("returns data null when the body is not JSON", async () => {
    const fetch = fakeFetch({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json")
      },
    })
    const nmemApi = createNmemHttp(NO_AUTH_CONFIG, { fetch, createAbortController: realAbortController })
    const result = await nmemApi("/threads", {})
    expect(result.ok).toBe(true)
    expect(result.data).toBeNull()
  })

  it("normalises an abort into a synthetic 504", async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const signal = init.signal as AbortSignal
      signal.dispatchEvent(new Event("abort"))
      throw new DOMException("aborted", "AbortError")
    }) as unknown as typeof globalThis.fetch
    const nmemApi = createNmemHttp(NO_AUTH_CONFIG, { fetch, createAbortController: realAbortController })
    const result = await nmemApi("/threads", {}, 1000)
    expect(result.ok).toBe(false)
    expect(result.status).toBe(504)
    const data = result.data as { error: string }
    expect(data.error).toContain("timed out")
  })

  it("allows two minutes for a request by default", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout")
    const fetch = fakeFetch({ ok: true, status: 200, json: async () => null })
    const nmemApi = createNmemHttp(NO_AUTH_CONFIG, { fetch, createAbortController: realAbortController })

    await nmemApi("/threads", {})

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 120_000)
    setTimeoutSpy.mockRestore()
  })

  it("normalises a generic network error into status 0", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED")
    }) as unknown as typeof globalThis.fetch
    const nmemApi = createNmemHttp(NO_AUTH_CONFIG, { fetch, createAbortController: realAbortController })
    const result = await nmemApi("/threads", {})
    expect(result.ok).toBe(false)
    expect(result.status).toBe(0)
    const data = result.data as { error: string }
    expect(data.error).toBe("ECONNREFUSED")
  })

  it("normalises a non-Error throw into status 0 with a stringified message", async () => {
    const fetch = vi.fn(async () => {
      // Throwing a non-Error value exercises the String(error) branch.
      throw "string error"
    }) as unknown as typeof globalThis.fetch
    const nmemApi = createNmemHttp(NO_AUTH_CONFIG, { fetch, createAbortController: realAbortController })
    const result = await nmemApi("/threads", {})
    expect(result.status).toBe(0)
    const data = result.data as { error: string }
    expect(data.error).toBe("string error")
  })

  it("clears the timeout after a successful request", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout")
    const fetch = fakeFetch({ ok: true, status: 200, json: async () => null })
    const nmemApi = createNmemHttp(NO_AUTH_CONFIG, { fetch, createAbortController: realAbortController })
    await nmemApi("/threads", {})
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it("clears the timeout even when the request throws", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout")
    const fetch = vi.fn(async () => {
      throw new Error("network down")
    }) as unknown as typeof globalThis.fetch
    const nmemApi = createNmemHttp(NO_AUTH_CONFIG, { fetch, createAbortController: realAbortController })
    await nmemApi("/threads", {})
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})
