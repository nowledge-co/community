import { type APIApplicationCommandBasicOption, ApplicationCommandType } from "discord-api-types/v10";
import { type AutocompleteInteraction, BaseCommand, type CommandInteraction } from "../index.js";
export type CommandOption = APIApplicationCommandBasicOption | (Omit<APIApplicationCommandBasicOption, "autocomplete"> & {
    autocomplete: (interaction: AutocompleteInteraction) => Promise<void>;
});
export type CommandOptions = CommandOption[];
/**
 * Represents a standard command that the user creates
 */
export declare abstract class Command extends BaseCommand {
    /**
     * The options that the user passes along with the command in Discord
     */
    options?: CommandOptions;
    /**
     * The type of command, either ChatInput, User, or Message. User and Message are context menu commands.
     * @default ChatInput
     */
    type: ApplicationCommandType;
    /**
     * The function that is called when the command is ran
     * @param interaction The interaction that triggered the command
     */
    abstract run(interaction: CommandInteraction): unknown | Promise<unknown>;
    /**
     * The function that is called when the command's autocomplete is triggered.
     * @param interaction The interaction that triggered the autocomplete
     * @remarks You are expected to `override` this function to provide your own autocomplete functionality.
     */
    autocomplete(interaction: AutocompleteInteraction): Promise<void>;
    /**
     * The function that is called before the command is ran.
     * You can use this to run things such as cooldown checks, extra permission checks, etc.
     * If this returns anything other than `true`, the command will not run.
     * @param interaction The interaction that triggered the command
     * @returns Whether the command should continue to run
     */
    preCheck(interaction: CommandInteraction): Promise<true | unknown>;
    /**
     * @internal
     */
    serializeOptions(): APIApplicationCommandBasicOption[] | undefined;
}
//# sourceMappingURL=Command.d.ts.map