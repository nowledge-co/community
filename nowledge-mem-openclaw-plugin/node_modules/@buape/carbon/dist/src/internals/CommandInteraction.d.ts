import { type APIApplicationCommandInteraction } from "discord-api-types/v10";
import { BaseInteraction, type InteractionDefaults } from "../abstracts/BaseInteraction.js";
import type { Client } from "../classes/Client.js";
import type { Command } from "../classes/Command.js";
import { Message } from "../structures/Message.js";
import { User } from "../structures/User.js";
import { OptionsHandler } from "./OptionsHandler.js";
/**
 * Represents a command interaction
 */
export declare class CommandInteraction extends BaseInteraction<APIApplicationCommandInteraction> {
    /**
     * This is the options of the commands, parsed from the interaction data.
     * It will not have any options in it if the command is not a ChatInput command.
     */
    options: OptionsHandler;
    constructor({ client, data, defaults, processingCommand }: {
        client: Client;
        data: APIApplicationCommandInteraction;
        defaults: InteractionDefaults;
        processingCommand?: Command;
    });
    get targetMessage(): Message<false> | null;
    get targetUser(): User<false> | null;
}
//# sourceMappingURL=CommandInteraction.d.ts.map