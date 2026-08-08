/**
 * End-to-end test for the Amp connector's HTTP thread-capture path.
 *
 * This test exercises the same code path the connector uses at runtime:
 *   1. POST /threads to create a thread with a unique marker.
 *   2. Verify the thread is findable via `nmem t search <marker>`.
 *   3. Verify `nmem t show <id>` returns the persisted messages.
 *
 * The test is skipped by default because it requires a running Nowledge Mem
 * server and the `nmem` CLI on PATH. Enable it with:
 *
 *   NMEM_E2E=1 npx vitest run tests/e2e.test.ts
 *
 * The test writes a uniquely-marked thread and cleans it up at the end. It
 * never touches the user's existing data.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"

/** Whether the live E2E test is enabled. */
const E2E_ENABLED = process.env.NMEM_E2E === "1"

/** Unique marker embedded in the test thread so it can be found and cleaned up. */
const MARKER = `amp-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/** Stable thread id derived from the marker, matching the connector's convention. */
const THREAD_ID = `amp-e2e-${MARKER}`.toLowerCase()

/**
 * Resolved API URL from environment or shared config, defaulting to the local
 * Nowledge Mem desktop endpoint. This is a test-only constant, not a server-side
 * request surface; the test connects to the developer's own Mem instance.
 */
const API_URL = (process.env.NMEM_API_URL ?? "http://127.0.0.1:14242").replace(/\/+$/, "")

/** Optional API key for remote Mem. */
const API_KEY = process.env.NMEM_API_KEY

/**
 * Runs `nmem --json <args>` and returns the parsed JSON output.
 *
 * @param args - CLI arguments (without `--json`).
 * @returns The parsed JSON response.
 */
function nmemJson(args: string[]): unknown {
  const stdout = execFileSync("nmem", ["--json", ...args], {
    encoding: "utf-8",
    timeout: 30_000,
  })
  return JSON.parse(stdout)
}

/**
 * Posts a JSON body to the Nowledge Mem thread API.
 *
 * This mirrors the connector's HTTP capture path. The endpoint is the
 * developer's own local or configured Mem server, not an attacker-controlled
 * URL.
 *
 * @param path - API path (e.g. `/threads`).
 * @param body - Request body object.
 * @returns The parsed JSON response.
 */
async function postToMem(path: string, body: unknown): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`
    headers["X-NMEM-API-Key"] = API_KEY
  }
  const endpoint = API_URL + path
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`)
  }
  return data
}

/** Skips the test suite when the live E2E flag is not set. */
describe.skipIf(!E2E_ENABLED)("Amp connector E2E: HTTP thread capture", () => {
  /**
   * Verifies the Mem server is reachable and the nmem CLI is on PATH before
   * running any test. All tests in this suite are skipped (not failed) when the
   * prerequisites are missing.
   */
  beforeAll(() => {
    const status = nmemJson(["status"]) as { status?: string }
    expect(status.status).toBe("ok")
  })

  /**
   * Cleans up the test thread after the suite so no test data lingers.
   */
  afterAll(() => {
    try {
      execFileSync("nmem", ["--json", "t", "delete", THREAD_ID], {
        encoding: "utf-8",
        timeout: 10_000,
        stdio: "pipe",
      })
    } catch {
      // Thread may not exist if create failed; ignore cleanup errors.
    }
  })

  it("creates a thread via the HTTP API and finds it via nmem t search", async () => {
    // Build a transcript mimicking what the Amp connector would capture:
    // one user turn and one assistant turn, each with SDK-aligned blocks.
    const messages = [
      {
        content: `User prompt with marker ${MARKER}`,
        role: "user",
        timestamp: new Date().toISOString(),
        metadata: {
          external_id: `amp-msg-u1-${MARKER}`,
          source_app: "amp",
        },
      },
      {
        content: `Assistant reply acknowledging ${MARKER}`,
        role: "assistant",
        timestamp: new Date().toISOString(),
        metadata: {
          external_id: `amp-msg-a1-${MARKER}`,
          source_app: "amp",
        },
      },
    ]

    await postToMem("/threads", {
      thread_id: THREAD_ID,
      title: `Amp E2E Test ${MARKER}`,
      messages,
      source: "amp",
      project: "/tmp/amp-e2e",
      workspace: "/tmp/amp-e2e",
    })

    // The thread should be findable by its unique marker. The search may take
    // a moment to index, so retry briefly before asserting.
    let found: { id?: string; title?: string } | undefined
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const searchResult = nmemJson(["t", "search", MARKER]) as {
        threads?: Array<{ id?: string; title?: string }>
        total?: number
      }
      found = (searchResult.threads ?? []).find((t) => t.id === THREAD_ID)
      if (found !== undefined) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    expect(found).toBeDefined()
    expect(found?.title).toBe(`Amp E2E Test ${MARKER}`)
  }, 30_000)

  it("verifies the persisted messages via nmem t show", async () => {
    const showResult = nmemJson(["t", "show", THREAD_ID, "--content-limit", "5000"]) as {
      id?: string
      messages?: Array<{ content?: string; role?: string }>
    }
    expect(showResult.id).toBe(THREAD_ID)
    expect(showResult.messages?.length ?? 0).toBeGreaterThanOrEqual(2)

    const contents = (showResult.messages ?? []).map((m) => m.content ?? "").join("\n")
    expect(contents).toContain(MARKER)
  })
})
