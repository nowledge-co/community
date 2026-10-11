import { createHash } from "node:crypto";

export {
  createAcknowledgedRemoteCount as threadCreateRemoteCount,
  isCheckpointConflictResponse,
  isCheckpointedAppendAck,
  isThreadAppendAck,
  isThreadCreateAck,
  selectAcknowledgedDelta,
  stableMessageFingerprint,
  type AcknowledgedCursor,
  type AcknowledgedDelta,
} from "./generated/plugin-core/index.js";

export function sessionSyncLaneKey(
	threadId: string,
	apiUrl: string,
	apiKey: string | undefined,
	spaceId: string | undefined,
	agentId: string | undefined,
	hostAgentId: string | undefined,
): string {
	const destination = createHash("sha256")
		.update([apiUrl, apiKey || "", spaceId || "", agentId || "", hostAgentId || ""].join("\0"))
		.digest("hex");
	return `${destination}\0${threadId}`;
}

export function isThreadAlreadyExistsResponse(status: number, data: unknown): boolean {
	if (status === 409) return true;
	const text = JSON.stringify(data).toLowerCase();
	return text.includes("thread already exists") || text.includes("already exists in space");
}
