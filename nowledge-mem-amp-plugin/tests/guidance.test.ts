import { describe, expect, it } from "vitest"

import { BEHAVIORAL_GUIDANCE } from "../src/guidance"

describe("BEHAVIORAL_GUIDANCE", () => {
  it("is a non-empty string", () => {
    expect(typeof BEHAVIORAL_GUIDANCE).toBe("string")
    expect(BEHAVIORAL_GUIDANCE.length).toBeGreaterThan(0)
  })

  it("documents each tool by name", () => {
    for (const toolName of [
      "nowledge_mem_context_bundle",
      "nowledge_mem_working_memory",
      "nowledge_mem_search",
      "nowledge_mem_update",
      "nowledge_mem_thread_search",
      "nowledge_mem_save_thread",
    ]) {
      expect(BEHAVIORAL_GUIDANCE).toContain(toolName)
    }
  })
})
