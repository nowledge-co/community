import { ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
export class TextDisplay extends BaseComponent {
    type = ComponentType.TextDisplay;
    isV2 = true;
    content;
    constructor(content) {
        super();
        this.content = content;
    }
    serialize = () => {
        if (!this.content) {
            throw new Error("TextDisplay must have content");
        }
        return {
            type: this.type,
            id: this.id,
            content: this.content
        };
    };
}
//# sourceMappingURL=TextDisplay.js.map