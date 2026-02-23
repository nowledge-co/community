import { type APIMessageComponentInteraction, type ComponentType } from "discord-api-types/v10";
import type { Client } from "../classes/Client.js";
import type { MessagePayload } from "../types/index.js";
import { BaseInteraction, type InteractionDefaults } from "./BaseInteraction.js";
export declare class BaseComponentInteraction extends BaseInteraction<APIMessageComponentInteraction> {
    componentType: ComponentType;
    constructor(client: Client, data: APIMessageComponentInteraction, defaults: InteractionDefaults);
    /**
     * Acknowledge the interaction, the user does not see a loading state.
     * This can only be used for component interactions
     */
    acknowledge(): Promise<void>;
    /**
     * Update the original message of the component
     */
    update(data: MessagePayload): Promise<void>;
}
//# sourceMappingURL=BaseComponentInteraction.d.ts.map