/**
 * TUI session selector for --resume flag
 */
import type { SessionInfo, SessionListProgress } from "../core/session-manager.js";
type SessionsLoader = (onProgress?: SessionListProgress) => Promise<SessionInfo[]>;
/** Show TUI session selector and return selected session path or null if cancelled */
export declare function selectSession(currentSessionsLoader: SessionsLoader, allSessionsLoader: SessionsLoader): Promise<string | null>;
export {};
//# sourceMappingURL=session-picker.d.ts.map