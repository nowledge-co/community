import { ApplicationCommandType } from "discord-api-types/v10";
import { enforceChoicesLimit } from "../functions/enforceChoicesLimit.js";
import { BaseCommand } from "../index.js";
/**
 * Represents a standard command that the user creates
 */
export class Command extends BaseCommand {
    /**
     * The options that the user passes along with the command in Discord
     */
    options;
    /**
     * The type of command, either ChatInput, User, or Message. User and Message are context menu commands.
     * @default ChatInput
     */
    type = ApplicationCommandType.ChatInput;
    /**
     * The function that is called when the command's autocomplete is triggered.
     * @param interaction The interaction that triggered the autocomplete
     * @remarks You are expected to `override` this function to provide your own autocomplete functionality.
     */
    async autocomplete(interaction) {
        throw new Error(`The ${interaction.rawData.data.name} command does not support autocomplete`);
    }
    /**
     * The function that is called before the command is ran.
     * You can use this to run things such as cooldown checks, extra permission checks, etc.
     * If this returns anything other than `true`, the command will not run.
     * @param interaction The interaction that triggered the command
     * @returns Whether the command should continue to run
     */
    async preCheck(interaction) {
        return !!interaction;
    }
    /**
     * @internal
     */
    serializeOptions() {
        const processedOptions = this.options?.map((option) => {
            if ("autocomplete" in option &&
                typeof option.autocomplete === "function") {
                const { autocomplete, ...rest } = option;
                return {
                    ...rest,
                    autocomplete: true
                };
            }
            return option;
        });
        return enforceChoicesLimit(processedOptions);
    }
}
//# sourceMappingURL=Command.js.map