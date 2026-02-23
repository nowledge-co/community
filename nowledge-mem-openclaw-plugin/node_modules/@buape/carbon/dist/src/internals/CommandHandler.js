import { ApplicationCommandOptionType, ApplicationCommandType } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import { Command } from "../classes/Command.js";
import { CommandWithSubcommandGroups } from "../classes/CommandWithSubcommandGroups.js";
import { CommandWithSubcommands } from "../classes/CommandWithSubcommands.js";
import { AutocompleteInteraction } from "./AutocompleteInteraction.js";
import { CommandInteraction } from "./CommandInteraction.js";
export class CommandHandler extends Base {
    getSubcommand(command, rawInteraction) {
        if (rawInteraction.data.type !== ApplicationCommandType.ChatInput) {
            throw new Error("Subcommands must be used with ChatInput");
        }
        const data = rawInteraction.data;
        const subcommand = command.subcommands.find((x) => x.name === data.options?.[0]?.name);
        if (!subcommand)
            throw new Error("Subcommand not found");
        return subcommand;
    }
    getCommand(rawInteraction) {
        let command = this.client.commands.find((x) => x.name === rawInteraction.data.name);
        if (!command)
            command = this.client.commands.find((x) => x.name === "*");
        if (!command)
            throw new Error("Command not found");
        if (command instanceof CommandWithSubcommandGroups) {
            if (rawInteraction.data.type !== ApplicationCommandType.ChatInput) {
                throw new Error("Subcommand groups must be used with ChatInput");
            }
            const data = rawInteraction.data;
            const subcommandGroupName = data.options?.find((x) => x.type === ApplicationCommandOptionType.SubcommandGroup)?.name;
            if (!subcommandGroupName) {
                try {
                    return this.getSubcommand(command, rawInteraction);
                }
                catch {
                    throw new Error("No subcommand group name or subcommand found");
                }
            }
            const subcommandGroup = command.subcommandGroups.find((x) => x.name === subcommandGroupName);
            if (!subcommandGroup)
                throw new Error("Subcommand group not found");
            const subcommandName = (data.options?.find((x) => x.type === ApplicationCommandOptionType.SubcommandGroup)).options?.find((x) => x.type === ApplicationCommandOptionType.Subcommand)?.name;
            if (!subcommandName)
                throw new Error("No subcommand name");
            const subcommand = subcommandGroup.subcommands.find((x) => x.name === subcommandName);
            if (!subcommand)
                throw new Error("Subcommand not found");
            return subcommand;
        }
        if (command instanceof CommandWithSubcommands) {
            return this.getSubcommand(command, rawInteraction);
        }
        if (command instanceof Command) {
            return command;
        }
        throw new Error("Command is not a valid command type");
    }
    /**
     * Handle a command interaction
     * @internal
     */
    async handleCommandInteraction(rawInteraction) {
        const command = this.getCommand(rawInteraction);
        if (!command)
            return false;
        if (command.components) {
            for (const component of command.components) {
                this.client.componentHandler.registerComponent(component);
            }
        }
        const interaction = new CommandInteraction({
            client: this.client,
            data: rawInteraction,
            defaults: {
                ephemeral: typeof command.ephemeral === "function"
                    ? false // Will be resolved later after interaction is created
                    : command.ephemeral
            },
            processingCommand: command
        });
        try {
            const command = this.getCommand(rawInteraction);
            // Resolve ephemeral setting if it's a function
            if (typeof command.ephemeral === "function") {
                interaction.setDefaultEphemeral(command.ephemeral(interaction));
            }
            // Resolve defer setting if it's a function
            const shouldDefer = typeof command.defer === "function"
                ? command.defer(interaction)
                : command.defer;
            if (shouldDefer) {
                await interaction.defer();
            }
            if (command.preCheck) {
                const result = await command.preCheck(interaction);
                if (!result)
                    return false;
            }
            return await command.run(interaction);
        }
        catch (e) {
            if (e instanceof Error)
                console.error(e.message);
            console.error(e);
        }
    }
    async handleAutocompleteInteraction(rawInteraction) {
        const command = this.getCommand(rawInteraction);
        if (!command)
            return false;
        const interaction = new AutocompleteInteraction({
            client: this.client,
            data: rawInteraction,
            defaults: {
                ephemeral: typeof command.ephemeral === "function"
                    ? false // Autocomplete interactions don't use ephemeral typically, but resolve for consistency
                    : command.ephemeral
            },
            processingCommand: command
        });
        try {
            const command = this.getCommand(rawInteraction);
            // Check if the focused option has its own autocomplete function
            const focusedOption = interaction.options.getFocused();
            if (focusedOption && command.options) {
                const optionDefinition = command.options.find((opt) => opt.name === focusedOption.name);
                if (optionDefinition &&
                    "autocomplete" in optionDefinition &&
                    typeof optionDefinition.autocomplete === "function") {
                    return await optionDefinition.autocomplete(interaction);
                }
            }
            // Fall back to command-level autocomplete
            return await command.autocomplete(interaction);
        }
        catch (e) {
            if (e instanceof Error)
                console.error(e.message);
            console.error(e);
        }
    }
}
//# sourceMappingURL=CommandHandler.js.map