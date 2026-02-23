import { type APIApplicationCommandSubcommandGroupOption, type APIApplicationCommandSubcommandOption } from "discord-api-types/v10";
import type { Command } from "./Command.js";
import { CommandWithSubcommands } from "./CommandWithSubcommands.js";
/**
 * Represents a subcommand group command that the user creates.
 * You make this instead of a {@link Command} class when you want to have subcommand groups in your options.
 */
export declare abstract class CommandWithSubcommandGroups extends CommandWithSubcommands {
    /**
     * The subcommands that the user can use
     */
    subcommands: Command[];
    /**
     * The subcommands that the user can use
     */
    abstract subcommandGroups: CommandWithSubcommands[];
    /**
     * @internal
     */
    serializeOptions(): (APIApplicationCommandSubcommandGroupOption | APIApplicationCommandSubcommandOption)[];
}
//# sourceMappingURL=CommandWithSubcommandGroups.d.ts.map