import { type APIMessageComponentSelectMenuInteraction } from "discord-api-types/v10";
import { AnySelectMenuInteraction } from "../abstracts/AnySelectMenuInteraction.js";
import type { InteractionDefaults } from "../abstracts/BaseInteraction.js";
import type { Client } from "../classes/Client.js";
export declare class ChannelSelectMenuInteraction extends AnySelectMenuInteraction {
    constructor(client: Client, data: APIMessageComponentSelectMenuInteraction, defaults: InteractionDefaults);
}
//# sourceMappingURL=ChannelSelectMenuInteraction.d.ts.map