import { describe, expect, it } from "vitest"

import { withAmbientSpace, withAmbientSpaceArg } from "../src/identity"
import type { ResolvedConfig } from "../src/config"

/** Builds a minimal resolved config with the given ambient fields. */
function config(partial: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    apiUrl: "http://127.0.0.1:14242",
    apiKey: undefined,
    ambientSpaceId: undefined,
    ambientAgentId: undefined,
    ambientHostAgentId: undefined,
    autoSyncEnabled: true,
    autoSyncDebounceMs: 1500,
    bootstrapEnabled: true,
    debugLogging: false,
    ...partial,
  }
}

describe("withAmbientSpaceArg", () => {
  it("returns args unchanged when no ambient identity is set", () => {
    const result = withAmbientSpaceArg(["m", "search", "query"], config())
    expect(result).toEqual(["m", "search", "query"])
  })

  it("appends --space for space-scoped commands", () => {
    const result = withAmbientSpaceArg(["m", "search", "query"], config({ ambientSpaceId: "Research" }))
    expect(result).toEqual(["m", "search", "query", "--space", "Research"])
  })

  it("appends --space for the context command with agent identity", () => {
    const result = withAmbientSpaceArg(
      ["context", "--source-app", "amp"],
      config({ ambientSpaceId: "Research", ambientAgentId: "agent-1", ambientHostAgentId: "host-1" }),
    )
    expect(result).toEqual([
      "context",
      "--source-app",
      "amp",
      "--space",
      "Research",
      "--agent-id",
      "agent-1",
      "--host-agent-id",
      "host-1",
    ])
  })

  it("does not append --space for non-scoped commands like status", () => {
    const result = withAmbientSpaceArg(["status"], config({ ambientSpaceId: "Research" }))
    expect(result).toEqual(["status"])
  })

  it("does not duplicate an already-present --space flag", () => {
    const result = withAmbientSpaceArg(["m", "search", "query", "--space", "Existing"], config({ ambientSpaceId: "Research" }))
    expect(result).toEqual(["m", "search", "query", "--space", "Existing"])
  })

  it("does not duplicate already-present --agent-id / --host-agent-id", () => {
    const result = withAmbientSpaceArg(
      ["context", "--agent-id", "a", "--host-agent-id", "b"],
      config({ ambientAgentId: "x", ambientHostAgentId: "y" }),
    )
    expect(result).toEqual(["context", "--agent-id", "a", "--host-agent-id", "b"])
  })

  it("only applies agent identity to context/ctx commands", () => {
    const result = withAmbientSpaceArg(["m", "add", "content"], config({ ambientAgentId: "agent-1", ambientSpaceId: undefined }))
    expect(result).toEqual(["m", "add", "content"])
  })

  it("handles an empty args array", () => {
    const result = withAmbientSpaceArg([], config({ ambientSpaceId: "Research" }))
    expect(result).toEqual([])
  })
})

describe("withAmbientSpace", () => {
  it("adds space_id to a plain object body", () => {
    const result = withAmbientSpace({ messages: [] }, config({ ambientSpaceId: "Research" }))
    expect(result).toEqual({ messages: [], space_id: "Research" })
  })

  it("does not overwrite an existing space_id", () => {
    const result = withAmbientSpace({ space_id: "Existing", messages: [] }, config({ ambientSpaceId: "Research" }))
    expect(result).toEqual({ space_id: "Existing", messages: [] })
  })

  it("returns the body unchanged when no ambient space is set", () => {
    const result = withAmbientSpace({ messages: [] }, config())
    expect(result).toEqual({ messages: [] })
  })

  it("returns null unchanged", () => {
    const result = withAmbientSpace(null, config({ ambientSpaceId: "Research" }))
    expect(result).toBeNull()
  })

  it("returns arrays unchanged", () => {
    const body = [1, 2, 3]
    const result = withAmbientSpace(body, config({ ambientSpaceId: "Research" }))
    expect(result).toBe(body)
  })

  it("returns primitives unchanged", () => {
    const result = withAmbientSpace("string-body", config({ ambientSpaceId: "Research" }))
    expect(result).toBe("string-body")
  })
})
