import { ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
export class Section extends BaseComponent {
    type = ComponentType.Section;
    isV2 = true;
    /**
     * This is the main text that will be displayed in the section.
     * You can have 1-3 TextDisplays in a Section
     */
    components = [];
    /**
     * The Thumbnail or Button that will be displayed to the right of the main text.
     * You can only have 1 Thumbnail or Button in a Section.
     * If you don't want an accessory, you should be just using the TextDisplay directly.
     */
    accessory;
    constructor(components = [], accessory) {
        super();
        this.components = components;
        this.accessory = accessory;
    }
    serialize = () => {
        if (!this.components || this.components.length === 0) {
            throw new Error("Sections must contain at least one TextDisplay component");
        }
        if (!this.accessory) {
            throw new Error("Sections must have an accessory component");
        }
        return {
            type: this.type,
            id: this.id,
            components: this.components.map((component) => component.serialize()),
            accessory: this.accessory.serialize()
        };
    };
}
//# sourceMappingURL=Section.js.map