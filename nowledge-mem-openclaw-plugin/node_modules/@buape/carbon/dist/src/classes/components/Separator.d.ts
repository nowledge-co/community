import { type APISeparatorComponent, ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
export declare class Separator extends BaseComponent {
    readonly type: ComponentType.Separator;
    readonly isV2 = true;
    /**
     * Whether a visual divider should be displayed in the component
     */
    divider: boolean;
    /**
     * The size of the separator's padding
     * Either "small" or "large"
     * @default "small"
     */
    spacing: 1 | 2 | "small" | "large";
    constructor(options?: {
        spacing?: typeof Separator.prototype.spacing;
        divider?: typeof Separator.prototype.divider;
    });
    serialize: () => APISeparatorComponent;
}
//# sourceMappingURL=Separator.d.ts.map