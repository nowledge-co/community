import { type APIChannelSelectComponent, ComponentType } from "discord-api-types/v10";
import { AnySelectMenu } from "../../abstracts/AnySelectMenu.js";
import type { ChannelSelectMenuInteraction } from "../../internals/ChannelSelectMenuInteraction.js";
import type { ComponentData } from "../../types/index.js";
export declare abstract class ChannelSelectMenu extends AnySelectMenu {
    readonly type: ComponentType.ChannelSelect;
    readonly isV2 = false;
    channelTypes?: APIChannelSelectComponent["channel_types"];
    defaultValues?: APIChannelSelectComponent["default_values"];
    run(interaction: ChannelSelectMenuInteraction, data: ComponentData): unknown | Promise<unknown>;
    serializeOptions(): {
        type: ComponentType.ChannelSelect;
        default_values: import("discord-api-types/v10").APISelectMenuDefaultValue<import("discord-api-types/v10").SelectMenuDefaultValueType.Channel>[] | undefined;
        channel_types: import("discord-api-types/v10").ChannelType[] | undefined;
    };
}
//# sourceMappingURL=ChannelSelectMenu.d.ts.map