import { Base } from "../abstracts/Base.js";
import { ModalInteraction } from "./ModalInteraction.js";
export class ModalHandler extends Base {
    modals = [];
    /**
     * Register a modal with the handler
     * @internal
     */
    registerModal(modal) {
        if (!this.modals.find((x) => x.customId === modal.customId)) {
            this.modals.push(modal);
        }
    }
    /**
     * Handle an interaction
     * @internal
     */
    async handleInteraction(data) {
        let modal = this.modals.find((x) => {
            const modalKey = x.customIdParser(x.customId).key;
            const interactionKey = x.customIdParser(data.data.custom_id).key;
            return modalKey === interactionKey;
        });
        if (!modal) {
            modal = this.modals.find((x) => {
                const modalKey = x.customIdParser(x.customId).key;
                return modalKey === "*";
            });
        }
        if (!modal)
            return false;
        return await modal.run(new ModalInteraction(this.client, data, {}), modal.customIdParser(data.data.custom_id).data);
    }
}
//# sourceMappingURL=ModalHandler.js.map