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
