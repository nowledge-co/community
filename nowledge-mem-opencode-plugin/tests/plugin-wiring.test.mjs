import assert from "node:assert/strict"
import http from "node:http"
import test from "node:test"

import plugin from "../src/index.ts"

function createFakeContext({ sessionContext, events = [] } = {}) {
  const tools = []
  const hooks = new Map()
  const ctx = {
    location: { directory: "/tmp/nowledge-project", project: { id: "project-1" } },
    options: {},
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
          for (const event of events) yield event
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

test("registers the context and compaction hooks and injects guidance", async () => {
  const { ctx, hooks } = createFakeContext()

  await plugin.setup(ctx)

  const contextEvent = { system: [] }
  await hooks.get("context")(contextEvent)
  assert.match(contextEvent.system[0].text, /Nowledge Mem/)
  assert.equal(contextEvent.system[0].type, "text")

  const compactionEvent = { sessionID: "session-1", system: [] }
  await hooks.get("compaction")(compactionEvent)
  assert.match(compactionEvent.system[0].text, /After compaction/)
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
