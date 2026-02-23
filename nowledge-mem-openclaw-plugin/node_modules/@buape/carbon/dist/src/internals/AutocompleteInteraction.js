import { ApplicationCommandOptionType, ApplicationCommandType, InteractionResponseType, InteractionType, Routes } from "discord-api-types/v10";
import { BaseInteraction } from "../abstracts/BaseInteraction.js";
import { OptionsHandler } from "./OptionsHandler.js";
export class AutocompleteInteraction extends BaseInteraction {
    /**
     * This is the options of the commands, parsed from the interaction data.
     */
    options;
    constructor({ client, data, defaults, processingCommand }) {
        super(client, data, defaults);
        if (data.type !== InteractionType.ApplicationCommandAutocomplete) {
            throw new Error("Invalid interaction type was used to create this class");
        }
        if (data.data.type !== ApplicationCommandType.ChatInput) {
            throw new Error("Invalid command type was used to create this class");
        }
        this.options = new AutocompleteOptionsHandler({
            client,
            options: data.data.options ?? [],
            interactionData: data.data,
            definitions: processingCommand?.options ?? []
        });
    }
    async defer() {
        throw new Error("Defer is not available for autocomplete interactions");
    }
    async reply() {
        throw new Error("Reply is not available for autocomplete interactions");
    }
    /**
     * Respond with the choices for an autocomplete interaction
     */
    async respond(choices) {
        let safeChoices = choices;
        if (choices.length > 25) {
            console.warn(`[Carbon] Autocomplete only supports up to 25 choices. Received ${choices.length}. Only the first 25 will be sent.`);
            safeChoices = choices.slice(0, 25);
        }
        await this.client.rest.post(Routes.interactionCallback(this.rawData.id, this.rawData.token), {
            body: {
                type: InteractionResponseType.ApplicationCommandAutocompleteResult,
                data: {
                    choices: safeChoices
                }
            }
        });
    }
}
export class AutocompleteOptionsHandler extends OptionsHandler {
    /**
     * Get the focused option (the one that is being autocompleted)
     */
    getFocused() {
        const focused = this.raw.find((x) => "focused" in x && x.focused);
        if (!focused)
            return null;
        const value = focused.type === ApplicationCommandOptionType.String
            ? this.getString(focused.name)
            : focused.type === ApplicationCommandOptionType.Integer
                ? this.getInteger(focused.name)
                : focused.type === ApplicationCommandOptionType.Number
                    ? this.getNumber(focused.name)
                    : focused.type === ApplicationCommandOptionType.Boolean
                        ? this.getBoolean(focused.name)
                        : null;
        return {
            name: focused.name,
            type: focused.type,
            value: value
        };
    }
}
//# sourceMappingURL=AutocompleteInteraction.js.map