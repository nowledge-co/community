import { ApplicationCommandType } from "discord-api-types/v10";
import { ApplicationIntegrationType, InteractionContextType } from "../index.js";
/**
 * Represents the base data of a command that the user creates
 */
export class BaseCommand {
    id;
    /**
     * A description of the command
     */
    description;
    /**
     * The localized name of the command
     * @see https://discord.com/developers/docs/interactions/application-commands#localization
     */
    nameLocalizations;
    /**
     * The localized description of the command
     * @see https://discord.com/developers/docs/interactions/application-commands#localization
     */
    descriptionLocalizations;
    /**
     * Whether the command response should be automatically deferred.
     * Can be a boolean or a function that receives the interaction and returns a boolean.
     */
    defer = false;
    /**
     * Whether the command response should be ephemeral.
     * Can be a boolean or a function that receives the interaction and returns a boolean.
     */
    ephemeral = false;
    /**
     * The places this command can be used in
     */
    integrationTypes = [
        ApplicationIntegrationType.GuildInstall,
        ApplicationIntegrationType.UserInstall
    ];
    /**
     * The contexts this command can be used in
     */
    contexts = [
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
        InteractionContextType.PrivateChannel
    ];
    /**
     * The default permission that a user needs to have to use this command.
     * This can be overridden by server admins.
     */
    permission;
    /**
     * The components that this command uses.
     * These will be registered with the client when the command is initialized.
     */
    components;
    /**
     * The guild IDs this command should be deployed to (guild-specific deployment).
     * If not set, the command is deployed globally.
     */
    guildIds;
    /**
     * Serializes the command into a JSON object that can be sent to Discord
     * @internal
     */
    serialize() {
        if (this.type === ApplicationCommandType.PrimaryEntryPoint) {
            throw new Error("Primary Entry Point commands cannot be serialized");
        }
        // Only chat input commands can have descriptions
        if (this.type === ApplicationCommandType.ChatInput) {
            const data = {
                name: this.name,
                name_localizations: this.nameLocalizations,
                description: this.description ?? "",
                description_localizations: this.descriptionLocalizations,
                type: this.type,
                options: this.serializeOptions(),
                integration_types: this.integrationTypes,
                contexts: this.contexts,
                default_member_permissions: Array.isArray(this.permission)
                    ? this.permission.reduce((a, p) => a | p, 0n).toString()
                    : this.permission
                        ? `${this.permission}`
                        : null
            };
            return data;
        }
        const data = {
            name: this.name,
            name_localizations: this.nameLocalizations,
            type: this.type,
            options: this.serializeOptions(),
            integration_types: this.integrationTypes,
            contexts: this.contexts,
            default_member_permissions: Array.isArray(this.permission)
                ? this.permission.reduce((a, p) => a | p, 0n).toString()
                : this.permission
                    ? `${this.permission}`
                    : null
        };
        return data;
    }
    async getMention(client) {
        if (this.id)
            return `</${this.name}:${this.id}>`;
        const commands = await client.getDiscordCommands();
        const match = this.findMatchingCommand(commands);
        if (!match)
            return `/${this.name}`;
        this.id = match.id;
        return `</${this.name}:${this.id}>`;
    }
    findMatchingCommand(commands) {
        return commands.find((cmd) => {
            if (cmd.name !== this.name)
                return false;
            if (cmd.type !== this.type)
                return false;
            if (!cmd.guild_id) {
                return !this.guildIds || this.guildIds.length === 0;
            }
            return this.guildIds?.includes(cmd.guild_id) ?? true;
        });
    }
}
//# sourceMappingURL=BaseCommand.js.map