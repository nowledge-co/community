import { type APIRoleSelectComponent, ComponentType } from "discord-api-types/v10";
import { AnySelectMenu } from "../../abstracts/AnySelectMenu.js";
import type { RoleSelectMenuInteraction } from "../../internals/RoleSelectMenuInteraction.js";
import type { ComponentData } from "../../types/index.js";
export declare abstract class RoleSelectMenu extends AnySelectMenu {
    readonly type: ComponentType.RoleSelect;
    readonly isV2 = false;
    defaultValues?: APIRoleSelectComponent["default_values"];
    run(interaction: RoleSelectMenuInteraction, data: ComponentData): unknown | Promise<unknown>;
    serializeOptions(): {
        type: ComponentType.RoleSelect;
        default_values: import("discord-api-types/v10").APISelectMenuDefaultValue<import("discord-api-types/v10").SelectMenuDefaultValueType.Role>[] | undefined;
    };
}
//# sourceMappingURL=RoleSelectMenu.d.ts.map