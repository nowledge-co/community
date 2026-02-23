import { type APIMessageComponentSelectMenuInteraction } from "discord-api-types/v10";
import { AnySelectMenuInteraction } from "../abstracts/AnySelectMenuInteraction.js";
import type { InteractionDefaults } from "../abstracts/BaseInteraction.js";
import type { Client } from "../classes/Client.js";
export declare class UserSelectMenuInteraction extends AnySelectMenuInteraction {
    constructor(client: Client, data: APIMessageComponentSelectMenuInteraction, defaults: InteractionDefaults);
    get values(): string[];
}
//# sourceMappingURL=UserSelectMenuInteraction.d.ts.map