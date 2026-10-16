import { resolveThreadSyncTimeoutMs as resolveCoreThreadSyncTimeoutMs } from "./generated/plugin-core/index.js";

export function resolveThreadSyncTimeoutMs(raw) {
	return resolveCoreThreadSyncTimeoutMs(raw == null ? undefined : String(raw));
}
