import assert from "node:assert/strict";
import test from "node:test";

import { resolveThreadSyncTimeoutMs } from "../../nowledge-mem-opencode-plugin/src/thread-sync-timeout.ts";

test("automatic thread sync allows slow successful writes by default", () => {
	assert.equal(resolveThreadSyncTimeoutMs(undefined), 120_000);
	assert.equal(resolveThreadSyncTimeoutMs(""), 120_000);
	assert.equal(resolveThreadSyncTimeoutMs("not-a-number"), 120_000);
	assert.equal(resolveThreadSyncTimeoutMs("-1"), 120_000);
});

test("automatic thread sync timeout is configurable within timer limits", () => {
	assert.equal(resolveThreadSyncTimeoutMs("66000"), 66_000);
	assert.equal(resolveThreadSyncTimeoutMs("500"), 1_000);
	assert.equal(resolveThreadSyncTimeoutMs("3600000"), 1_800_000);
	assert.equal(resolveThreadSyncTimeoutMs("120000.5"), 120_000);
});
