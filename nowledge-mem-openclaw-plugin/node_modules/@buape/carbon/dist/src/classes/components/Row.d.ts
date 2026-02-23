import { type APIActionRowComponent, type APIComponentInMessageActionRow, ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
import type { BaseMessageInteractiveComponent } from "../../abstracts/BaseMessageInteractiveComponent.js";
export declare class Row<T extends BaseMessageInteractiveComponent> extends BaseComponent {
    readonly type: ComponentType.ActionRow;
    readonly isV2 = false;
    /**
     * The components in the action row
     */
    components: T[];
    constructor(components?: T[]);
    /**
     * Add a component to the action row
     * @param component The component to add
     */
    addComponent(component: T): void;
    /**
     * Remove a component from the action row
     * @param component The component to remove
     */
    removeComponent(component: T): void;
    /**
     * Remove all components from the action row
     */
    removeAllComponents(): void;
    serialize: () => APIActionRowComponent<APIComponentInMessageActionRow>;
}
//# sourceMappingURL=Row.d.ts.map