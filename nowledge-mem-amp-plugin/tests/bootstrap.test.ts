import { describe, expect, it, vi } from "vitest"

import {
  buildBootstrapMessage,
  createBootstrapHandler,
} from "../src/bootstrap"
import type { NmemCli } from "../src/cli"

/** A fake nmem that returns canned stdout. */
function fakeNmem(stdout: string): NmemCli {
  return (() => Promise.resolve(stdout)) as NmemCli
}

/** A fake nmem that throws, to exercise the fail-open path. */
function throwingNmem(error: Error): NmemCli {
  return (() => Promise.reject(error)) as NmemCli
}

describe("buildBootstrapMessage", () => {
  it("prefixes a valid bundle with the reminder header", () => {
    const result = buildBootstrapMessage('{"identity":"owner"}')
    expect(result).toBe('[Nowledge Mem Context Bundle]\n{"identity":"owner"}')
  })

  it("truncates a bundle longer than the character limit", () => {
    const long = "x".repeat(5000)
    const result = buildBootstrapMessage(long)
    expect(result).toBeDefined()
    expect(result!.startsWith("[Nowledge Mem Context Bundle]\n")).toBe(true)
    expect(result!.endsWith("…")).toBe(true)
    // 4000 chars of body + ellipsis + prefix line + newline
    expect(result!.length).toBe("[Nowledge Mem Context Bundle]\n".length + 4000 + 1)
  })

  it("returns undefined for an error payload", () => {
    expect(buildBootstrapMessage(JSON.stringify({ error: "down" }))).toBeUndefined()
  })

  it("returns undefined for empty output", () => {
    expect(buildBootstrapMessage("   ")).toBeUndefined()
    expect(buildBootstrapMessage("")).toBeUndefined()
  })

  it("injects a short valid bundle unchanged", () => {
    expect(buildBootstrapMessage('{"ok":true}')).toBe('[Nowledge Mem Context Bundle]\n{"ok":true}')
  })

  it("does not truncate a bundle exactly at the limit", () => {
    const exact = "x".repeat(4000)
    const result = buildBootstrapMessage(exact)
    expect(result).toBe(`[Nowledge Mem Context Bundle]\n${exact}`)
  })
})

describe("createBootstrapHandler", () => {
  it("returns an empty result when bootstrap is disabled", async () => {
    const nmem = fakeNmem('{"bundle":true}')
    const handler = createBootstrapHandler({ nmem }, { sourceApp: "amp", enabled: false })
    const result = await handler()
    expect(result).toEqual({})
  })

  it("injects the bundle as a hidden message when enabled", async () => {
    const nmem = fakeNmem('{"bundle":true}')
    const handler = createBootstrapHandler({ nmem }, { sourceApp: "amp", enabled: true })
    const result = await handler()
    expect(result).toEqual({
      message: {
        content: '[Nowledge Mem Context Bundle]\n{"bundle":true}',
        display: false,
      },
    })
  })

  it("calls nmem context with the source-app flag", async () => {
    const calls: string[][] = []
    const nmem = ((args: readonly string[]) => {
      calls.push([...args])
      return Promise.resolve('{"ok":true}')
    }) as NmemCli
    const handler = createBootstrapHandler({ nmem }, { sourceApp: "amp", enabled: true })
    await handler()
    expect(calls[0]).toEqual(["context", "--source-app", "amp"])
  })

  it("returns an empty result when the bundle is an error payload (fail-open)", async () => {
    const nmem = fakeNmem(JSON.stringify({ error: "server down" }))
    const handler = createBootstrapHandler({ nmem }, { sourceApp: "amp", enabled: true })
    const result = await handler()
    expect(result).toEqual({})
  })

  it("returns an empty result when nmem throws (fail-open)", async () => {
    const nmem = throwingNmem(new Error("ENOENT"))
    const handler = createBootstrapHandler({ nmem }, { sourceApp: "amp", enabled: true })
    const result = await handler()
    expect(result).toEqual({})
  })

  it("does not call nmem when disabled", async () => {
    const nmem = vi.fn((() => Promise.resolve('{"ok":true}')) as NmemCli)
    const handler = createBootstrapHandler({ nmem }, { sourceApp: "amp", enabled: false })
    await handler()
    expect(nmem).not.toHaveBeenCalled()
  })
})
