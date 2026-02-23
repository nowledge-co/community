import { type APIApplicationCommandAutocompleteInteraction, type APIApplicationCommandInteraction } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
export declare class CommandHandler extends Base {
    private getSubcommand;
    private getCommand;
    /**
     * Handle a command interaction
     * @internal
     */
    handleCommandInteraction(rawInteraction: APIApplicationCommandInteraction): Promise<unknown>;
    handleAutocompleteInteraction(rawInteraction: APIApplicationCommandAutocompleteInteraction): Promise<false | void>;
}
//# sourceMappingURL=CommandHandler.d.ts.map