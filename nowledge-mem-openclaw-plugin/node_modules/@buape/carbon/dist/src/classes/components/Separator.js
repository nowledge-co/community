import { ComponentType, SeparatorSpacingSize } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
export class Separator extends BaseComponent {
    type = ComponentType.Separator;
    isV2 = true;
    /**
     * Whether a visual divider should be displayed in the component
     */
    divider = true;
    /**
     * The size of the separator's padding
     * Either "small" or "large"
     * @default "small"
     */
    spacing = "small"; // integers here because its technically that on the API
    constructor(options = {}) {
        super();
        this.spacing = options.spacing ?? "small";
        this.divider = options.divider ?? true;
    }
    serialize = () => {
        return {
            type: this.type,
            divider: this.divider,
            spacing: typeof this.spacing === "number"
                ? this.spacing
                : this.spacing === "small"
                    ? SeparatorSpacingSize.Small
                    : SeparatorSpacingSize.Large
        };
    };
}
//# sourceMappingURL=Separator.js.map