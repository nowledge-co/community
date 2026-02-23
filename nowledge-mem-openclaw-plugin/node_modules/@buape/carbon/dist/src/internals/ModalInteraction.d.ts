import { type APIModalSubmitInteraction } from "discord-api-types/v10";
import { BaseInteraction } from "../abstracts/BaseInteraction.js";
import type { Client, InteractionDefaults } from "../index.js";
import type { MessagePayload } from "../types/index.js";
import { FieldsHandler } from "./FieldsHandler.js";
export declare class ModalInteraction extends BaseInteraction<APIModalSubmitInteraction> {
    customId: string;
    fields: FieldsHandler;
    constructor(client: Client, data: APIModalSubmitInteraction, defaults: InteractionDefaults);
    /**
     * Acknowledge the interaction, the user does not see a loading state.
     * This can only be used for modals triggered from components
     */
    acknowledge(): Promise<void>;
    /**
     * Update the original message of the component.
     * This can only be used for modals triggered from components
     */
    update(data: MessagePayload): Promise<void>;
}
//# sourceMappingURL=ModalInteraction.d.ts.map