import { ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
export class Row extends BaseComponent {
    type = ComponentType.ActionRow;
    isV2 = false;
    /**
     * The components in the action row
     */
    components = [];
    constructor(components = []) {
        super();
        this.components = components;
    }
    /**
     * Add a component to the action row
     * @param component The component to add
     */
    addComponent(component) {
        this.components.push(component);
    }
    /**
     * Remove a component from the action row
     * @param component The component to remove
     */
    removeComponent(component) {
        const index = this.components.indexOf(component);
        if (index === -1)
            return;
        this.components.splice(index, 1);
    }
    /**
     * Remove all components from the action row
     */
    removeAllComponents() {
        this.components = [];
    }
    serialize = () => {
        return {
            type: ComponentType.ActionRow,
            components: this.components.map((component) => component.serialize())
        };
    };
}
//# sourceMappingURL=Row.js.map