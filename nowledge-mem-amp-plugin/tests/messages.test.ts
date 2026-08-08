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
  it("extracts text from a text block", () => {
    const parts: SdkMessagePart[] = [{ type: "text", text: "hello" }]
    expect(extractMessageContent(parts)).toBe("hello")
  })

  it("wraps thinking blocks in thinking tags", () => {
    const parts: SdkMessagePart[] = [{ type: "thinking", thinking: "considering options" }]
    expect(extractMessageContent(parts)).toBe("<thinking>\nconsidering options\n</thinking>")
  })

  it("renders tool_use blocks with the tool name", () => {
    const parts: SdkMessagePart[] = [{ type: "tool_use", id: "tu_1", name: "edit_file", input: {} }]
    expect(extractMessageContent(parts)).toBe("[Tool: edit_file]")
  })

  it("renders tool_result blocks with the status", () => {
    const parts: SdkMessagePart[] = [
      { type: "tool_result", toolUseID: "tu_1", status: "done" },
      { type: "tool_result", toolUseID: "tu_2", status: "error" },
    ]
    expect(extractMessageContent(parts)).toBe("[Tool result: done]\n[Tool result: error]")
  })

  it("combines multiple content blocks with newlines", () => {
    const parts: SdkMessagePart[] = [
      { type: "text", text: "first" },
      { type: "tool_use", id: "tu_1", name: "ls", input: {} },
      { type: "text", text: "second" },
    ]
    expect(extractMessageContent(parts)).toBe("first\n[Tool: ls]\nsecond")
  })

  it("skips empty text blocks", () => {
    const parts: SdkMessagePart[] = [{ type: "text", text: "" }, { type: "text", text: "kept" }]
    expect(extractMessageContent(parts)).toBe("kept")
  })

  it("returns the placeholder for an empty block array", () => {
    expect(extractMessageContent([])).toBe("(empty message)")
  })

  it("returns the placeholder when all text blocks are empty", () => {
    const parts: SdkMessagePart[] = [{ type: "text", text: "" }]
    expect(extractMessageContent(parts)).toBe("(empty message)")
  })

  it("throws on a genuinely unhandled block type via assertNever", () => {
    // Cast to bypass the compiler so the runtime exhaustiveness guard is hit.
    const parts = [{ type: "totally-unknown" }] as unknown as SdkMessagePart[]
    expect(() => extractMessageContent(parts)).toThrow(/Unhandled message block type/)
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
      { role: "assistant", id: "a1", parts: [{ type: "text", text: "hi" }], model: "claude", agent: "bot" },
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
      { role: "info", id: "i1", parts: [{ type: "text", text: "note" }] },
    ]
    const result = toThreadMessages(messages, { sourceApp: "amp" })
    expect(result[0]?.role).toBe("assistant")
    expect(result[0]?.metadata.model).toBeUndefined()
  })

  it("drops messages without an id", () => {
    const messages: SdkMessage[] = [
      { role: "user", parts: [{ type: "text", text: "no id" }] },
      { role: "user", id: "", parts: [{ type: "text", text: "empty id" }] },
      { role: "user", id: "u1", parts: [{ type: "text", text: "with id" }] },
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
        { role: "user", id: "u1", parts: [{ type: "text", text: "a" }] },
        { role: "assistant", id: "a1", parts: [{ type: "text", text: "b" }] },
      ],
      { sourceApp: "amp" },
    )
    expect(lastExternalId(messages)).toBe("amp-msg-a1")
  })

  it("returns an empty string when no messages exist", () => {
    expect(lastExternalId([])).toBe("")
  })

  it("builds a count:contentLength:lastId signature", () => {
    const messages = toThreadMessages(
      [{ role: "user", id: "u1", parts: [{ type: "text", text: "a" }] }],
      { sourceApp: "amp" },
    )
    expect(captureSignature(messages)).toBe("1:1:amp-msg-u1")
  })

  it("changes the signature when content changes but ids do not", () => {
    const first = toThreadMessages(
      [{ role: "user", id: "u1", parts: [{ type: "text", text: "a" }] }],
      { sourceApp: "amp" },
    )
    const second = toThreadMessages(
      [{ role: "user", id: "u1", parts: [{ type: "text", text: "updated" }] }],
      { sourceApp: "amp" },
    )
    expect(captureSignature(first)).not.toBe(captureSignature(second))
  })

  it("builds a signature with an empty last id when none is present", () => {
    expect(captureSignature([])).toBe("0:0:")
  })
})
