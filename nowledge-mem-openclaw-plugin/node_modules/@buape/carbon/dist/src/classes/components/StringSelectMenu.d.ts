import { type APIStringSelectComponent, ComponentType } from "discord-api-types/v10";
import { AnySelectMenu } from "../../abstracts/AnySelectMenu.js";
import type { StringSelectMenuInteraction } from "../../internals/StringSelectMenuInteraction.js";
import type { ComponentData } from "../../types/index.js";
export declare abstract class StringSelectMenu extends AnySelectMenu {
    readonly type: ComponentType.StringSelect;
    readonly isV2 = false;
    abstract options: APIStringSelectComponent["options"];
    run(interaction: StringSelectMenuInteraction, data: ComponentData): unknown | Promise<unknown>;
    serializeOptions(): {
        type: ComponentType.StringSelect;
        options: import("discord-api-types/v10").APISelectMenuOption[];
    };
}
//# sourceMappingURL=StringSelectMenu.d.ts.map