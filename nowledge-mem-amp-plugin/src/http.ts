/**
 * Nowledge Mem HTTP client.
 *
 * Used for operations whose payloads are too large for CLI argv — primarily
 * full-session thread capture. Smaller memory operations go through the CLI
 * client; this module owns the create/append thread flow.
 *
 * `fetch` is injected so the client is unit-testable without a real server. The
 * client always POSTs JSON, applies the resolved ambient space, sends auth
 * headers when a key is configured, and enforces a request timeout via an
 * injected `AbortController` factory.
 */

import type { ResolvedConfig } from "./config"
import { withAmbientSpace } from "./identity"

/** Injectable ports required to build an HTTP client. */
export interface HttpPorts {
  /** Global `fetch`, injected for testability. */
  readonly fetch: typeof globalThis.fetch
  /** Constructs the abort controller used to enforce request timeouts. */
  readonly createAbortController: () => AbortController
}

/** Factory return type: a function that POSTs to the Nowledge Mem API. */
export type NmemHttp = (
  path: string,
  body: unknown,
  timeoutMs?: number,
) => Promise<HttpResponse>

/** Default request timeout (milliseconds). */
const DEFAULT_TIMEOUT_MS = 120_000

/** Normalised HTTP response. */
export interface HttpResponse {
  /** Whether the request completed with a 2xx status. */
  readonly ok: boolean
  /** HTTP status code, or `0` when the request never reached the server. */
  readonly status: number
  /** Parsed JSON body, or `null` when the body was empty or unparseable. */
  readonly data: unknown
}

/**
 * Builds a Nowledge Mem HTTP client bound to a resolved configuration.
 *
 * @param config - Resolved configuration supplying the base URL and credentials.
 * @param ports - Injectable ports supplying `fetch` and abort control.
 * @returns A function that POSTs JSON to the configured Nowledge Mem server.
 */
export function createNmemHttp(config: ResolvedConfig, ports: HttpPorts): NmemHttp {
  /**
   * POSTs a JSON body to a path under the configured Nowledge Mem base URL.
   *
   * Ambient space is applied via {@link withAmbientSpace}. The request is
   * aborted after `timeoutMs` and any network failure is normalised into an
   * `HttpResponse` so callers never see a thrown exception.
   *
   * @param path - Path under the base URL, for example `/threads`.
   * @param body - Request body; serialised as JSON.
   * @param timeoutMs - Optional timeout override in milliseconds.
   * @returns A normalised {@link HttpResponse}.
   */
  return async function nmemApi(
    path: string,
    body: unknown,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<HttpResponse> {
    const url = `${config.apiUrl}${path}`
    const decoratedBody = withAmbientSpace(body, config)
    const headers = buildHeaders(config)
    const controller = ports.createAbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await ports.fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(decoratedBody),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null)
      clearTimeout(timeout)
      return { ok: response.ok, status: response.status, data }
    } catch (error) {
      clearTimeout(timeout)
      return normaliseNetworkError(error, timeoutMs)
    }
  }
}

/**
 * Builds the request headers, including auth headers when a key is configured.
 *
 * @param config - Resolved configuration supplying the optional API key.
 * @returns The header record for the POST request.
 */
function buildHeaders(config: ResolvedConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (config.apiKey !== undefined) {
    headers.Authorization = `Bearer ${config.apiKey}`
    headers["X-NMEM-API-Key"] = config.apiKey
  }
  return headers
}

/**
 * Normalises a thrown network error into an {@link HttpResponse}.
 *
 * Abort errors are reported as a synthetic 504 so callers can distinguish a
 * timeout from a connection failure (status `0`). The error name is inspected
 * rather than using `instanceof` so the code path is robust to environments
 * whose `AbortError` constructor differs from Node's.
 *
 * @param error - The error thrown by `fetch`.
 * @param timeoutMs - The configured timeout, used to format the message.
 * @returns A normalised {@link HttpResponse}.
 */
function normaliseNetworkError(error: unknown, timeoutMs: number): HttpResponse {
  if (error instanceof Error && error.name === "AbortError") {
    return {
      ok: false,
      status: 504,
      data: { error: `Request timed out after ${Math.round(timeoutMs / 1000)}s` },
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  return { ok: false, status: 0, data: { error: message } }
}
