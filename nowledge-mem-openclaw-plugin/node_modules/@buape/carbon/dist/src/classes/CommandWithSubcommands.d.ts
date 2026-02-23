import { ApplicationCommandType, type RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10";
import { BaseCommand } from "../abstracts/BaseCommand.js";
import type { Command } from "./Command.js";
/**
 * Represents a subcommand command that the user creates.
 * You make this instead of a {@link Command} class when you want to have subcommands in your options.
 */
export declare abstract class CommandWithSubcommands extends BaseCommand {
    type: ApplicationCommandType;
    /**
     * The subcommands that the user can use
     */
    abstract subcommands: Command[];
    /**
     * @internal
     */
    serializeOptions(): RESTPostAPIApplicationCommandsJSONBody["options"];
}
//# sourceMappingURL=CommandWithSubcommands.d.ts.map