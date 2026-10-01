import assert from "node:assert/strict"
import test from "node:test"

import { selectAcknowledgedDelta } from "../src/session-delta.ts"
import { extractMessageContent, threadMessageFingerprint, toThreadMessages } from "../src/thread-messages.ts"

const userMessage = {
  type: "user",
  id: "msg_user",
  time: { created: 1_700_000_000_000 },
  text: "What did we decide about the cache?",
  files: [{ name: "context.md" }],
}

const assistantMessage = {
  type: "assistant",
  id: "msg_assistant",
  time: { created: 1_700_000_001_000 },
  agent: "build",
  model: { id: "gpt-5", providerID: "openai" },
  content: [
    { type: "reasoning", text: "checking memory" },
    { type: "text", text: "We chose TTL 60s." },
    { type: "tool", name: "nowledge_mem_search", state: { status: "completed" } },
    { type: "tool", name: "grep", state: { status: "error" } },
  ],
}

test("maps v2 user and assistant messages to Nowledge Mem thread messages", () => {
  assert.deepEqual(toThreadMessages([userMessage, assistantMessage]), [
    {
      content: "What did we decide about the cache?\n[File: context.md]",
      role: "user",
      timestamp: "2023-11-14T22:13:20.000Z",
      metadata: {
        external_id: "opencode-msg-msg_user",
        source_app: "opencode",
      },
    },
    {
      content:
        "<thinking>\nchecking memory\n</thinking>\nWe chose TTL 60s.\n[Tool: nowledge_mem_search]\n[Tool: grep (failed)]",
      role: "assistant",
      timestamp: "2023-11-14T22:13:21.000Z",
      metadata: {
        external_id: "opencode-msg-msg_assistant",
        source_app: "opencode",
        agent: "build",
        model: "gpt-5",
        tool_activities: [
          { name: "nowledge_mem_search", status: "completed" },
          { name: "grep", status: "error", success: false },
        ],
      },
    },
  ])
})

test("skips structural v2 messages that carry no conversation content", () => {
  assert.deepEqual(
    toThreadMessages([
      { type: "system", id: "system-1" },
      { type: "synthetic", id: "synthetic-1" },
      { type: "idle", id: "idle-1" },
      { type: "compaction", id: "compaction-1" },
      { type: "agent-selected", id: "agent-1" },
    ]),
    [],
  )
})

test("omits invalid timestamps and falls back to an empty-message marker", () => {
  assert.deepEqual(toThreadMessages([{ type: "user", id: "u1", text: "", time: { created: "not-a-date" } }]), [
    {
      content: "(empty message)",
      role: "user",
      metadata: {
        external_id: "opencode-msg-u1",
        source_app: "opencode",
      },
    },
  ])
})

test("returns no messages for non-array input", () => {
  assert.deepEqual(toThreadMessages(undefined), [])
  assert.deepEqual(toThreadMessages({ data: [] }), [])
  assert.deepEqual(toThreadMessages(null), [])
})

test("extractMessageContent handles each assistant content part", () => {
  assert.equal(extractMessageContent({ type: "assistant", content: [] }), "(empty message)")
  assert.equal(
    extractMessageContent({
      type: "assistant",
      content: [
        { type: "text", text: "answer" },
        { type: "reasoning", text: "why" },
        { type: "tool", name: "bash", state: { status: "running" } },
      ],
    }),
    "answer\n<thinking>\nwhy\n</thinking>\n[Tool: bash]",
  )
})

const activitiesOf = (...content) =>
  toThreadMessages([{ type: "assistant", id: "msg_tools", content }], true)[0].metadata.tool_activities

test("default capture stores only tool status, even for bash and differently named MCP tools", () => {
  const [message] = toThreadMessages([{ type: "assistant", id: "msg_safe", content: [
    { type: "tool", name: "bash", state: { status: "completed", input: { command: "export TOKEN=secret" }, content: [{ type: "text", text: "secret" }] } },
    { type: "tool", name: "custom_mcp_search", state: { status: "error", input: { token: "secret" }, error: { message: "secret" } } },
  ] }])
  assert.deepEqual(message.metadata.tool_activities, [
    { name: "bash", status: "completed" },
    { name: "custom_mcp_search", status: "error", success: false },
  ])
  assert.ok(!JSON.stringify(message).includes("secret"))
})

test("a tool call keeps its input and output as tool activity beside a bare marker", () => {
  const [message] = toThreadMessages([
    {
      type: "assistant",
      id: "msg_bash",
      content: [
        { type: "text", text: "Checking the tree." },
        {
          type: "tool",
          id: "call_1",
          name: "bash",
          state: {
            status: "completed",
            input: { command: "git status --short", description: "Show status" },
            content: [
              { type: "text", text: "\n M src/index.ts" },
              { type: "file", uri: "file:///tmp/out.txt", mime: "text/plain" },
              { type: "text", text: "?? notes.md\n" },
            ],
            metadata: { exit: 0 },
          },
        },
      ],
    },
  ], true)
  assert.equal(message.content, "Checking the tree.\n[Tool: bash]")
  assert.deepEqual(message.metadata.tool_activities, [
    {
      id: "call_1",
      name: "bash",
      status: "completed",
      input: '{\n  "command": "git status --short",\n  "description": "Show status"\n}',
      output: "```\n M src/index.ts\n?? notes.md\n```",
    },
  ])
})

test("a failed call records its error and stays marked failed", () => {
  const [message] = toThreadMessages([
    {
      type: "assistant",
      id: "msg_grep",
      content: [
        {
          type: "tool",
          id: "call_2",
          name: "grep",
          state: {
            status: "error",
            input: { pattern: "cacheTtl", path: "src" },
            error: { type: "tool", message: " rg: src: No such file or directory " },
          },
        },
        { type: "tool", id: "call_3", name: "read", state: { status: "completed", input: { filePath: "a.ts" }, content: [{ type: "text", text: "export {}" }] } },
      ],
    },
  ], true)
  assert.equal(message.content, "[Tool: grep (failed)]\n[Tool: read]")
  assert.deepEqual(message.metadata.tool_activities, [
    {
      id: "call_2",
      name: "grep",
      status: "error",
      input: '{\n  "pattern": "cacheTtl",\n  "path": "src"\n}',
      success: false,
      error: "rg: src: No such file or directory",
    },
    {
      id: "call_3",
      name: "read",
      status: "completed",
      input: '{\n  "filePath": "a.ts"\n}',
      output: "```\nexport {}\n```",
    },
  ])
})

test("each captured field keeps at most 500 code points", () => {
  const exact = "o".repeat(500)
  // 500 code points but 501 UTF-16 units: the length shortcut does not apply.
  const astralExact = `${"a".repeat(499)}😀`
  const straddling = `${"e".repeat(499)}😀b`
  const [kept, keptAstral, cut] = activitiesOf(
    { type: "tool", name: "bash", state: { status: "error", input: exact, content: [{ type: "text", text: exact }], error: { message: exact } } },
    { type: "tool", name: "bash", state: { status: "error", input: astralExact, content: [{ type: "text", text: astralExact }], error: { message: astralExact } } },
    { type: "tool", name: "bash", state: { status: "error", input: straddling, content: [{ type: "text", text: straddling }], error: { message: straddling } } },
  )
  assert.equal(kept.input, exact)
  assert.equal(kept.output, `\`\`\`\n${exact}\n\`\`\``)
  assert.equal(kept.error, exact)
  assert.equal(keptAstral.input, astralExact)
  assert.equal(keptAstral.output, `\`\`\`\n${astralExact}\n\`\`\``)
  assert.equal(keptAstral.error, astralExact)
  const clipped = `${"e".repeat(499)}😀...`
  assert.equal(cut.input, clipped)
  assert.equal(cut.output, `\`\`\`\n${clipped}\n\`\`\``)
  assert.equal(cut.error, clipped)
})

test("output stays one literal block whatever Markdown or markers it contains", () => {
  const output = "[main 1a2b3c4] fix cache\n\n# not a heading\n```js\n<img src=x onerror=alert(1)>\n```"
  const [activity] = activitiesOf({ type: "tool", name: "bash", state: { status: "completed", input: {}, content: [{ type: "text", text: output }] } })
  assert.equal(activity.output, `\`\`\`\`\n${output}\n\`\`\`\``)
})

test("a tool call without usable payload records only what the host sent", () => {
  assert.deepEqual(
    activitiesOf(
      { type: "tool", name: "bash" },
      { type: "tool", id: "call_s", name: "bash", state: { status: "streaming", input: '{"command":"git' } },
      { type: "tool", name: "edit", state: { status: "completed", input: {}, content: [{ type: "text", text: " \n\t" }] } },
    ),
    [
      { name: "bash" },
      { id: "call_s", name: "bash", status: "streaming", input: '{"command":"git' },
      { name: "edit", status: "completed" },
    ],
  )
  assert.equal(
    toThreadMessages([{ type: "assistant", id: "msg_text", content: [{ type: "text", text: "no tools" }] }], true)[0].metadata.tool_activities,
    undefined,
  )
})

test("the plugin's own Mem tools keep only their status and any error", () => {
  assert.deepEqual(
    activitiesOf(
      {
        type: "tool",
        id: "call_m",
        name: "nowledge_mem_search",
        state: {
          status: "completed",
          input: { query: "cache decision", space: "Personal" },
          content: [{ type: "text", text: "Memory: we chose TTL 60s" }],
        },
      },
      {
        type: "tool",
        name: "nowledge_mem_save",
        state: { status: "error", input: { content: "private note" }, error: { type: "tool", message: "nmem CLI not found" } },
      },
    ),
    [
      { id: "call_m", name: "nowledge_mem_search", status: "completed" },
      { name: "nowledge_mem_save", status: "error", success: false },
    ],
  )
})

test("tool state that changes after capture does not force a full replay", () => {
  const externalId = (message) => message.metadata.external_id
  const turn = (bash) => toThreadMessages([userMessage, { type: "assistant", id: "msg_turn", content: [{ type: "text", text: "Running it." }, bash] }])
  const running = turn({ type: "tool", id: "call_r", name: "bash", state: { status: "running", input: { command: "make" }, metadata: {} } })
  const completed = turn({ type: "tool", id: "call_r", name: "bash", state: { status: "completed", input: { command: "make" }, content: [{ type: "text", text: "ok" }] } })

  const first = selectAcknowledgedDelta(running, undefined, externalId, threadMessageFingerprint)
  const next = selectAcknowledgedDelta(completed, first.next, externalId, threadMessageFingerprint)
  assert.equal(next.reset, false)
  assert.deepEqual(next.messages, [])

  const edited = toThreadMessages([userMessage, { type: "assistant", id: "msg_turn", content: [{ type: "text", text: "Ran it." }] }])
  assert.equal(selectAcknowledgedDelta(edited, first.next, externalId, threadMessageFingerprint).reset, true)
})
