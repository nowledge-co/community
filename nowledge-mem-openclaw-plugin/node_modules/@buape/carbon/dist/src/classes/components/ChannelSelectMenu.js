import { ComponentType } from "discord-api-types/v10";
import { AnySelectMenu } from "../../abstracts/AnySelectMenu.js";
export class ChannelSelectMenu extends AnySelectMenu {
    type = ComponentType.ChannelSelect;
    isV2 = false;
    channelTypes;
    defaultValues;
    run(interaction, data) {
        // Random things to show the vars as used
        typeof interaction === "string";
        typeof data === "string";
        return;
    }
    serializeOptions() {
        return {
            type: this.type,
            default_values: this.defaultValues,
            channel_types: this.channelTypes
        };
    }
}
//# sourceMappingURL=ChannelSelectMenu.js.map