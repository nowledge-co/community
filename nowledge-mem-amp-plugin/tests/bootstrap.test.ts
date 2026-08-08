import { describe, expect, it, vi } from "vitest"

import {
  buildBootstrapMessage,
  BootstrapManager,
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

describe("BootstrapManager", () => {
  it("returns empty when bootstrap is disabled", async () => {
    const nmem = fakeNmem('{"bundle":true}')
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: false })
    manager.preload("T-1")
    const result = await manager.consume("T-1")
    expect(result).toEqual({})
  })

  it("preloads on session.start and injects on the first agent.start", async () => {
    const nmem = fakeNmem('{"bundle":true}')
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    const result = await manager.consume("T-1")
    expect(result).toEqual({
      message: {
        content: '[Nowledge Mem Context Bundle]\n{"bundle":true}',
        display: false,
      },
    })
  })

  it("calls nmem context with the source-app flag during preload", async () => {
    const calls: string[][] = []
    const nmem = ((args: readonly string[]) => {
      calls.push([...args])
      return Promise.resolve('{"ok":true}')
    }) as NmemCli
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    await manager.consume("T-1")
    expect(calls[0]).toEqual(["context", "--source-app", "amp"])
  })

  it("returns empty on the second agent.start (consume once per session)", async () => {
    const nmem = fakeNmem('{"bundle":true}')
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    const first = await manager.consume("T-1")
    const second = await manager.consume("T-1")
    expect(first).toEqual({
      message: {
        content: '[Nowledge Mem Context Bundle]\n{"bundle":true}',
        display: false,
      },
    })
    expect(second).toEqual({})
  })

  it("does not call nmem when disabled", async () => {
    const nmem = vi.fn((() => Promise.resolve('{"ok":true}')) as NmemCli)
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: false })
    manager.preload("T-1")
    await manager.consume("T-1")
    expect(nmem).not.toHaveBeenCalled()
  })

  it("returns empty when preload found an error payload (fail-open)", async () => {
    const nmem = fakeNmem(JSON.stringify({ error: "server down" }))
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    const result = await manager.consume("T-1")
    expect(result).toEqual({})
  })

  it("returns empty when nmem throws during preload (fail-open)", async () => {
    const nmem = throwingNmem(new Error("ENOENT"))
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    const result = await manager.consume("T-1")
    expect(result).toEqual({})
  })

  it("manages multiple sessions independently", async () => {
    const nmem = fakeNmem('{"bundle":true}')
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    manager.preload("T-2")
    expect(await manager.consume("T-1")).toEqual({
      message: {
        content: '[Nowledge Mem Context Bundle]\n{"bundle":true}',
        display: false,
      },
    })
    expect(await manager.consume("T-2")).toEqual({
      message: {
        content: '[Nowledge Mem Context Bundle]\n{"bundle":true}',
        display: false,
      },
    })
    expect(await manager.consume("T-1")).toEqual({})
  })

  it("awaits an in-flight preload when consume is called", async () => {
    const nmem = fakeNmem('{"bundle":true}')
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    // consume awaits the in-flight preload promise.
    const result = await manager.consume("T-1")
    expect(result).toEqual({
      message: {
        content: '[Nowledge Mem Context Bundle]\n{"bundle":true}',
        display: false,
      },
    })
  })

  it("does not re-fetch when preload is called twice for the same thread", async () => {
    const calls: string[][] = []
    const nmem = ((args: readonly string[]) => {
      calls.push([...args])
      return Promise.resolve('{"ok":true}')
    }) as NmemCli
    const manager = new BootstrapManager({ nmem }, { sourceApp: "amp", enabled: true })
    manager.preload("T-1")
    manager.preload("T-1")
    await manager.consume("T-1")
    expect(calls).toHaveLength(1)
  })
})
