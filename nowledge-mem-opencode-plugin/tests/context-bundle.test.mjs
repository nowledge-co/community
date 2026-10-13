import assert from "node:assert/strict"
import childProcess from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import plugin from "../src/index.ts"

const contextArgs = ["--json", "context", "--source-app", "opencode", "--space-id", "Case-A"]
const workingMemoryArgs = ["--json", "wm", "read", "--space-id", "Case-A"]

async function runContext(t, payload, { exitCode = 0, env = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "nmem-context-contract-"))
  const argsPath = join(root, "args.jsonl")
  const fixture = join(root, "nmem-fixture.mjs")
  writeFileSync(fixture, [
    'import fs from "node:fs"',
    'const args = process.argv.slice(2)',
    'fs.appendFileSync(process.env.NMEM_TEST_ARGS, JSON.stringify(args) + "\\n")',
    'if (args[1] === "context") {',
    '  process.stdout.write(process.env.NMEM_TEST_CONTEXT)',
    '  process.exitCode = Number(process.env.NMEM_TEST_EXIT_CODE)',
    '  if (process.exitCode) process.stderr.write("Fixture context failure")',
    '} else if (args[1] === "wm" && args[2] === "read") {',
    '  process.stdout.write("Fixture Working Memory fallback")',
    '} else { throw new Error("Unexpected fixture command") }',
  ].join("\n"))
  const vars = {
    HOME: root,
    USERPROFILE: root,
    NMEM_TEST_ARGS: argsPath,
    NMEM_TEST_CONTEXT: payload,
    NMEM_TEST_EXIT_CODE: String(exitCode),
    NMEM_API_URL: "http://mem.test.invalid",
    NMEM_API_KEY: undefined,
    NMEM_AGENT_ID: undefined,
    NMEM_HOST_AGENT_ID: undefined,
    NMEM_SPACE: undefined,
    NMEM_SPACE_ID: undefined,
    NMEM_OPENCODE_AUTO_SYNC: "false",
    ...env,
  }
  const previous = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]))
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  // Launch the same fixture with native Node on every platform, without a
  // shebang/PATH dependency or access to an installed nmem or user profile.
  const execFile = childProcess.execFile
  const transport = t.mock.method(childProcess, "execFile", (file, args, options, callback) => {
    if (file === "where.exe") {
      assert.deepEqual(args, ["nmem.exe"])
      queueMicrotask(() => callback(null, process.execPath + "\r\n", ""))
      return
    }
    assert.ok(file === "nmem" || file === process.execPath, "Unexpected CLI executable: " + file)
    return execFile(process.execPath, [fixture, ...args], options, callback)
  })
  syncBuiltinESMExports()

  try {
    const tools = []
    const ctx = {
      location: { directory: root, project: { id: "synthetic-context-project" } },
      options: {},
      tool: {
        transform: async callback => {
          callback({ add: tool => tools.push(tool) })
          return { dispose: async () => {} }
        },
      },
      session: {
        context: async () => [],
        hook: async () => ({ dispose: async () => {} }),
      },
      event: { subscribe: () => (async function* () {})() },
    }
    const cleanup = await plugin.setup(ctx)
    try {
      const tool = tools.find(tool => tool.name === "nowledge_mem_context_bundle")
      assert.ok(tool)
      const result = await tool.execute({ space_id: "Case-A" })
      const args = readFileSync(argsPath, "utf8").trim().split("\n").map(JSON.parse)
      return { result, args }
    } finally {
      await cleanup()
    }
  } finally {
    transport.mock.restore()
    syncBuiltinESMExports()
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    rmSync(root, { recursive: true, force: true })
  }
}

const full = {
  schema_version: 1,
  bundle_kind: "context_bundle",
  generated_at: "2026-10-11T00:00:00Z",
  owner_profile: { owner_id: "fixture-owner", custom_instructions: "Keep owner instructions" },
  agent_profile: { agent_id: "fixture-agent", instructions: "Keep agent instructions" },
  active_space: { primary_space_id: "Case-A", instructions: "Keep Space instructions" },
  rule_stack: { global: [{ id: "fixture-rule", body: "Preserve configured rule" }] },
  working_memory: { exists: true, content: "Synthetic priority" },
  kfs_roots: { bundle: "/context/bundle.md" },
  authorship: { owner_id: "fixture-owner", agent_id: "fixture-agent", source_app: "opencode" },
  warnings: ["Keep scope warnings"],
  extensions: { rendered_markdown: "Keep unrelated nested data" },
  compiled_hash: "a".repeat(64),
  rendered_markdown: "Synthetic priority\nKeep owner instructions\nKeep agent instructions",
}

test("registered Context tool removes only duplicate Markdown and retains exact CLI scope", async t => {
  const { result, args } = await runContext(t, JSON.stringify(full))
  const { rendered_markdown, ...expected } = full
  assert.deepEqual(JSON.parse(result.content), expected)
  assert.equal(result.content, JSON.stringify(expected))
  assert.deepEqual(args, [contextArgs])
})

test("registered Context tool preserves nested unsafe numeric tokens verbatim", async t => {
  const template = JSON.stringify({
    ...full,
    extensions: { ...full.extensions, samples: [{ value: "fixture-number" }] },
  }, null, 2)
  // Insert raw tokens so the fixture itself does not round them first.
  for (const token of ["9007199254740992", "9007199254740993", "-9007199254740993", "1e30", "1e400", "-1e400", "1e-400", "-1e-400", "1.0000000000000001", "-1.0000000000000001", "0.10000000000000001", "-0"]) {
    const payload = template.replace('"fixture-number"', token)
    const { result, args } = await runContext(t, payload)
    assert.equal(result.content, payload)
    assert.deepEqual(args, [contextArgs])
  }
})

test("registered Context tool still compacts safe numbers and large numeric strings", async t => {
  const template = JSON.stringify({
    ...full,
    extensions: { ...full.extensions, samples: [{ value: "fixture-number" }] },
  })
  for (const token of ["9007199254740991", "-9007199254740991", "0", "0.5", "1e3", "1.25e-2", "100.00", "1e+0003", '"9007199254740993"', '"escaped \\\" 1e-400 1.0000000000000001"']) {
    const payload = template.replace('"fixture-number"', token)
    const { rendered_markdown, ...expected } = JSON.parse(payload)
    const { result, args } = await runContext(t, payload)
    assert.equal(result.content, JSON.stringify(expected))
    assert.deepEqual(args, [contextArgs])
  }
})

test("registered Context tool preserves absent or omitted Working Memory", async t => {
  for (const working_memory of [{ exists: false, content: "" }, { exists: false, content: "", omitted: true }]) {
    const bundle = { ...full, working_memory }
    const { rendered_markdown, ...expected } = bundle
    const { result, args } = await runContext(t, JSON.stringify(bundle))
    assert.deepEqual(JSON.parse(result.content), expected)
    assert.deepEqual(args, [contextArgs])
  }
})

test("registered Context tool preserves compact, partial, malformed and non-bundle payloads verbatim", async t => {
  const { rendered_markdown, ...compact } = full
  const { owner_profile, ...partial } = full
  const { bundle_kind, ...unidentified } = full
  const { schema_version, ...unversioned } = full
  const payloads = [
    compact,
    partial,
    unidentified,
    unversioned,
    { rendered_markdown: "Only available context" },
    { arbitrary: "Unknown response" },
    { ...full, bundle_kind: "other_bundle" },
    { ...full, schema_version: 2 },
    { ...full, schema_version: "1" },
    { ...full, compiled_hash: null },
    { ...full, rendered_markdown: null },
    [full],
    null,
    1,
    "Legacy JSON text",
  ]
  for (const key of ["owner_profile", "agent_profile", "active_space", "rule_stack", "working_memory", "kfs_roots"]) {
    for (const invalid of [null, [], "Malformed section"]) payloads.push({ ...full, [key]: invalid })
  }
  for (const payload of [...payloads.map(value => JSON.stringify(value, null, 2)), "Plain legacy text", "{malformed JSON"]) {
    const { result, args } = await runContext(t, payload)
    assert.equal(result.content, payload)
    assert.deepEqual(args, [contextArgs])
  }
})

test("registered Context tool preserves scoped Working Memory fallback on CLI errors", async t => {
  for (const [payload, exitCode] of [[JSON.stringify({ error: "Context unavailable" }), 0], ["", 1]]) {
    const { result, args } = await runContext(t, payload, { exitCode })
    assert.equal(result.content, "Fixture Working Memory fallback")
    assert.deepEqual(args, [contextArgs, workingMemoryArgs])
  }
})

test("registered Context tool retains ambient identity and explicit Space precedence", async t => {
  const { result, args } = await runContext(t, JSON.stringify(full), {
    env: { NMEM_SPACE: "Ambient Space", NMEM_AGENT_ID: "fixture-agent", NMEM_HOST_AGENT_ID: "fixture-host" },
  })
  const { rendered_markdown, ...expected } = full
  assert.deepEqual(JSON.parse(result.content), expected)
  assert.deepEqual(args, [[...contextArgs, "--agent-id", "fixture-agent", "--host-agent-id", "fixture-host"]])
})
