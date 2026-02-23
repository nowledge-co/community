import type { APIModalSubmitInteraction } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { Modal } from "../classes/Modal.js";
export declare class ModalHandler extends Base {
    modals: Modal[];
    /**
     * Register a modal with the handler
     * @internal
     */
    registerModal(modal: Modal): void;
    /**
     * Handle an interaction
     * @internal
     */
    handleInteraction(data: APIModalSubmitInteraction): Promise<unknown>;
}
//# sourceMappingURL=ModalHandler.d.ts.map