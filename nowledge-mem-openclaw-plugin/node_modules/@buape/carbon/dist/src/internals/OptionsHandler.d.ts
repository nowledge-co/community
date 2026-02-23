import { type APIApplicationCommandInteractionDataBasicOption, type APIApplicationCommandInteractionDataOption, type APIAutocompleteApplicationCommandInteractionData, type APIChatInputApplicationCommandInteractionData, type APIInteractionDataResolved } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import { type AnyChannel, type Client, type CommandOptions, GuildMember, type ResolvedFile, Role, User } from "../index.js";
export type RawOptions = {
    [key: string]: APIApplicationCommandInteractionDataBasicOption["value"] | undefined;
};
/**
 * This class is used to parse the options of a command, and provide errors for any missing or invalid options.
 * It is used internally by the Command class.
 */
export declare class OptionsHandler extends Base {
    /**
     * The raw options that were in the interaction data, before they were parsed.
     */
    readonly raw: APIApplicationCommandInteractionDataBasicOption[];
    /**
     * The resolved data from the interaction.
     */
    readonly resolved: Partial<APIInteractionDataResolved>;
    readonly guildId?: string;
    private interactionData?;
    private definitions?;
    constructor({ client, options, interactionData, definitions, guildId }: {
        client: Client;
        options: APIApplicationCommandInteractionDataOption[];
        interactionData: APIChatInputApplicationCommandInteractionData | APIAutocompleteApplicationCommandInteractionData;
        definitions: CommandOptions;
        guildId?: string;
    });
    /**
     * Get the value of a string option.
     * @param key The name of the option to get the value of.
     * @param required Whether the option is required.
     * @returns The value of the option, or undefined if the option was not provided and it is not required.
     */
    getString(key: string, required?: false): string | undefined;
    getString(key: string, required: true): string;
    /**
     * Get the value of an integer option.
     * @param key The name of the option to get the value of.
     * @param required Whether the option is required.
     * @returns The value of the option, or undefined if the option was not provided and it is not required.
     */
    getInteger(key: string, required?: false): number | undefined;
    getInteger(key: string, required: true): number;
    /**
     * Get the value of a number option.
     * @param key The name of the option to get the value of.
     * @param required Whether the option is required.
     * @returns The value of the option, or undefined if the option was not provided and it is not required.
     */
    getNumber(key: string, required?: false): number | undefined;
    getNumber(key: string, required: true): number;
    /**
     * Get the value of a boolean option.
     * @param key The name of the option to get the value of.
     * @param required Whether the option is required.
     * @returns The value of the option, or undefined if the option was not provided and it is not required.
     */
    getBoolean(key: string, required?: false): boolean | undefined;
    getBoolean(key: string, required: true): boolean;
    /**
     * Get the value of a user option.
     * @param key The name of the option to get the value of.
     * @param required Whether the option is required.
     * @returns The value of the option, or undefined if the option was not provided and it is not required.
     */
    getUser(key: string, required?: false): User | undefined;
    getUser(key: string, required: true): User;
    /**
     * Get the member data of the value of a user option, if the user is in the guild the interaction was ran in.
     * @param key The name of the option to get the value of.
     * @param required Whether the option is required.
     * @returns The value of the option, or undefined if the option was not provided and it is not required, or null if the user is not in the server.
     */
    getMember(key: string, required?: false): GuildMember<false, true> | null | undefined;
    getMember(key: string, required: true): GuildMember<false, true> | null;
    getChannelId(key: string, required?: false): Promise<string | undefined>;
    getChannelId(key: string, required: true): Promise<string>;
    /**
     * Get the value of a channel option.
     * @param key The name of the option to get the value of.
     * @param required Whether the option is required.
     * @returns The ID of the selected channel, or undefined if the option was not provided and it is not required.
     */
    getChannel(key: string, required?: false): Promise<AnyChannel | undefined>;
    getChannel(key: string, required: true): Promise<AnyChannel>;
    /**
     * Get the value of a role option.
     * @param key The name of the option to get the value of.
     * @param required Whether the option is required.
     * @returns The value of the option, or undefined if the option was not provided and it is not required.
     */
    getRole(key: string, required?: false): Role | undefined;
    getRole(key: string, required: true): Role;
    /**
     * Get the value of a mentionable option.
     * @param key The name of the option to get the value of.
     * @param required Whether the option is required.
     * @returns The value of the option, or undefined if the option was not provided and it is not required.
     */
    getMentionable(key: string, required?: false): User | Role | undefined;
    getMentionable(key: string, required: true): User | Role;
    getAttachment(key: string, required?: false): ResolvedFile | undefined;
    getAttachment(key: string, required: true): ResolvedFile;
    private checkAgainstDefinition;
}
//# sourceMappingURL=OptionsHandler.d.ts.map