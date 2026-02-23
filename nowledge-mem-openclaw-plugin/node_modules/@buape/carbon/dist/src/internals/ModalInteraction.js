import { InteractionResponseType, Routes } from "discord-api-types/v10";
import { BaseInteraction } from "../abstracts/BaseInteraction.js";
import { serializePayload } from "../utils/index.js";
import { FieldsHandler } from "./FieldsHandler.js";
export class ModalInteraction extends BaseInteraction {
    customId;
    fields;
    constructor(client, data, defaults) {
        super(client, data, defaults);
        this.customId = data.data.custom_id;
        this.fields = new FieldsHandler(client, data);
    }
    /**
     * Acknowledge the interaction, the user does not see a loading state.
     * This can only be used for modals triggered from components
     */
    async acknowledge() {
        await this.client.rest.post(Routes.interactionCallback(this.rawData.id, this.rawData.token), {
            body: {
                type: InteractionResponseType.DeferredMessageUpdate
            }
        });
        this._deferred = true;
    }
    /**
     * Update the original message of the component.
     * This can only be used for modals triggered from components
     */
    async update(data) {
        const serialized = serializePayload(data);
        await this.client.rest.post(Routes.interactionCallback(this.rawData.id, this.rawData.token), {
            body: {
                type: InteractionResponseType.UpdateMessage,
                data: {
                    ...serialized
                }
            }
        });
    }
}
//# sourceMappingURL=ModalInteraction.js.map