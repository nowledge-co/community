import { createHash } from "node:crypto";

export {
  appendAcknowledgedRemoteCount,
  createAcknowledgedRemoteCount,
  isCheckpointConflictResponse,
  isCheckpointedAppendAck,
  selectAcknowledgedDelta,
  stableMessageFingerprint,
  type AcknowledgedCursor,
  type AcknowledgedDelta,
} from "./generated/plugin-core/index.js";

export type ThreadSyncResponse = {
  ok: boolean;
  status: number;
  data: unknown;
};

export function sessionSyncLaneKey(
  threadId: string,
  apiUrl: string,
  apiKey: string | undefined,
  spaceId: string | undefined,
  agentId: string | undefined,
  hostAgentId: string | undefined,
): string {
  const destination = createHash("sha256")
    .update(JSON.stringify([apiUrl, apiKey ?? null, spaceId ?? null, agentId ?? null, hostAgentId ?? null]))
    .digest("hex")
  return `${destination}\0${threadId}`
}

export function isThreadNotFoundResponse(status: number, data: unknown): boolean {
  if (
    typeof data === "object"
    && data !== null
    && (data as { error_code?: unknown }).error_code === "thread_not_found"
  ) {
    return true
  }
  if (status === 404) return true
  return status === 400 && JSON.stringify(data).toLowerCase().includes("thread not found")
}

export function isThreadAlreadyExistsResponse(status: number, data: unknown): boolean {
  if (status === 409) return true
  const text = JSON.stringify(data).toLowerCase()
  return (
    text.includes("thread already exists")
    || text.includes("already exists in space")
    || text.includes("already exists")
    || text.includes("thread exists")
  )
}

export async function recreateMissingThread(
  response: ThreadSyncResponse,
  recreate: () => Promise<ThreadSyncResponse>,
): Promise<{ response: ThreadSyncResponse; recreated: boolean }> {
  if (response.ok || !isThreadNotFoundResponse(response.status, response.data)) {
    return { response, recreated: false }
  }
  return { response: await recreate(), recreated: true }
}
