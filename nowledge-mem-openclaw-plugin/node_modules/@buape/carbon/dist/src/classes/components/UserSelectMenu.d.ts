import { type APIUserSelectComponent, ComponentType } from "discord-api-types/v10";
import { AnySelectMenu } from "../../abstracts/AnySelectMenu.js";
import type { UserSelectMenuInteraction } from "../../internals/UserSelectMenuInteraction.js";
import type { ComponentData } from "../../types/index.js";
export declare abstract class UserSelectMenu extends AnySelectMenu {
    readonly type: ComponentType.UserSelect;
    readonly isV2 = false;
    defaultValues?: APIUserSelectComponent["default_values"];
    run(interaction: UserSelectMenuInteraction, data: ComponentData): unknown | Promise<unknown>;
    serializeOptions(): {
        type: ComponentType.UserSelect;
        default_values: import("discord-api-types/v10").APISelectMenuDefaultValue<import("discord-api-types/v10").SelectMenuDefaultValueType.User>[] | undefined;
    };
}
//# sourceMappingURL=UserSelectMenu.d.ts.map