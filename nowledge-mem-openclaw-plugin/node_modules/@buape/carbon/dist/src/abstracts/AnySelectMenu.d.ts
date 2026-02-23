import type { APIChannelSelectComponent, APIMentionableSelectComponent, APIRoleSelectComponent, APISelectMenuComponent, APIStringSelectComponent, APIUserSelectComponent, ComponentType } from "discord-api-types/v10";
import type { ComponentData } from "../types/index.js";
import type { AnySelectMenuInteraction } from "./AnySelectMenuInteraction.js";
import { BaseMessageInteractiveComponent } from "./BaseMessageInteractiveComponent.js";
export type AnySelectMenuComponentType = ComponentType.ChannelSelect | ComponentType.RoleSelect | ComponentType.StringSelect | ComponentType.UserSelect | ComponentType.MentionableSelect;
export declare abstract class AnySelectMenu extends BaseMessageInteractiveComponent {
    abstract type: AnySelectMenuComponentType;
    run(interaction: AnySelectMenuInteraction, data: ComponentData): unknown | Promise<unknown>;
    minValues?: number;
    maxValues?: number;
    /**
     * Not available in modals, will throw an error if used
     */
    disabled?: boolean;
    placeholder?: string;
    /**
     * Defaults to true in modals, ignored in messages
     */
    required?: boolean;
    serialize: () => APISelectMenuComponent;
    abstract serializeOptions(): {
        type: ComponentType.ChannelSelect;
        channel_types: APIChannelSelectComponent["channel_types"];
        default_values: APIChannelSelectComponent["default_values"];
    } | {
        type: ComponentType.StringSelect;
        options: APIStringSelectComponent["options"];
    } | {
        type: ComponentType.RoleSelect;
        default_values: APIRoleSelectComponent["default_values"];
    } | {
        type: ComponentType.UserSelect;
        default_values: APIUserSelectComponent["default_values"];
    } | {
        type: ComponentType.MentionableSelect;
        default_values: APIMentionableSelectComponent["default_values"];
    };
    serializeExtra(): Record<string, unknown>;
}
//# sourceMappingURL=AnySelectMenu.d.ts.map