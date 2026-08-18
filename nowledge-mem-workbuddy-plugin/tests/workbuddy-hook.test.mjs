import assert from "node:assert/strict";
import test from "node:test";

import { buildCaptureArgs } from "../scripts/nowledge-mem-hook.mjs";


test("automatic sync uses the shared durable capture queue", () => {
  assert.deepEqual(buildCaptureArgs("session-1", "C:\\sessions\\one.jsonl"), [
    "--json",
    "t",
    "capture",
    "--from",
    "workbuddy",
    "--session-id",
    "session-1",
    "--transcript-path",
    "C:\\sessions\\one.jsonl",
    "--sync",
    "--all-projects",
  ]);
});
