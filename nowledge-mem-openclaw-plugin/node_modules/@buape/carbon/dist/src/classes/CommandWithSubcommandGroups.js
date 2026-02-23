import { ApplicationCommandOptionType } from "discord-api-types/v10";
import { CommandWithSubcommands } from "./CommandWithSubcommands.js";
/**
 * Represents a subcommand group command that the user creates.
 * You make this instead of a {@link Command} class when you want to have subcommand groups in your options.
 */
export class CommandWithSubcommandGroups extends CommandWithSubcommands {
    /**
     * The subcommands that the user can use
     */
    subcommands = [];
    /**
     * @internal
     */
    serializeOptions() {
        const subcommands = this.subcommands.map((subcommand) => ({
            ...subcommand.serialize(),
            type: ApplicationCommandOptionType.Subcommand
        }));
        const subcommandGroups = this.subcommandGroups.map((subcommandGroup) => ({
            ...subcommandGroup.serialize(),
            type: ApplicationCommandOptionType.SubcommandGroup
        }));
        return [...subcommands, ...subcommandGroups];
    }
}
//# sourceMappingURL=CommandWithSubcommandGroups.js.map