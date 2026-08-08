import { describe, expect, it, vi } from "vitest"

import { createNmemCli, CLI_TIMEOUT_MS } from "../src/cli"
import type { ResolvedConfig } from "../src/config"
import type { ExecFileFn } from "../src/types"

/** Minimal config with no ambient identity, so args pass through unchanged. */
const BASE_CONFIG: ResolvedConfig = {
  apiUrl: "http://127.0.0.1:14242",
  apiKey: undefined,
  ambientSpaceId: undefined,
  ambientAgentId: undefined,
  ambientHostAgentId: undefined,
  autoSyncEnabled: true,
  autoSyncDebounceMs: 1500,
  bootstrapEnabled: true,
}

/** Records the args a fake execFile was invoked with. */
interface RecordedCall {
  readonly file: string
  readonly args: readonly string[]
}

/**
 * Builds a fake execFile that records calls and responds via the given handler.
 *
 * @param handler - Receives the recorded call; returns [error, stdout, stderr].
 */
function fakeExecFile(
  handler: (call: RecordedCall) => [Error | null, string, string],
): ExecFileFn & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const fn = ((file: string, args: readonly string[], callback: (error: Error | null, stdout: string, stderr: string) => void) => {
    const call: RecordedCall = { file, args }
    calls.push(call)
    const [error, stdout, stderr] = handler(call)
    callback(error, stdout, stderr)
  }) as ExecFileFn & { calls: RecordedCall[] }
  fn.calls = calls
  return fn
}

describe("createNmemCli", () => {
  it("prepends --json and returns trimmed stdout", async () => {
    const execFile = fakeExecFile(() => [null, '  {"ok":true}  ', ""])
    const nmem = createNmemCli(BASE_CONFIG, { execFile })
    const result = await nmem(["status"])
    expect(result).toBe('{"ok":true}')
    expect(execFile.calls[0]).toEqual({ file: "nmem", args: ["--json", "status"] })
  })

  it("exposes the configured CLI timeout constant", () => {
    expect(CLI_TIMEOUT_MS).toBe(30_000)
  })

  it("serialises a missing-binary error into a JSON envelope", async () => {
    const execFile = fakeExecFile(() => [new Error("spawn ENOENT"), "", "nmem: command not found"])
    const nmem = createNmemCli(BASE_CONFIG, { execFile })
    const result = await nmem(["status"])
    const parsed = JSON.parse(result) as { error: string }
    expect(parsed.error).toContain("nmem CLI not found")
    expect(parsed.error).toContain("pip install nmem-cli")
  })

  it("detects the Windows 'not recognized' missing-binary marker", async () => {
    const execFile = fakeExecFile(() => [new Error("spawn error"), "", "'nmem' is not recognized as an internal or external command"])
    const nmem = createNmemCli(BASE_CONFIG, { execFile })
    const result = await nmem(["status"])
    const parsed = JSON.parse(result) as { error: string }
    expect(parsed.error).toContain("nmem CLI not found")
  })

  it("serialises a generic exec error using stderr when present", async () => {
    const execFile = fakeExecFile(() => [new Error("exit code 1"), "", "something went wrong"])
    const nmem = createNmemCli(BASE_CONFIG, { execFile })
    const result = await nmem(["m", "search", "q"])
    const parsed = JSON.parse(result) as { error: string }
    expect(parsed.error).toBe("something went wrong")
  })

  it("falls back to the error message when stderr is empty", async () => {
    const execFile = fakeExecFile(() => [new Error("exit code 1"), "", ""])
    const nmem = createNmemCli(BASE_CONFIG, { execFile })
    const result = await nmem(["status"])
    const parsed = JSON.parse(result) as { error: string }
    expect(parsed.error).toBe("exit code 1")
  })

  it("applies ambient space to scoped commands", async () => {
    const execFile = fakeExecFile(() => [null, '{"ok":true}', ""])
    const config: ResolvedConfig = { ...BASE_CONFIG, ambientSpaceId: "Research" }
    const nmem = createNmemCli(config, { execFile })
    await nmem(["m", "search", "query"])
    expect(execFile.calls[0]?.args).toEqual(["--json", "m", "search", "query", "--space", "Research"])
  })

  it("never throws: resolves errors to JSON envelopes", async () => {
    const execFile = fakeExecFile(() => [new Error("boom"), "", ""])
    const nmem = createNmemCli(BASE_CONFIG, { execFile })
    await expect(nmem(["status"])).resolves.toBeTypeOf("string")
  })

  it("does not call execFile until the returned function is invoked", async () => {
    const execFile = fakeExecFile(() => [null, "{}", ""])
    createNmemCli(BASE_CONFIG, { execFile })
    expect(execFile.calls).toHaveLength(0)
    vi.restoreAllMocks()
  })
})
