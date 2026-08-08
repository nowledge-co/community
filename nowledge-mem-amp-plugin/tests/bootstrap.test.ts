import { describe, expect, it, vi } from "vitest"

import { BootstrapManager, buildBootstrapMessage } from "../src/bootstrap"
import type { NmemCli } from "../src/cli"

function fakeNmem(stdout: string): NmemCli {
  return (() => Promise.resolve(stdout)) as NmemCli
}

function throwingNmem(error: Error): NmemCli {
  return (() => Promise.reject(error)) as NmemCli
}

describe("buildBootstrapMessage", () => {
  it("prefixes a valid bundle", () => {
    expect(buildBootstrapMessage('{"identity":"owner"}')).toBe('[Nowledge Mem Context Bundle]\n{"identity":"owner"}')
  })

  it("truncates oversized bundles", () => {
    const result = buildBootstrapMessage("x".repeat(5000))
    expect(result).toBeDefined()
    expect(result!.endsWith("…")).toBe(true)
    expect(result!.length).toBe("[Nowledge Mem Context Bundle]\n".length + 4001)
  })

  it("returns undefined for errors and empty output", () => {
    expect(buildBootstrapMessage('{"error":"down"}')).toBeUndefined()
    expect(buildBootstrapMessage(" ")).toBeUndefined()
  })

  it("does not truncate an exact-size bundle", () => {
    const exact = "x".repeat(4000)
    expect(buildBootstrapMessage(exact)).toBe(`[Nowledge Mem Context Bundle]\n${exact}`)
  })
})

describe("BootstrapManager", () => {
  it("preloads and consumes once per session", async () => {
    const manager = new BootstrapManager({ nmem: fakeNmem('{"bundle":true}') }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    expect(await manager.consume("T-1")).toEqual({ message: { content: '[Nowledge Mem Context Bundle]\n{"bundle":true}', display: false } })
    expect(await manager.consume("T-1")).toEqual({})
  })

  it("does not fetch when disabled", async () => {
    const nmem = vi.fn(fakeNmem('{"bundle":true}'))
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: false })
    manager.preload("T-1")
    expect(await manager.consume("T-1")).toEqual({})
    expect(nmem).not.toHaveBeenCalled()
  })

  it("fails open for error and throwing CLI results", async () => {
    const errorManager = new BootstrapManager({ nmem: fakeNmem('{"error":"down"}') }, { sourceApp: "amp", enabled: true })
    errorManager.preload("T-1")
    expect(await errorManager.consume("T-1")).toEqual({})
    const throwingManager = new BootstrapManager({ nmem: throwingNmem(new Error("down")) }, { sourceApp: "amp", enabled: true })
    throwingManager.preload("T-1")
    expect(await throwingManager.consume("T-1")).toEqual({})
  })

  it("does not refetch the same thread and manages sessions independently", async () => {
    const nmem = vi.fn(fakeNmem('{"ok":true}'))
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    manager.preload("T-1")
    manager.preload("T-2")
    await manager.consume("T-1")
    await manager.consume("T-2")
    expect(nmem).toHaveBeenCalledTimes(2)
  })

  it("clears cached state on dispose", async () => {
    const manager = new BootstrapManager({ nmem: fakeNmem('{"ok":true}') }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    await manager.consume("T-1")
    manager.dispose()
    expect(await manager.consume("T-1")).toEqual({})
  })
})
