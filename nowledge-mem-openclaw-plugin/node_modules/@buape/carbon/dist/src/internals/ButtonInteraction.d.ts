import { type APIMessageComponentButtonInteraction } from "discord-api-types/v10";
import { BaseComponentInteraction } from "../abstracts/BaseComponentInteraction.js";
import type { InteractionDefaults } from "../abstracts/BaseInteraction.js";
import type { Client } from "../classes/Client.js";
export declare class ButtonInteraction extends BaseComponentInteraction {
    constructor(client: Client, data: APIMessageComponentButtonInteraction, defaults: InteractionDefaults);
}
//# sourceMappingURL=ButtonInteraction.d.ts.map