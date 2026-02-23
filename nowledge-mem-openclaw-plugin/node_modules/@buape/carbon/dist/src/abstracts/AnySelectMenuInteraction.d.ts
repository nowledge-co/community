import { type APIMessageComponentSelectMenuInteraction } from "discord-api-types/v10";
import type { Client } from "../classes/Client.js";
import { BaseComponentInteraction } from "./BaseComponentInteraction.js";
import type { InteractionDefaults } from "./BaseInteraction.js";
export declare abstract class AnySelectMenuInteraction extends BaseComponentInteraction {
    constructor(client: Client, data: APIMessageComponentSelectMenuInteraction, defaults: InteractionDefaults);
    /**
     * The raw IDs of the selected options (either role/string/channel IDs or the IDs you provided in your options)
     */
    get values(): string[];
}
//# sourceMappingURL=AnySelectMenuInteraction.d.ts.map