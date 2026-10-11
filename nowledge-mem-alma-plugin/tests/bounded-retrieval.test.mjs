import test from "node:test";
import assert from "node:assert/strict";
import { NowledgeMemClient } from "../main.js";

test("thread reads default to eight messages and preserve explicit ranges", async () => {
    const client = Object.create(NowledgeMemClient.prototype);
    const calls = [];
    client._fetch = async (...args) => { calls.push(args); return {}; };
    await client.showThread("thread-id");
    await client.showThread("thread-id", 12, 40);
    assert.deepEqual(calls, [
        ["GET", "/threads/thread-id", { params: { limit: 8, offset: 0 } }],
        ["GET", "/threads/thread-id", { params: { limit: 12, offset: 40 } }],
    ]);
});
