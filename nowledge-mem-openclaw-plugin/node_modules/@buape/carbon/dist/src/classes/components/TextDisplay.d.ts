import { type APITextDisplayComponent, ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
export declare class TextDisplay extends BaseComponent {
    readonly type: ComponentType.TextDisplay;
    readonly isV2 = true;
    content?: string;
    constructor(content?: string);
    serialize: () => APITextDisplayComponent;
}
//# sourceMappingURL=TextDisplay.d.ts.map