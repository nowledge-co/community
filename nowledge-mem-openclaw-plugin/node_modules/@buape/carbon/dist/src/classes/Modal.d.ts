import type { ModalInteraction } from "../internals/ModalInteraction.js";
import type { APIModalInteractionResponseCallbackData2, ComponentData, ComponentParserResult } from "../types/index.js";
import type { Label } from "./components/Label.js";
import type { TextDisplay } from "./components/TextDisplay.js";
export declare abstract class Modal {
    /**
     * The title of the modal
     */
    abstract title: string;
    /**
     * The components of the modal
     */
    components: (Label | TextDisplay)[];
    /**
     * The custom ID of the component.
     * If you want to provide a custom ID with additional data, you should either follow the default parser's format or implement your own custom parser.
     *
     * @see {@link customIdParser}
     */
    abstract customId: string;
    /**
     * This function is called by the handler when a component is received, and is used to parse the custom ID into a key and data object.
     * By default, the ID is parsed in this format: `key:arg1=true;arg2=2;arg3=cheese`, where `arg1`, `arg2`, and `arg3` are the data arguments.
     * It will also automatically parse `true` and `false` as booleans, and will parse numbers as numbers.
     *
     * You can override this to parse the ID in a different format as you see fit, but it must follow these rules:
     * - The ID must have a `key` somewhere in the ID that can be returned by the parser. This key is what Carbon's component handler will use to identify the component and pass an interaction to the correct component.
     * - The data must be able to be arbitrary as far as Carbon's handler is concerned, meaning that any component with the same base key can be treated as the same component with logic within the component's logic methods to handle the data.
     *
     * @param id - The custom ID of the component as received from an interaction event
     * @returns The base key and the data object
     */
    customIdParser: (id: string) => ComponentParserResult;
    abstract run(interaction: ModalInteraction, data: ComponentData): unknown | Promise<unknown>;
    serialize: () => APIModalInteractionResponseCallbackData2;
}
//# sourceMappingURL=Modal.d.ts.map