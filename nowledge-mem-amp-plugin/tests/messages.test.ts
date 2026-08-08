import { describe, expect, it } from "vitest"

import {
  captureSignature,
  extractMessageContent,
  lastExternalId,
  normalizeMessages,
  safeTimestamp,
  toThreadMessages,
} from "../src/messages"
import type { SdkMessage, SdkMessagePart } from "../src/messages"

describe("extractMessageContent", () => {
  it("extracts text from text parts using the content field", () => {
    const parts: SdkMessagePart[] = [{ type: "text", content: "hello" }]
    expect(extractMessageContent(parts)).toBe("hello")
  })

  it("extracts text using the text field when content is absent", () => {
    const parts: SdkMessagePart[] = [{ type: "text", text: "via text field" }]
    expect(extractMessageContent(parts)).toBe("via text field")
  })

  it("renders tool parts with the tool name", () => {
    const parts: SdkMessagePart[] = [{ type: "tool", tool: "edit_file" }]
    expect(extractMessageContent(parts)).toBe("[Tool: edit_file]")
  })

  it("marks failed tool calls", () => {
    const parts: SdkMessagePart[] = [{ type: "tool", name: "bash", state: "error" }]
    expect(extractMessageContent(parts)).toBe("[Tool: bash (failed)]")
  })

  it("falls back to 'unknown' for tool parts without a name", () => {
    const parts: SdkMessagePart[] = [{ type: "tool" }]
    expect(extractMessageContent(parts)).toBe("[Tool: unknown]")
  })

  it("wraps reasoning parts in thinking tags", () => {
    const parts: SdkMessagePart[] = [{ type: "reasoning", content: "considering options" }]
    expect(extractMessageContent(parts)).toBe("<thinking>\nconsidering options\n</thinking>")
  })

  it("uses the text field for reasoning when content is absent", () => {
    const parts: SdkMessagePart[] = [{ type: "reasoning", text: "alt reasoning" }]
    expect(extractMessageContent(parts)).toBe("<thinking>\nalt reasoning\n</thinking>")
  })

  it("drops reasoning parts that carry no content", () => {
    const parts: SdkMessagePart[] = [{ type: "reasoning" }]
    expect(extractMessageContent(parts)).toBe("(empty message)")
  })

  it("renders file parts preferring filename", () => {
    const parts: SdkMessagePart[] = [{ type: "file", filename: "readme.md" }]
    expect(extractMessageContent(parts)).toBe("[File: readme.md]")
  })

  it("renders file parts falling back to path", () => {
    const parts: SdkMessagePart[] = [{ type: "file", path: "/abs/path" }]
    expect(extractMessageContent(parts)).toBe("[File: /abs/path]")
  })

  it("renders file parts with a placeholder when neither is set", () => {
    const parts: SdkMessagePart[] = [{ type: "file" }]
    expect(extractMessageContent(parts)).toBe("[File: attachment]")
  })

  it("renders patch parts preferring path", () => {
    const parts: SdkMessagePart[] = [{ type: "patch", path: "src/index.ts" }]
    expect(extractMessageContent(parts)).toBe("[Patch: src/index.ts]")
  })

  it("renders patch parts with a placeholder when path is absent", () => {
    const parts: SdkMessagePart[] = [{ type: "patch" }]
    expect(extractMessageContent(parts)).toBe("[Patch: file change]")
  })

  it("drops structural parts", () => {
    const parts: SdkMessagePart[] = [
      { type: "step-start" },
      { type: "step-finish" },
      { type: "snapshot" },
      { type: "compaction" },
      { type: "retry" },
      { type: "agent" },
      { type: "subtask" },
    ]
    expect(extractMessageContent(parts)).toBe("(empty message)")
  })

  it("drops parts with an absent type", () => {
    const parts: SdkMessagePart[] = [{ type: undefined }]
    expect(extractMessageContent(parts)).toBe("(empty message)")
  })

  it("combines multiple content-bearing parts with newlines", () => {
    const parts: SdkMessagePart[] = [
      { type: "text", content: "first" },
      { type: "tool", tool: "ls" },
      { type: "text", content: "second" },
    ]
    expect(extractMessageContent(parts)).toBe("first\n[Tool: ls]\nsecond")
  })

  it("drops text parts with empty content", () => {
    const parts: SdkMessagePart[] = [{ type: "text", content: "" }, { type: "text", text: "kept" }]
    expect(extractMessageContent(parts)).toBe("kept")
  })

  it("returns the placeholder for an empty part array", () => {
    expect(extractMessageContent([])).toBe("(empty message)")
  })

  it("throws on a genuinely unhandled type via assertNever", () => {
    // Cast to bypass the compiler so the runtime exhaustiveness guard is hit.
    const parts = [{ type: "totally-unknown" }] as unknown as SdkMessagePart[]
    expect(() => extractMessageContent(parts)).toThrow(/Unhandled message part type/)
  })
})

describe("safeTimestamp", () => {
  it("parses an ISO string", () => {
    expect(safeTimestamp("2026-01-02T03:04:05Z")).toBe("2026-01-02T03:04:05.000Z")
  })

  it("falls back to now for undefined", () => {
    const before = Date.now()
    const result = safeTimestamp(undefined)
    const after = Date.now()
    const parsed = new Date(result).getTime()
    expect(parsed).toBeGreaterThanOrEqual(before)
    expect(parsed).toBeLessThanOrEqual(after)
  })

  it("falls back to now for null", () => {
    const before = Date.now()
    const result = safeTimestamp(null)
    const after = Date.now()
    const parsed = new Date(result).getTime()
    expect(parsed).toBeGreaterThanOrEqual(before)
    expect(parsed).toBeLessThanOrEqual(after)
  })

  it("falls back to now for an unparseable value", () => {
    const before = Date.now()
    const result = safeTimestamp("not-a-date")
    const after = Date.now()
    const parsed = new Date(result).getTime()
    expect(parsed).toBeGreaterThanOrEqual(before)
    expect(parsed).toBeLessThanOrEqual(after)
  })

  it("accepts a numeric timestamp", () => {
    expect(safeTimestamp(0)).toBe("1970-01-01T00:00:00.000Z")
  })
})

describe("normalizeMessages", () => {
  it("returns an array input filtered to objects", () => {
    const input = [{ id: "1" }, null, "str", 42, { id: "2" }]
    expect(normalizeMessages(input)).toEqual([{ id: "1" }, { id: "2" }])
  })

  it("unwraps { data } wrappers", () => {
    expect(normalizeMessages({ data: [{ id: "1" }] })).toEqual([{ id: "1" }])
  })

  it("unwraps { items } wrappers", () => {
    expect(normalizeMessages({ items: [{ id: "1" }] })).toEqual([{ id: "1" }])
  })

  it("unwraps { messages } wrappers", () => {
    expect(normalizeMessages({ messages: [{ id: "1" }] })).toEqual([{ id: "1" }])
  })

  it("returns an empty array for non-array wrapper values", () => {
    expect(normalizeMessages({ data: "not-an-array" })).toEqual([])
  })

  it("returns an empty array for unrelated inputs", () => {
    expect(normalizeMessages("string")).toEqual([])
    expect(normalizeMessages(42)).toEqual([])
    expect(normalizeMessages(null)).toEqual([])
    expect(normalizeMessages(undefined)).toEqual([])
    expect(normalizeMessages({})).toEqual([])
  })
})

describe("toThreadMessages", () => {
  it("converts messages with full metadata for assistant turns", () => {
    const messages: SdkMessage[] = [
      { role: "assistant", id: "a1", parts: [{ type: "text", content: "hi" }], model: "claude", agent: "bot" },
    ]
    const result = toThreadMessages(messages, { sourceApp: "amp" })
    expect(result).toEqual([
      {
        content: "hi",
        role: "assistant",
        timestamp: expect.any(String),
        metadata: {
          external_id: "amp-msg-a1",
          source_app: "amp",
          agent: "bot",
          model: "claude",
        },
      },
    ])
  })

  it("folds non-user roles to assistant", () => {
    const messages: SdkMessage[] = [
      { role: "info", id: "i1", parts: [{ type: "text", content: "note" }] },
    ]
    const result = toThreadMessages(messages, { sourceApp: "amp" })
    expect(result[0]?.role).toBe("assistant")
    expect(result[0]?.metadata.model).toBeUndefined()
  })

  it("drops messages without an id", () => {
    const messages: SdkMessage[] = [
      { role: "user", parts: [{ type: "text", content: "no id" }] },
      { role: "user", id: "", parts: [{ type: "text", content: "empty id" }] },
      { role: "user", id: "u1", parts: [{ type: "text", content: "with id" }] },
    ]
    const result = toThreadMessages(messages, { sourceApp: "amp" })
    expect(result).toHaveLength(1)
    expect(result[0]?.metadata.external_id).toBe("amp-msg-u1")
  })

  it("handles messages with no parts", () => {
    const messages: SdkMessage[] = [{ role: "user", id: "u1" }]
    const result = toThreadMessages(messages, { sourceApp: "amp" })
    expect(result[0]?.content).toBe("(empty message)")
  })

  it("uses the current time when timestamp is absent", () => {
    const before = Date.now()
    const result = toThreadMessages([{ role: "user", id: "u1", parts: [] }], { sourceApp: "amp" })
    const parsed = new Date(result[0]?.timestamp ?? "").getTime()
    expect(parsed).toBeGreaterThanOrEqual(before)
  })
})

describe("lastExternalId and captureSignature", () => {
  it("returns the last external_id", () => {
    const messages = toThreadMessages(
      [
        { role: "user", id: "u1", parts: [{ type: "text", content: "a" }] },
        { role: "assistant", id: "a1", parts: [{ type: "text", content: "b" }] },
      ],
      { sourceApp: "amp" },
    )
    expect(lastExternalId(messages)).toBe("amp-msg-a1")
  })

  it("returns an empty string when no messages exist", () => {
    expect(lastExternalId([])).toBe("")
  })

  it("builds a count:lastId signature", () => {
    const messages = toThreadMessages(
      [{ role: "user", id: "u1", parts: [{ type: "text", content: "a" }] }],
      { sourceApp: "amp" },
    )
    expect(captureSignature(messages)).toBe("1:amp-msg-u1")
  })

  it("builds a signature with an empty last id when none is present", () => {
    expect(captureSignature([])).toBe("0:")
  })
})
