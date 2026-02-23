import { Container, Markdown, Spacer } from "@mariozechner/pi-tui";
import { getMarkdownTheme, theme } from "../theme/theme.js";
/**
 * Component that renders a user message
 */
export class UserMessageComponent extends Container {
    constructor(text, markdownTheme = getMarkdownTheme()) {
        super();
        this.addChild(new Spacer(1));
        this.addChild(new Markdown(text, 1, 1, markdownTheme, {
            bgColor: (text) => theme.bg("userMessageBg", text),
            color: (text) => theme.fg("userMessageText", text),
        }));
    }
}
//# sourceMappingURL=user-message.js.map