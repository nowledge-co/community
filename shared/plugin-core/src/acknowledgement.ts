function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function messageCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isThreadAppendAck(data: unknown): boolean {
  return record(data) && data.success === true &&
    messageCount(data.messages_added) && messageCount(data.total_messages);
}

export function isCheckpointedAppendAck(data: unknown): boolean {
  return isThreadAppendAck(data) && (data as Record<string, unknown>).append_mode === "checkpointed";
}

export function appendAcknowledgedRemoteCount(data: unknown): number | undefined {
  return isThreadAppendAck(data) ? (data as { total_messages: number }).total_messages : undefined;
}

export function isThreadCreateAck(data: unknown, expectedThreadId: string): boolean {
  return record(data) && record(data.thread) && data.thread.thread_id === expectedThreadId;
}

export function createAcknowledgedRemoteCount(
  data: unknown,
  expectedThreadId: string,
): number | undefined {
  if (!isThreadCreateAck(data, expectedThreadId)) return undefined;
  const result = data as { thread: { message_count?: unknown }; messages?: unknown };
  if (result.thread.message_count !== undefined) {
    return messageCount(result.thread.message_count) ? result.thread.message_count : undefined;
  }
  // Older create responses return messages instead of a count; identity is still required.
  return Array.isArray(result.messages) ? result.messages.length : undefined;
}

export function isCheckpointConflictResponse(data: unknown): boolean {
  return record(data) && data.error_code === "checkpoint_conflict";
}
