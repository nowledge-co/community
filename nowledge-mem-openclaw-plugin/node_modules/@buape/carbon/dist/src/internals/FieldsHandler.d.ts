import { Base } from "../abstracts/Base.js";
import { type AnyChannel, type APIInteractionDataResolved, type APIModalSubmitInteraction, type Client, type ResolvedFile, Role, User } from "../index.js";
/**
 * This class is used to parse the fields of a modal submit interaction.
 * It is used internally by the Modal class.
 */
export declare class FieldsHandler extends Base {
    /**
     * The raw data from the interaction.
     */
    readonly rawData: {
        [key: string]: string[];
    };
    /**
     * The resolved data from the interaction.
     */
    readonly resolved: APIInteractionDataResolved;
    readonly guildId?: string;
    constructor(client: Client, interaction: APIModalSubmitInteraction);
    /**
     * Get the value of a text input or text display.
     * @param key The custom ID of the input or display to get the value of.
     * @returns The value of the input or display, or undefined if the input or display was not provided.
     */
    getText(key: string, required?: false): string | undefined;
    getText(key: string, required: true): string;
    /**
     * Get the value of a string select.
     * @param key The custom ID of the select to get the value of.
     * @param required Whether the select is required.
     * @returns The value of the select menu, or undefined if the select menu was not provided and it is not required.
     */
    getStringSelect(key: string, required?: false): string[] | undefined;
    getStringSelect(key: string, required: true): string[];
    getChannelSelectIds(key: string, required?: false): string[] | undefined;
    getChannelSelectIds(key: string, required: true): string[];
    /**
     * Get the channels selected in a channel select.
     * This is async because Discord provides very limited information about the channels so we have to fetch it.
     * You can use {@link FieldsHandler.getChannelSelectIds} to get the IDs of the selected channels, and that will not be async.
     * @param key The custom ID of the channel select menu to get the value of.
     * @param required Whether the channel select menu is required.
     * @returns The IDs of the selected channels, or undefined if the select menu was not provided and it is not required.
     */
    getChannelSelect(key: string, required?: false): Promise<AnyChannel[] | undefined>;
    getChannelSelect(key: string, required: true): Promise<AnyChannel[]>;
    /**
     * Get the users selected in a user select.
     * @param key The custom ID of the user select menu to get the value of.
     * @param required Whether the user select menu is required.
     * @returns The IDs of the selected users, or undefined if the select menu was not provided and it is not required.
     */
    getUserSelect(key: string, required?: false): User[] | undefined;
    getUserSelect(key: string, required: true): User[];
    getRoleSelect(key: string, required?: false): Role[] | undefined;
    getRoleSelect(key: string, required: true): Role[];
    getMentionableSelect(key: string, required?: false): {
        users: User[];
        roles: Role[];
    } | undefined;
    getMentionableSelect(key: string, required: true): {
        users: User[];
        roles: Role[];
    };
    getFile(key: string, required?: false): ResolvedFile[] | undefined;
    getFile(key: string, required: true): ResolvedFile[];
}
//# sourceMappingURL=FieldsHandler.d.ts.map