import { InteractionType } from "discord-api-types/v10";
import { BaseComponentInteraction } from "./BaseComponentInteraction.js";
export class AnySelectMenuInteraction extends BaseComponentInteraction {
    constructor(client, data, defaults) {
        super(client, data, defaults);
        if (!data.data)
            throw new Error("Invalid interaction data was used to create this class");
        if (data.type !== InteractionType.MessageComponent) {
            throw new Error("Invalid interaction type was used to create this class");
        }
    }
    /**
     * The raw IDs of the selected options (either role/string/channel IDs or the IDs you provided in your options)
     */
    get values() {
        return this.rawData.data.values;
    }
}
//# sourceMappingURL=AnySelectMenuInteraction.js.map