import { createHash } from "node:crypto";

const _conversationRootsBySessionId = new Map();
const _activeConversationRootsBySessionKey = new Map();
const _MAX_CONVERSATION_ROOT_ENTRIES = 500;

function sanitizeIdPart(input, max = 48) {
	const normalized = String(input || "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!normalized) return "session";
	return normalized.slice(0, max);
}

function _setConversationRoot({ sessionId, sessionKey, rootId }) {
	const normalizedRoot = String(rootId || "").trim();
	if (!normalizedRoot) return;
	const normalizedSessionId = String(sessionId || "").trim();
	const normalizedSessionKey = String(sessionKey || "").trim();

	if (normalizedSessionId) {
		_conversationRootsBySessionId.set(normalizedSessionId, normalizedRoot);
		if (_conversationRootsBySessionId.size > _MAX_CONVERSATION_ROOT_ENTRIES) {
			const excess =
				_conversationRootsBySessionId.size - _MAX_CONVERSATION_ROOT_ENTRIES;
			let removed = 0;
			for (const key of _conversationRootsBySessionId.keys()) {
				_conversationRootsBySessionId.delete(key);
				removed += 1;
				if (removed >= excess) break;
			}
		}
	}

	if (normalizedSessionKey) {
		_activeConversationRootsBySessionKey.set(
			normalizedSessionKey,
			normalizedRoot,
		);
		if (
			_activeConversationRootsBySessionKey.size > _MAX_CONVERSATION_ROOT_ENTRIES
		) {
			const excess =
				_activeConversationRootsBySessionKey.size - _MAX_CONVERSATION_ROOT_ENTRIES;
			let removed = 0;
			for (const key of _activeConversationRootsBySessionKey.keys()) {
				_activeConversationRootsBySessionKey.delete(key);
				removed += 1;
				if (removed >= excess) break;
			}
		}
	}
}

export function resolveConversationRoot(event, ctx) {
	const sessionId = String(ctx?.sessionId || event?.sessionId || "").trim();
	if (sessionId) {
		const mappedRoot = _conversationRootsBySessionId.get(sessionId);
		if (mappedRoot) return mappedRoot;
	}

	const sessionKey = String(ctx?.sessionKey || event?.sessionKey || "").trim();
	if (sessionKey) {
		const activeRoot = _activeConversationRootsBySessionKey.get(sessionKey);
		if (activeRoot) return activeRoot;
	}

	return (
		sessionId ||
		sessionKey ||
		String(event?.sessionFile || "").trim() ||
		"session"
	);
}

export function registerSessionStartConversation(event, ctx) {
	const sessionId = String(event?.sessionId || ctx?.sessionId || "").trim();
	const sessionKey = String(event?.sessionKey || ctx?.sessionKey || "").trim();
	if (!sessionId && !sessionKey) return;

	const resumedFrom = String(event?.resumedFrom || "").trim();
	const inheritedRoot =
		_conversationRootsBySessionId.get(sessionId) ||
		(resumedFrom && _conversationRootsBySessionId.get(resumedFrom)) ||
		sessionId;

	_setConversationRoot({
		sessionId,
		sessionKey,
		rootId: inheritedRoot || sessionId || sessionKey,
	});
}

export function registerSessionEndConversation(event, ctx) {
	const sessionId = String(event?.sessionId || ctx?.sessionId || "").trim();
	const sessionKey = String(event?.sessionKey || ctx?.sessionKey || "").trim();
	if (!sessionId && !sessionKey) return;

	const currentRoot = resolveConversationRoot(event, ctx);
	_setConversationRoot({
		sessionId,
		sessionKey,
		rootId: currentRoot,
	});

	const nextSessionId = String(event?.nextSessionId || "").trim();
	if (!nextSessionId) return;

	const reason = String(event?.reason || "").trim().toLowerCase();
	const nextRoot = reason === "compaction" ? currentRoot : nextSessionId;
	_setConversationRoot({
		sessionId: nextSessionId,
		sessionKey,
		rootId: nextRoot,
	});
}

export function buildStableThreadId(event, ctx) {
	const base = resolveConversationRoot(event, ctx);
	const slug = sanitizeIdPart(base);
	const digest = createHash("sha1").update(base).digest("hex").slice(0, 10);
	return `openclaw-${slug}-${digest}`;
}

export function _resetConversationRoots() {
	_conversationRootsBySessionId.clear();
	_activeConversationRootsBySessionKey.clear();
}
