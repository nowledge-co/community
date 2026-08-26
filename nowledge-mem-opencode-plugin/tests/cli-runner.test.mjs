import assert from "node:assert/strict"
import test from "node:test"

import { createNmemCliRunner } from "../src/cli-runner.mjs"

test("Node fallback invokes nmem with exact argv", async () => {
  let invocation
  const execFile = (file, args, options, callback) => {
    invocation = { file, args, options }
    callback(null, '{"ok":true}\n', "")
  }

  const run = createNmemCliRunner(undefined, execFile)
  const output = await run(["m", "search", "project one", "$(touch nope)"])

  assert.equal(output, '{"ok":true}\n')
  assert.deepEqual(invocation, {
    file: "nmem",
    args: ["--json", "m", "search", "project one", "$(touch nope)"],
    options: { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  })
})

test("Bun shell remains the preferred CLI transport", async () => {
  let template
  const shell = (strings, ...values) => {
    template = { strings: [...strings], values }
    return { text: async () => "bun-result" }
  }
  const execFile = () => assert.fail("Node fallback must not run when Bun shell is available")

  const run = createNmemCliRunner(shell, execFile)
  const args = ["wm", "--space", "Project One"]

  assert.equal(await run(args), "bun-result")
  assert.deepEqual(template.values, [args])
})

test("Windows resolves the Rust executable behind the desktop cmd wrapper", async () => {
  const calls = []
  const rustExecutable = String.raw`C:\Users\User\AppData\Local\Nowledge Mem\_up_\rust-backend\nmem.exe`
  const wrapper = String.raw`C:\Users\User\AppData\Local\Nowledge Mem\cli\nmem.cmd`
  const execFile = (file, args, options, callback) => {
    calls.push({ file, args, options })
    if (file === "where.exe" && args[0] === "nmem.exe") {
      callback(new Error("not found"), "", "")
    } else if (file === "where.exe" && args[0] === "nmem.cmd") {
      callback(null, `${wrapper}\r\n`, "")
    } else {
      callback(null, "{\"ok\":true}\n", "")
    }
  }
  const readFile = (path) => {
    assert.equal(path, wrapper)
    return `@echo off\r\n"${rustExecutable}" %*\r\n`
  }
  const run = createNmemCliRunner(undefined, execFile, {
    platform: "win32",
    readFileImpl: readFile,
    existsImpl: (path) => path === rustExecutable,
  })

  assert.equal(await run(["m", "search", "project one", "& unsafe"]), '{"ok":true}\n')
  assert.equal(calls.at(-1).file, rustExecutable)
  assert.deepEqual(calls.at(-1).args, ["--json", "m", "search", "project one", "& unsafe"])
  assert.deepEqual(calls.at(-1).options, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
})

test("Node fallback preserves stderr on process failures", async () => {
  const execFile = (_file, _args, _options, callback) => {
    const error = new Error("nmem exited with status 1")
    callback(error, "", "server unavailable")
  }

  const run = createNmemCliRunner(undefined, execFile)

  await assert.rejects(run(["status"]), (error) => {
    assert.equal(error.stderr, "server unavailable")
    return true
  })
})
