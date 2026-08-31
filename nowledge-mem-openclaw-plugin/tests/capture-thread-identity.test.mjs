import assert from "node:assert/strict";
import test from "node:test";

import { isIncognitoCaptureSessionKey } from "../src/hooks/capture.js";
import {
	_resetConversationRoots,
	buildStableThreadId,
	registerSessionEndConversation,
	registerSessionStartConversation,
} from "../src/hooks/thread-identity.js";

test.beforeEach(() => {
	_resetConversationRoots();
});

test("automatic capture recognizes OpenClaw 2.0 Incognito session keys", () => {
	assert.equal(
		isIncognitoCaptureSessionKey("dashboard:incognito-abc123"),
		true,
	);
	assert.equal(
		isIncognitoCaptureSessionKey("subagent:incognito-abc123"),
		true,
	);
	assert.equal(
		isIncognitoCaptureSessionKey("internal-session-effects:incognito-abc123"),
		true,
	);
	assert.equal(
		isIncognitoCaptureSessionKey("agent:main:dashboard:incognito-abc123"),
		true,
	);
	assert.equal(
		isIncognitoCaptureSessionKey(
			"agent:main:internal-session-effects:incognito-abc123",
		),
		true,
	);
	assert.equal(
		isIncognitoCaptureSessionKey("agent:main:telegram:direct:abc123"),
		false,
	);
	assert.equal(
		isIncognitoCaptureSessionKey("dashboard:incognito-abc123:extra"),
		false,
	);
});

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
