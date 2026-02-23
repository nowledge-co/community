import { type Component } from "@mariozechner/pi-tui";
import type { AgentSession } from "../../../core/agent-session.js";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.js";
/**
 * Footer component that shows pwd, token stats, and context usage.
 * Computes token/context stats from session, gets git branch and extension statuses from provider.
 */
export declare class FooterComponent implements Component {
    private session;
    private footerData;
    private autoCompactEnabled;
    constructor(session: AgentSession, footerData: ReadonlyFooterDataProvider);
    setAutoCompactEnabled(enabled: boolean): void;
    /**
     * No-op: git branch caching now handled by provider.
     * Kept for compatibility with existing call sites in interactive-mode.
     */
    invalidate(): void;
    /**
     * Clean up resources.
     * Git watcher cleanup now handled by provider.
     */
    dispose(): void;
    render(width: number): string[];
}
//# sourceMappingURL=footer.d.ts.map