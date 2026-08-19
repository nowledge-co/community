import assert from "node:assert/strict";
import test from "node:test";

import {
	resolveThreadSyncTimeoutMs,
	shouldTryRemoteApiFallback,
} from "../../nowledge-mem-pi-package/extensions/nowledge-mem.ts";

test("thread sync allows slow successful writes by default", () => {
	assert.equal(resolveThreadSyncTimeoutMs(undefined), 120_000);
	assert.equal(resolveThreadSyncTimeoutMs(""), 120_000);
	assert.equal(resolveThreadSyncTimeoutMs("not-a-number"), 120_000);
	assert.equal(resolveThreadSyncTimeoutMs("-1"), 120_000);
});

test("thread sync timeout is configurable within bounded timer limits", () => {
	assert.equal(resolveThreadSyncTimeoutMs("66000"), 66_000);
	assert.equal(resolveThreadSyncTimeoutMs("500"), 1_000);
	assert.equal(resolveThreadSyncTimeoutMs("3600000"), 1_800_000);
	assert.equal(resolveThreadSyncTimeoutMs("120000.5"), 120_000);
});

test("remote API fallback only retries explicit route mismatches", () => {
	assert.equal(shouldTryRemoteApiFallback(404), true);
	assert.equal(shouldTryRemoteApiFallback(405), true);
	assert.equal(shouldTryRemoteApiFallback(0), false);
	assert.equal(shouldTryRemoteApiFallback(401), false);
	assert.equal(shouldTryRemoteApiFallback(500), false);
});
