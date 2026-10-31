import assert from "node:assert/strict"
import http from "node:http"
import test from "node:test"
import { setImmediate as nextTurn } from "node:timers/promises"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import plugin from "../src/index.ts"

function createFakeContext({ sessionContext, events = [], options = {} } = {}) {
  const tools = []
  const hooks = new Map()
  const ctx = {
    location: { directory: "/tmp/nowledge-project", project: { id: "project-1" } },
    options,
    tool: {
      transform: async (callback) => {
        callback({ add: (tool) => tools.push(tool) })
        return { dispose: async () => {} }
      },
    },
    session: {
      context: sessionContext ?? (async () => []),
      hook: async (name, callback) => {
        hooks.set(name, callback)
        return { dispose: async () => {} }
      },
    },
    event: {
      subscribe: () =>
        (async function* () {
          for await (const event of events) yield event
        })(),
    },
  }
  return { ctx, tools, hooks }
}

async function withEnv(vars, run) {
  const previous = new Map()
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return await run()
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

async function withContextChoiceProfile(run) {
  const root = mkdtempSync(join(tmpdir(), "nmem-context-choice-"))
  try {
    return await withEnv({
      HOME: root, USERPROFILE: root, NMEM_API_URL: "http://127.0.0.1:1",
      NMEM_API_KEY: "synthetic-context-choice", NMEM_SPACE: undefined,
      NMEM_SPACE_ID: undefined, NMEM_AGENT_ID: undefined, NMEM_HOST_AGENT_ID: undefined,
    }, run)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test("session context choice: default and explicit automatic retain guidance", async () => {
  await withContextChoiceProfile(async () => {
    const outputs = []
    for (const options of [{}, { sessionContext: "automatic" }]) {
      const { ctx, tools, hooks } = createFakeContext({ options })
      const cleanup = await plugin.setup(ctx)
      try {
        const event = { system: [] }
        await hooks.get("context")(event)
        assert.match(event.system[0].text, /At session start/)
        assert.match(event.system[0].text, /Use them proactively/)
        outputs.push({ system: event.system, descriptions: tools.map(tool => tool.description) })
      } finally { await cleanup() }
    }
    assert.deepEqual(outputs[0], outputs[1])
  })
})

test("session context choice: off omits automatic guidance and preserves tools", async () => {
  await withContextChoiceProfile(async () => {
    let reads = 0
    const { ctx, tools, hooks } = createFakeContext({ options: { sessionContext: "off" },
      sessionContext: async () => { reads++; return [] } })
    const cleanup = await plugin.setup(ctx)
    try {
      assert.equal(hooks.has("context"), false, "sessionContext off must not register automatic context guidance")
      assert.equal(reads, 0)
      assert.equal(tools.length, 9)
      assert.equal(typeof hooks.get("compaction"), "function")
      for (const name of ["context_bundle", "working_memory", "search", "thread_search"]) {
        const tool = tools.find(tool => tool.name === `nowledge_mem_${name}`)
        assert.equal(typeof tool.execute, "function")
        assert.match(tool.description, /only when explicitly requested/)
        assert.doesNotMatch(tool.description, /proactively|near session start|full startup/)
      }
    } finally { await cleanup() }
  })
})

test("session context choice: invalid values fail before registration", async () => {
  await withContextChoiceProfile(async () => {
    for (const sessionContext of [null, false, "", "manual", "OFF", []]) {
      const { ctx, tools, hooks } = createFakeContext({ options: { sessionContext } })
      await assert.rejects(plugin.setup(ctx), /sessionContext must be 'automatic' or 'off'/)
      assert.deepEqual(tools, [])
      assert.equal(hooks.size, 0)
    }
  })
})

test("session context choice: off keeps capture governed by its own switch", async t => {
  await withContextChoiceProfile(async () => {
    const requests = []
    t.mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(url, "http://127.0.0.1:1/threads")
      const body = JSON.parse(init.body)
      requests.push(body)
      return Response.json({ thread: { thread_id: body.thread_id, message_count: body.messages.length } })
    })
    for (const enabled of [true, false]) {
      let reads = 0
      requests.length = 0
      await withEnv({ NMEM_OPENCODE_AUTO_SYNC: String(enabled) }, async () => {
        const { ctx, hooks } = createFakeContext({ options: { sessionContext: "off" },
          sessionContext: async () => {
            reads++
            return [{ type: "user", id: "u1", text: "Synthetic public work", time: { created: 1 } },
              { type: "assistant", id: "a1", content: [{ type: "text", text: "Synthetic answer" }], time: { created: 2 } }]
          } })
        const cleanup = await plugin.setup(ctx)
        try {
          const event = { sessionID: `context-choice-${enabled}`, system: [] }
          await hooks.get("compaction")(event)
          assert.deepEqual(event.system, [])
          assert.equal(reads, enabled ? 1 : 0)
          assert.equal(requests.length, enabled ? 1 : 0)
          if (enabled) assert.equal(requests[0].messages.length, 2)
        } finally { await cleanup() }
      })
    }
  })
})

test("registers every Nowledge Mem tool through the v2 tool transform", async () => {
  const { ctx, tools } = createFakeContext()

  const cleanup = await plugin.setup(ctx)

  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    [
      "nowledge_mem_context_bundle",
      "nowledge_mem_save",
      "nowledge_mem_save_handoff",
      "nowledge_mem_save_thread",
      "nowledge_mem_search",
      "nowledge_mem_status",
      "nowledge_mem_thread_search",
      "nowledge_mem_update",
      "nowledge_mem_working_memory",
    ],
  )
  for (const tool of tools) {
    assert.equal(typeof tool.description, "string")
    assert.equal(typeof tool.execute, "function")
    assert.equal(tool.input.type, "object")
    assert.equal(tool.input.additionalProperties, false)
  }

  assert.equal(typeof cleanup, "function")
  await cleanup()
})

test("registers context guidance and keeps compaction focused on flushing", async () => {
  const { ctx, hooks } = createFakeContext()

  await plugin.setup(ctx)

  const contextEvent = { system: [] }
  await hooks.get("context")(contextEvent)
  assert.match(contextEvent.system[0].text, /Nowledge Mem/)
  assert.equal(contextEvent.system[0].type, "text")

  const compactionEvent = { sessionID: "session-1", system: [] }
  await hooks.get("compaction")(compactionEvent)
  assert.deepEqual(compactionEvent.system, [])
})

test("disabling automatic sync also disables pre-compaction capture", async () => {
  let reads = 0
  await withEnv({ NMEM_OPENCODE_AUTO_SYNC: "false" }, async () => {
    const { ctx, hooks } = createFakeContext({ sessionContext: async () => { reads += 1; return [] } })
    const cleanup = await plugin.setup(ctx)
    await hooks.get("compaction")({ sessionID: "session-1", system: [] })
    await cleanup()
  })
  assert.equal(reads, 0)
})

test("schedules capture only for idle events on the v2 event stream", async () => {
  const observed = []
  const events = [
    { type: "session.idle", data: { sessionID: "session-idle" } },
    { type: "session.status", data: { sessionID: "session-busy", status: { type: "busy" } } },
    { type: "session.status", data: { sessionID: "session-status-idle", status: { type: "idle" } } },
  ]
  const { ctx } = createFakeContext({
    events,
    sessionContext: async ({ sessionID }) => {
      observed.push(sessionID)
      return []
    },
  })

  await withEnv({ NMEM_OPENCODE_AUTO_SYNC_DEBOUNCE_MS: "250" }, async () => {
    const cleanup = await plugin.setup(ctx)
    await new Promise((resolve) => setTimeout(resolve, 450))
    await cleanup()
  })

  assert.ok(observed.includes("session-idle"), `missing session.idle capture: ${observed}`)
  assert.ok(observed.includes("session-status-idle"), `missing session.status idle capture: ${observed}`)
  assert.ok(!observed.includes("session-busy"), `busy status should not capture: ${observed}`)
})

test("captures execution completion and deduplicates repeated and legacy events", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const requests = []
  const reads = []
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) })
    return Response.json({ thread: { thread_id: "opencode-ses_Completed", message_count: 2 } })
  })
  let replay
  const replayReady = new Promise((resolve) => { replay = resolve })
  const completion = {
    type: "session.execution.succeeded",
    data: { sessionID: "ses_Completed" },
    location: { directory: "/tmp/completed-worktree" },
  }
  const { ctx } = createFakeContext({
    events: (async function* () {
      yield completion
      await replayReady
      yield completion
      yield { ...completion, type: "session.idle" }
      yield { ...completion, type: "session.status", data: { ...completion.data, status: { type: "idle" } } }
    })(),
    sessionContext: async ({ sessionID }) => {
      reads.push(sessionID)
      return [
        { type: "user", id: "u1", time: { created: 1 }, text: "hello" },
        { type: "assistant", id: "a1", time: { created: 2 }, content: [{ type: "text", text: "hi" }] },
      ]
    },
  })
  await withEnv({
    NMEM_API_URL: "http://127.0.0.1:14242",
    NMEM_API_KEY: "synthetic-key",
    NMEM_SPACE: "event-test-space",
    NMEM_OPENCODE_AUTO_SYNC: "true",
    NMEM_OPENCODE_AUTO_SYNC_DEBOUNCE_MS: "250",
  }, async () => {
    const cleanup = await plugin.setup(ctx)
    try {
      await nextTurn()
      t.mock.timers.tick(250)
      await nextTurn()
      assert.equal(requests.length, 1, "completion must persist the conversation")
      assert.equal(requests[0].url, "http://127.0.0.1:14242/threads")
      const body = requests[0].body
      assert.equal(body.thread_id, "opencode-ses_Completed")
      assert.deepEqual(body.messages.map(({ role, content }) => ({ role, content })), [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ])
      assert.equal(body.project, "/tmp/completed-worktree")
      assert.equal(body.workspace, "/tmp/completed-worktree")
      assert.equal(body.space_id, "event-test-space")
      assert.equal(body.metadata.sync_reason, "session_execution_succeeded")
      assert.equal(body.metadata.live_capture, true)

      replay()
      await nextTurn()
      t.mock.timers.tick(250)
      await nextTurn()
      assert.deepEqual(reads, ["ses_Completed", "ses_Completed"])
      assert.equal(requests.length, 1, "acknowledged messages must not be saved again")
    } finally {
      replay()
      await cleanup()
    }
  })
})

for (const disabled of [false, true]) {
  test(`execution events respect eligibility and auto-sync disabled=${disabled}`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const reads = []
    const events = [
      { type: "session.execution.started", data: { sessionID: "running" } },
      { type: "session.execution.failed", data: { sessionID: "failed" } },
      { type: "session.execution.succeeded", data: {} },
      { type: "session.execution.succeeded", data: { sessionID: "" } },
    ]
    if (disabled) events.push({ type: "session.execution.succeeded", data: { sessionID: "disabled" } })
    const { ctx } = createFakeContext({
      events,
      sessionContext: async ({ sessionID }) => { reads.push(sessionID); return [] },
    })
    await withEnv({
      NMEM_OPENCODE_AUTO_SYNC: disabled ? "false" : "true",
      NMEM_OPENCODE_AUTO_SYNC_DEBOUNCE_MS: "250",
    }, async () => {
      const cleanup = await plugin.setup(ctx)
      try {
        await nextTurn()
        t.mock.timers.tick(250)
        await nextTurn()
        assert.deepEqual(reads, [])
      } finally {
        await cleanup()
      }
    })
  })
}

test("attributes idle capture to the event location instead of the plugin load location", async () => {
  const requests = []
  const server = http.createServer((request, response) => {
    let body = ""
    request.on("data", (chunk) => {
      body += chunk
    })
    request.on("end", () => {
      requests.push({ url: request.url, body: JSON.parse(body || "{}") })
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify({ thread: { thread_id: "opencode-session-worktree", message_count: 2 } }))
    })
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

  try {
    await withEnv(
      {
        NMEM_API_URL: `http://127.0.0.1:${server.address().port}`,
        NMEM_OPENCODE_AUTO_SYNC_DEBOUNCE_MS: "250",
      },
      async () => {
        const { ctx } = createFakeContext({
          events: [
            {
              type: "session.idle",
              location: { directory: "/tmp/nowledge-worktree" },
              data: { sessionID: "session-worktree" },
            },
          ],
          sessionContext: async () => [
            { type: "user", id: "u1", time: { created: 1 }, text: "hello" },
            {
              type: "assistant",
              id: "a1",
              time: { created: 2 },
              agent: "build",
              model: { id: "gpt-5" },
              content: [{ type: "text", text: "hi" }],
            },
          ],
        })
        const cleanup = await plugin.setup(ctx)
        await new Promise((resolve) => setTimeout(resolve, 450))
        await cleanup()
      },
    )

    const createRequest = requests.find((request) => request.url === "/threads")
    assert.equal(createRequest.body.project, "/tmp/nowledge-worktree")
    assert.equal(createRequest.body.workspace, "/tmp/nowledge-worktree")
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test("a tool finishing after capture does not re-send the session", async () => {
  const requests = []
  const server = http.createServer((request, response) => {
    let body = ""
    request.on("data", (chunk) => {
      body += chunk
    })
    request.on("end", () => {
      requests.push({ url: request.url, body: JSON.parse(body || "{}") })
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify({ thread: { thread_id: "opencode-session-1", message_count: 2 } }))
    })
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

  try {
    await withEnv({ NMEM_API_URL: `http://127.0.0.1:${server.address().port}`, NMEM_OPENCODE_CAPTURE_TOOL_DETAILS: "true" }, async () => {
      let bashState = { status: "running", input: { command: "make" }, metadata: {} }
      const { ctx, hooks } = createFakeContext({
        sessionContext: async () => [
          { type: "user", id: "u1", time: { created: 1 }, text: "build it" },
          {
            type: "assistant",
            id: "a1",
            time: { created: 2 },
            content: [
              { type: "text", text: "Building." },
              { type: "tool", id: "call_1", name: "bash", state: bashState },
            ],
          },
        ],
      })
      const cleanup = await plugin.setup(ctx)
      await hooks.get("compaction")({ sessionID: "session-1", system: [] })
      bashState = { status: "completed", input: { command: "make" }, content: [{ type: "text", text: "ok" }] }
      await hooks.get("compaction")({ sessionID: "session-1", system: [] })
      await cleanup()
    })

    assert.deepEqual(requests.map((request) => request.url), ["/threads"])
    assert.equal(requests[0].body.messages[1].metadata.tool_activities[0].status, "running")
    assert.match(requests[0].body.messages[1].metadata.tool_activities[0].input, /make/)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test("save_thread reads ctx.session.context and returns a content payload", async () => {
  const requests = []
  const server = http.createServer((request, response) => {
    let body = ""
    request.on("data", (chunk) => {
      body += chunk
    })
    request.on("end", () => {
      requests.push({ url: request.url, body: JSON.parse(body || "{}") })
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify({ thread: { thread_id: "opencode-session-1", message_count: 2 } }))
    })
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

  try {
    await withEnv({ NMEM_API_URL: `http://127.0.0.1:${server.address().port}` }, async () => {
      const { ctx, tools } = createFakeContext({
        sessionContext: async () => [
          { type: "user", id: "u1", time: { created: 1 }, text: "hello" },
          {
            type: "assistant",
            id: "a1",
            time: { created: 2 },
            agent: "build",
            model: { id: "gpt-5" },
            content: [{ type: "text", text: "hi" }],
          },
        ],
      })
      await plugin.setup(ctx)
      const saveThread = tools.find((tool) => tool.name === "nowledge_mem_save_thread")

      const result = await saveThread.execute({ summary: "test" }, { sessionID: "session-1" })
      const payload = JSON.parse(result.content)

      assert.equal(payload.success, true)
      assert.equal(payload.thread_id, "opencode-session-1")
      assert.equal(requests.at(-1).url, "/threads")
      assert.equal(requests.at(-1).body.thread_id, "opencode-session-1")
      assert.equal(requests.at(-1).body.messages.length, 2)
    })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
