import { ComponentType } from "discord-api-types/v10";
import { BaseModalComponent } from "../../abstracts/BaseModalComponent.js";
export class Label extends BaseModalComponent {
    type = ComponentType.Label;
    /**
     * The description of the label (optional)
     */
    description;
    /**
     * The component within this label
     */
    component;
    /**
     * The custom ID of the label - required by BaseModalComponent
     */
    customId = "label";
    constructor(component) {
        super();
        if (component) {
            this.component = component;
        }
    }
    serialize = () => {
        if (!this.component) {
            throw new Error("Label must have a component, either assign it ahead of time or pass it to the constructor");
        }
        return {
            type: this.type,
            label: this.label,
            description: this.description,
            component: this.component.serialize()
        };
    };
}
//# sourceMappingURL=Label.js.map