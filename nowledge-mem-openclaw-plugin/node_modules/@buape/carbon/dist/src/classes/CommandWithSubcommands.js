import { ApplicationCommandOptionType, ApplicationCommandType } from "discord-api-types/v10";
import { BaseCommand } from "../abstracts/BaseCommand.js";
/**
 * Represents a subcommand command that the user creates.
 * You make this instead of a {@link Command} class when you want to have subcommands in your options.
 */
export class CommandWithSubcommands extends BaseCommand {
    type = ApplicationCommandType.ChatInput;
    /**
     * @internal
     */
    serializeOptions() {
        return this.subcommands.map((subcommand) => ({
            ...subcommand.serialize(),
            type: ApplicationCommandOptionType.Subcommand
        }));
    }
}
//# sourceMappingURL=CommandWithSubcommands.js.map