import { readFile } from "node:fs/promises";

const MAX_THREAD_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 800;

function truncate(text, max = MAX_MESSAGE_CHARS) {
	const str = String(text || "").trim();
	if (!str) return "";
	return str.length > max ? `${str.slice(0, max)}…` : str;
}

function extractText(content) {
	if (typeof content === "string") {
		return content.trim();
	}
	if (!Array.isArray(content)) {
		return "";
	}

	const parts = [];
	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		if (block.type === "text" && typeof block.text === "string") {
			const text = block.text.trim();
			if (text) parts.push(text);
		}
	}
	return parts.join("\n").trim();
}

function normalizeRoleMessage(raw) {
	if (!raw || typeof raw !== "object") return null;
	const msg =
		raw.message && typeof raw.message === "object" ? raw.message : raw;
	const role = typeof msg.role === "string" ? msg.role : "";
	if (role !== "user" && role !== "assistant") return null;
	const text = extractText(msg.content);
	if (!text) return null;
	if (role === "user" && text.startsWith("/")) return null;
	return { role, content: truncate(text) };
}

function fingerprint(text) {
	return String(text || "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.replace(/[^\w\s]/g, "")
		.slice(0, 180);
}

function shouldCaptureAsMemory(text) {
	const normalized = String(text || "").trim();
	if (!normalized) return false;
	if (normalized.startsWith("/")) return false;
	if (normalized.length < 24) return false;
	return normalized.split(/\s+/).length >= 5;
}

function buildThreadTitle(ctx, reason) {
	const stamp = new Date().toISOString().replace("T", " ").replace("Z", " UTC");
	const session = ctx?.sessionKey || ctx?.sessionId || "session";
	const reasonSuffix = reason ? ` (${reason})` : "";
	return `OpenClaw ${session}${reasonSuffix} ${stamp}`;
}

async function loadMessagesFromSessionFile(sessionFile) {
	try {
		const content = await readFile(sessionFile, "utf-8");
		const messages = [];
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				const entry = JSON.parse(trimmed);
				if (entry?.type === "message" && entry.message) {
					messages.push(entry.message);
				} else if (entry?.role && entry?.content) {
					messages.push(entry);
				}
			} catch {
				// Ignore invalid JSONL lines.
			}
		}
		return messages;
	} catch {
		return [];
	}
}

async function resolveHookMessages(event) {
	if (Array.isArray(event?.messages) && event.messages.length > 0) {
		return event.messages;
	}
	const sessionFile =
		typeof event?.sessionFile === "string" ? event.sessionFile.trim() : "";
	if (!sessionFile) return [];
	return loadMessagesFromSessionFile(sessionFile);
}

/**
 * Capture a high-value user message after a successful run.
 */
export function buildAgentEndCaptureHandler(client, _cfg, logger) {
	const seenBySession = new Map();

	return async (event, ctx) => {
		if (!event?.success || !Array.isArray(event?.messages)) return;

		const normalized = event.messages.map(normalizeRoleMessage).filter(Boolean);
		const lastUser = [...normalized].reverse().find((m) => m.role === "user");
		if (!lastUser || !shouldCaptureAsMemory(lastUser.content)) return;

		const sessionKey = String(ctx?.sessionKey || ctx?.sessionId || "session");
		const nextFp = fingerprint(lastUser.content);
		const previousFp = seenBySession.get(sessionKey);
		if (previousFp === nextFp) return;
		seenBySession.set(sessionKey, nextFp);

		try {
			const title = `OpenClaw note (${sessionKey})`;
			const id = await client.addMemory(lastUser.content, title, 0.65);
			logger.info(`capture: stored memory ${id}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.warn(`capture: memory store failed: ${message}`);
		}
	};
}

/**
 * Capture a thread snapshot before /new or /reset clears the session.
 */
export function buildBeforeResetCaptureHandler(client, _cfg, logger) {
	return async (event, ctx) => {
		const rawMessages = await resolveHookMessages(event);
		if (!Array.isArray(rawMessages) || rawMessages.length === 0) return;

		const normalized = rawMessages.map(normalizeRoleMessage).filter(Boolean);
		if (normalized.length === 0) return;

		const messages = normalized.slice(-MAX_THREAD_MESSAGES);
		const reason = typeof event?.reason === "string" ? event.reason : undefined;
		const title = buildThreadTitle(ctx, reason);

		try {
			const threadId = await client.createThread({
				title,
				messages,
				source: "openclaw",
			});
			logger.info(`capture: saved thread snapshot ${threadId}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.warn(`capture: thread snapshot failed: ${message}`);
		}
	};
}
