import assert from "node:assert/strict";
import test from "node:test";
import { resolveThreadSyncTimeoutMs } from "../src/timeout.ts";

test("all invalid configuration values use the existing two-minute default", () => {
  for (const raw of [undefined, "", " ", "not-a-number", "0", "-1", "120000.5", "Infinity", "9007199254740992"]) {
    assert.equal(resolveThreadSyncTimeoutMs(raw), 120_000);
  }
});

test("positive integer timeouts clamp to the existing bounds", () => {
  for (const [raw, expected] of [["1", 1_000], ["1000", 1_000], [" 2500 ", 2_500], ["120000", 120_000], ["1800000", 1_800_000], ["2000000", 1_800_000]] as const) {
    assert.equal(resolveThreadSyncTimeoutMs(raw), expected);
  }
});
