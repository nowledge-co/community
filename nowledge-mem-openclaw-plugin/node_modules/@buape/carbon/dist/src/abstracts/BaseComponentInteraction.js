import { InteractionResponseType, Routes } from "discord-api-types/v10";
import { serializePayload } from "../utils/index.js";
import { BaseInteraction } from "./BaseInteraction.js";
export class BaseComponentInteraction extends BaseInteraction {
    componentType;
    constructor(client, data, defaults) {
        super(client, data, defaults);
        if (!data.data)
            throw new Error("Invalid interaction data was used to create this class");
        this.componentType = data.data.component_type;
    }
    /**
     * Acknowledge the interaction, the user does not see a loading state.
     * This can only be used for component interactions
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
     * Update the original message of the component
     */
    async update(data) {
        const serialized = serializePayload(data);
        // Auto-register any components in the message
        this._internalAutoRegisterComponentsOnSend(data);
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
//# sourceMappingURL=BaseComponentInteraction.js.map