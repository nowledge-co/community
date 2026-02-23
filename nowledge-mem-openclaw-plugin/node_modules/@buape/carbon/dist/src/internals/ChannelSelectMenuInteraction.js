import { ComponentType } from "discord-api-types/v10";
import { AnySelectMenuInteraction } from "../abstracts/AnySelectMenuInteraction.js";
export class ChannelSelectMenuInteraction extends AnySelectMenuInteraction {
    constructor(client, data, defaults) {
        super(client, data, defaults);
        if (data.data.component_type !== ComponentType.ChannelSelect) {
            throw new Error("Invalid component type was used to create this class");
        }
    }
}
//# sourceMappingURL=ChannelSelectMenuInteraction.js.map