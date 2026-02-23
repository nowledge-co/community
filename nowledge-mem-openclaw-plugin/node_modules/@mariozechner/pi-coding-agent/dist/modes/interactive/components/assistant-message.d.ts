import type { AssistantMessage } from "@mariozechner/pi-ai";
import { Container, type MarkdownTheme } from "@mariozechner/pi-tui";
/**
 * Component that renders a complete assistant message
 */
export declare class AssistantMessageComponent extends Container {
    private contentContainer;
    private hideThinkingBlock;
    private markdownTheme;
    private lastMessage?;
    constructor(message?: AssistantMessage, hideThinkingBlock?: boolean, markdownTheme?: MarkdownTheme);
    invalidate(): void;
    setHideThinkingBlock(hide: boolean): void;
    updateContent(message: AssistantMessage): void;
}
//# sourceMappingURL=assistant-message.d.ts.map