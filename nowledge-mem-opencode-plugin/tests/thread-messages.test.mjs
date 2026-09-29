import assert from "node:assert/strict"
import test from "node:test"

import { extractMessageContent, toThreadMessages } from "../src/thread-messages.ts"

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

const toolLine = (part) => extractMessageContent({ type: "assistant", content: [part] })

test("a completed bash call keeps its command and output", () => {
  assert.equal(
    toolLine({
      type: "tool",
      name: "bash",
      state: {
        status: "completed",
        input: { command: "git status --short", description: "Show status" },
        content: [
          { type: "text", text: " M src/index.ts" },
          { type: "file", uri: "file:///tmp/out.txt", mime: "text/plain" },
          { type: "text", text: "?? notes.md" },
        ],
        metadata: { exit: 0 },
      },
    }),
    "[Tool: bash] $ git status --short\nM src/index.ts\n?? notes.md",
  )
})

test("a bash call reports a non-zero exit and bounds long command and output", () => {
  const command = "c".repeat(201)
  const output = "o".repeat(501)
  assert.equal(
    toolLine({
      type: "tool",
      name: "bash",
      state: {
        status: "completed",
        input: { command },
        content: [{ type: "text", text: output }],
        metadata: { exit: 2 },
      },
    }),
    `[Tool: bash] $ ${"c".repeat(200)}... (exit=2)\n${"o".repeat(500)}...`,
  )
})

test("a failed call keeps the failure marker and adds its input and error", () => {
  assert.equal(
    toolLine({
      type: "tool",
      name: "grep",
      state: {
        status: "error",
        input: { pattern: "cacheTtl", path: "src" },
        error: { type: "tool", message: "e".repeat(201) },
      },
    }),
    `[Tool: grep (failed)] Pattern: cacheTtl in src — Error: ${"e".repeat(200)}`,
  )
})

test("other tools summarize their input without attaching output", () => {
  assert.equal(
    toolLine({
      type: "tool",
      name: "read",
      state: {
        status: "completed",
        input: { filePath: "src/index.ts" },
        content: [{ type: "text", text: "file body" }],
      },
    }),
    "[Tool: read] File: src/index.ts",
  )
  assert.equal(
    toolLine({
      type: "tool",
      name: "glob",
      state: {
        status: "completed",
        input: { pattern: "**/*.ts" },
        content: [{ type: "text", text: "a.ts" }],
        metadata: { count: 3 },
      },
    }),
    "[Tool: glob] Pattern: **/*.ts (3 files)",
  )
})

test("a tool call without usable payload stays a bare marker", () => {
  assert.equal(toolLine({ type: "tool", name: "bash" }), "[Tool: bash]")
  assert.equal(
    toolLine({ type: "tool", name: "bash", state: { status: "completed", input: {}, content: [{ type: "text", text: "  " }] } }),
    "[Tool: bash]",
  )
  assert.equal(
    toolLine({ type: "tool", name: "bash", state: { status: "streaming", input: "{\"command\":\"git" } }),
    "[Tool: bash]",
  )
})
