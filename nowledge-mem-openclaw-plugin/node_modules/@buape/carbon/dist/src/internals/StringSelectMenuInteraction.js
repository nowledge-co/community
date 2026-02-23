import { ComponentType } from "discord-api-types/v10";
import { AnySelectMenuInteraction } from "../abstracts/AnySelectMenuInteraction.js";
export class StringSelectMenuInteraction extends AnySelectMenuInteraction {
    constructor(client, data, defaults) {
        super(client, data, defaults);
        if (data.data.component_type !== ComponentType.StringSelect) {
            throw new Error("Invalid component type was used to create this class");
        }
    }
    get values() {
        return this.rawData.data.values;
    }
}
//# sourceMappingURL=StringSelectMenuInteraction.js.map