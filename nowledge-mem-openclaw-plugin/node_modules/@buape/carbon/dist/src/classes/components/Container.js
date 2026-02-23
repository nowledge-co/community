import { ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
export class Container extends BaseComponent {
    type = ComponentType.Container;
    isV2 = true;
    components = [];
    /**
     * The accent color of the container
     */
    accentColor;
    /**
     * Whether the container should be marked a spoiler
     */
    spoiler = false;
    constructor(components = [], options = {}) {
        super();
        this.components = components;
        if (options.accentColor) {
            this.accentColor = options.accentColor;
        }
        if (options.spoiler) {
            this.spoiler = options.spoiler;
        }
    }
    serialize = () => {
        return {
            type: this.type,
            components: this.components.map((component) => component.serialize()),
            accent_color: this.accentColor
                ? typeof this.accentColor === "string"
                    ? Number.parseInt(this.accentColor.slice(1), 16)
                    : this.accentColor
                : undefined,
            spoiler: this.spoiler
        };
    };
}
//# sourceMappingURL=Container.js.map