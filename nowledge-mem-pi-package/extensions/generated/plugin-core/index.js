// Generated from shared/plugin-core. Run npm --prefix shared/plugin-core run build.

// src/thread-delta.ts
import { createHash } from "node:crypto";
function stableMessageFingerprint(message) {
  return JSON.stringify(message);
}
function prefixFingerprint(messages, end, messageFingerprint) {
  const hash = createHash("sha256");
  for (const message of messages.slice(0, end)) {
    const value = messageFingerprint(message);
    hash.update(String(Buffer.byteLength(value)));
    hash.update(":");
    hash.update(value);
  }
  return hash.digest("hex");
}
function selectAcknowledgedDelta(messages, cursor, externalId, messageFingerprint = stableMessageFingerprint) {
  let start = cursor?.count ?? 0;
  const validCount = Number.isSafeInteger(start) && start >= 0 && start <= messages.length;
  const prefixMatches = validCount && (start === 0 || externalId(messages[start - 1]) === cursor?.lastExternalId && prefixFingerprint(messages, start, messageFingerprint) === cursor?.prefixFingerprint);
  const reset = !prefixMatches;
  if (reset) start = 0;
  const end = messages.length;
  return {
    start,
    end,
    messages: messages.slice(start),
    next: {
      count: end,
      remoteCount: cursor?.remoteCount ?? end,
      ...end > 0 ? { lastExternalId: externalId(messages[end - 1]) } : {},
      prefixFingerprint: prefixFingerprint(messages, end, messageFingerprint)
    },
    reset
  };
}

// src/acknowledgement.ts
function record(value) {
  return typeof value === "object" && value !== null;
}
function messageCount(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function isThreadAppendAck(data) {
  return record(data) && data.success === true && messageCount(data.messages_added) && messageCount(data.total_messages);
}
function isCheckpointedAppendAck(data) {
  return isThreadAppendAck(data) && data.append_mode === "checkpointed";
}
function appendAcknowledgedRemoteCount(data) {
  return isThreadAppendAck(data) ? data.total_messages : void 0;
}
function isThreadCreateAck(data, expectedThreadId) {
  return record(data) && record(data.thread) && data.thread.thread_id === expectedThreadId;
}
function createAcknowledgedRemoteCount(data, expectedThreadId) {
  if (!isThreadCreateAck(data, expectedThreadId)) return void 0;
  const result = data;
  if (result.thread.message_count !== void 0) {
    return messageCount(result.thread.message_count) ? result.thread.message_count : void 0;
  }
  return Array.isArray(result.messages) ? result.messages.length : void 0;
}
function isCheckpointConflictResponse(data) {
  return record(data) && data.error_code === "checkpoint_conflict";
}

// src/timeout.ts
var DEFAULT_THREAD_SYNC_TIMEOUT_MS = 12e4;
var MIN_THREAD_SYNC_TIMEOUT_MS = 1e3;
var MAX_THREAD_SYNC_TIMEOUT_MS = 30 * 6e4;
function resolveThreadSyncTimeoutMs(raw) {
  const parsed = Number(raw);
  if (!raw?.trim() || !Number.isSafeInteger(parsed) || parsed <= 0) {
    return DEFAULT_THREAD_SYNC_TIMEOUT_MS;
  }
  return Math.min(MAX_THREAD_SYNC_TIMEOUT_MS, Math.max(MIN_THREAD_SYNC_TIMEOUT_MS, parsed));
}

// src/space.ts
function resolveSpaceReference(snapshot, reference) {
  const spaces = snapshot?.spaces;
  if (!Array.isArray(spaces)) throw new Error("Space roster did not contain spaces");
  const exact = spaces.filter((s) => s && (s.id === reference || s.key === reference));
  const normalized = reference.trim().normalize("NFKC").toLowerCase();
  const matches = exact.length ? exact : spaces.filter((s) => s && [s.name, ...Array.isArray(s.aliases) ? s.aliases : []].some((value) => typeof value === "string" && value.trim().normalize("NFKC").toLowerCase() === normalized));
  if (matches.length !== 1 || typeof matches[0].id !== "string") {
    throw new Error("Unknown or ambiguous configured Space; choose a Space from nmem spaces list");
  }
  return matches[0].id;
}
async function exactSpaceBody(body, reference, load) {
  if (!reference || !body || typeof body !== "object" || Array.isArray(body)) return body;
  const record2 = body;
  if (Object.hasOwn(record2, "space_id")) return body;
  return { ...record2, space_id: resolveSpaceReference(await load(), reference) };
}
export {
  appendAcknowledgedRemoteCount,
  createAcknowledgedRemoteCount,
  exactSpaceBody,
  isCheckpointConflictResponse,
  isCheckpointedAppendAck,
  isThreadAppendAck,
  isThreadCreateAck,
  prefixFingerprint,
  resolveSpaceReference,
  resolveThreadSyncTimeoutMs,
  selectAcknowledgedDelta,
  stableMessageFingerprint
};
