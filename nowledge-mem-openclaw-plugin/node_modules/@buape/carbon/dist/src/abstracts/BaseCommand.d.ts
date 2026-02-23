import { ApplicationCommandType, type RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10";
import type { Client } from "../classes/Client.js";
import { ApplicationIntegrationType, type ArrayOrSingle, type BaseMessageInteractiveComponent, type ConditionalCommandOption, InteractionContextType, type Permission } from "../index.js";
/**
 * Represents the base data of a command that the user creates
 */
export declare abstract class BaseCommand {
    id?: string;
    /**
     * The name of the command (e.g. "ping" for /ping)
     */
    abstract name: string;
    /**
     * A description of the command
     */
    description?: string;
    /**
     * The localized name of the command
     * @see https://discord.com/developers/docs/interactions/application-commands#localization
     */
    nameLocalizations?: Record<string, string>;
    /**
     * The localized description of the command
     * @see https://discord.com/developers/docs/interactions/application-commands#localization
     */
    descriptionLocalizations?: Record<string, string>;
    /**
     * Whether the command response should be automatically deferred.
     * Can be a boolean or a function that receives the interaction and returns a boolean.
     */
    defer: boolean | ConditionalCommandOption;
    /**
     * Whether the command response should be ephemeral.
     * Can be a boolean or a function that receives the interaction and returns a boolean.
     */
    ephemeral: boolean | ConditionalCommandOption;
    /**
     * The type of the command
     */
    abstract type: ApplicationCommandType;
    /**
     * The places this command can be used in
     */
    integrationTypes: ApplicationIntegrationType[];
    /**
     * The contexts this command can be used in
     */
    contexts: InteractionContextType[];
    /**
     * The default permission that a user needs to have to use this command.
     * This can be overridden by server admins.
     */
    permission?: ArrayOrSingle<(typeof Permission)[keyof typeof Permission]>;
    /**
     * The components that this command uses.
     * These will be registered with the client when the command is initialized.
     */
    components?: BaseMessageInteractiveComponent[];
    /**
     * The guild IDs this command should be deployed to (guild-specific deployment).
     * If not set, the command is deployed globally.
     */
    guildIds?: string[];
    /**
     * Serializes the command into a JSON object that can be sent to Discord
     * @internal
     */
    serialize(): import("discord-api-types/v10").RESTPostAPIChatInputApplicationCommandsJSONBody | import("discord-api-types/v10").RESTPostAPIContextMenuApplicationCommandsJSONBody;
    /**
     * Serializes the options of the command into a JSON object that can be sent to Discord
     * @internal
     */
    abstract serializeOptions(): RESTPostAPIApplicationCommandsJSONBody["options"];
    getMention(client: Client): Promise<string>;
    private findMatchingCommand;
}
//# sourceMappingURL=BaseCommand.d.ts.map