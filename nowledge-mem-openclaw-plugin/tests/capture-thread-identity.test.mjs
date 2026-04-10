import test from "node:test";
import assert from "node:assert/strict";

import {
	buildStableThreadId,
	registerSessionEndConversation,
	registerSessionStartConversation,
} from "../src/hooks/capture.js";

test("explicit /new starts a fresh Mem thread for the same OpenClaw sessionKey", () => {
	const oldCtx = {
		sessionId: "session-old",
		sessionKey: "agent:main:telegram:direct:123",
	};

	const oldThreadId = buildStableThreadId({}, oldCtx);

	registerSessionEndConversation(
		{
			sessionId: "session-old",
			sessionKey: oldCtx.sessionKey,
			reason: "new",
			nextSessionId: "session-new",
		},
		oldCtx,
	);
	registerSessionStartConversation(
		{
			sessionId: "session-new",
			sessionKey: oldCtx.sessionKey,
			resumedFrom: "session-old",
		},
		{
			sessionId: "session-new",
			sessionKey: oldCtx.sessionKey,
		},
	);

	const newThreadId = buildStableThreadId({}, {
		sessionId: "session-new",
		sessionKey: oldCtx.sessionKey,
	});

	assert.notEqual(newThreadId, oldThreadId);
});

test("compaction session rotation keeps the same Mem thread", () => {
	const sessionKey = "agent:main:telegram:direct:compaction";
	const originalCtx = {
		sessionId: "session-pre-compaction",
		sessionKey,
	};
	const originalThreadId = buildStableThreadId({}, originalCtx);

	registerSessionEndConversation(
		{
			sessionId: "session-pre-compaction",
			sessionKey,
			reason: "compaction",
			nextSessionId: "session-post-compaction",
		},
		originalCtx,
	);
	registerSessionStartConversation(
		{
			sessionId: "session-post-compaction",
			sessionKey,
			resumedFrom: "session-pre-compaction",
		},
		{
			sessionId: "session-post-compaction",
			sessionKey,
		},
	);

	const rotatedThreadId = buildStableThreadId({}, {
		sessionId: "session-post-compaction",
		sessionKey,
	});

	assert.equal(rotatedThreadId, originalThreadId);
});
