import { type APIMentionableSelectComponent, ComponentType } from "discord-api-types/v10";
import { AnySelectMenu } from "../../abstracts/AnySelectMenu.js";
import type { MentionableSelectMenuInteraction } from "../../internals/MentionableSelectMenuInteraction.js";
import type { ComponentData } from "../../types/index.js";
export declare abstract class MentionableSelectMenu extends AnySelectMenu {
    readonly type: ComponentType.MentionableSelect;
    readonly isV2 = false;
    defaultValues?: APIMentionableSelectComponent["default_values"];
    run(interaction: MentionableSelectMenuInteraction, data: ComponentData): unknown | Promise<unknown>;
    serializeOptions(): {
        type: ComponentType.MentionableSelect;
        default_values: import("discord-api-types/v10").APISelectMenuDefaultValue<import("discord-api-types/v10").SelectMenuDefaultValueType.Role | import("discord-api-types/v10").SelectMenuDefaultValueType.User>[] | undefined;
    };
}
//# sourceMappingURL=MentionableSelectMenu.d.ts.map