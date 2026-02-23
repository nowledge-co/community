import { type APIApplicationCommandAutocompleteInteraction, ApplicationCommandOptionType } from "discord-api-types/v10";
import { BaseInteraction, type InteractionDefaults } from "../abstracts/BaseInteraction.js";
import type { Client } from "../classes/Client.js";
import type { Command } from "../classes/Command.js";
import { OptionsHandler } from "./OptionsHandler.js";
export declare class AutocompleteInteraction extends BaseInteraction<APIApplicationCommandAutocompleteInteraction> {
    /**
     * This is the options of the commands, parsed from the interaction data.
     */
    options: AutocompleteOptionsHandler;
    constructor({ client, data, defaults, processingCommand }: {
        client: Client;
        data: APIApplicationCommandAutocompleteInteraction;
        defaults: InteractionDefaults;
        processingCommand?: Command;
    });
    defer(): Promise<never>;
    reply(): Promise<never>;
    /**
     * Respond with the choices for an autocomplete interaction
     */
    respond(choices: {
        /**
         * The name of the choice, this is what the user will see
         */
        name: string;
        /**
         * The value of the choice, this is what the bot will receive from Discord as the value
         */
        value: string | number;
    }[]): Promise<void>;
}
export declare class AutocompleteOptionsHandler extends OptionsHandler {
    /**
     * Get the focused option (the one that is being autocompleted)
     */
    getFocused(): {
        name: string;
        type: ApplicationCommandOptionType.String | ApplicationCommandOptionType.Integer | ApplicationCommandOptionType.Boolean | ApplicationCommandOptionType.User | ApplicationCommandOptionType.Channel | ApplicationCommandOptionType.Role | ApplicationCommandOptionType.Mentionable | ApplicationCommandOptionType.Number | ApplicationCommandOptionType.Attachment;
        value: string | number | boolean | null | undefined;
    } | null;
}
//# sourceMappingURL=AutocompleteInteraction.d.ts.map