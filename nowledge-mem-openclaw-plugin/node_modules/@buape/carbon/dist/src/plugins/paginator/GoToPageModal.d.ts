import { Label } from "../../classes/components/Label.js";
import { Modal } from "../../classes/Modal.js";
import type { ModalInteraction } from "../../internals/ModalInteraction.js";
import type { ComponentData } from "../../types/index.js";
export declare class GoToPageModal extends Modal {
    title: string;
    customId: string;
    components: PageNumberLabel[];
    constructor(paginatorId: string, maxPages: number);
    run(interaction: ModalInteraction, data: ComponentData): Promise<void | import("../../index.js").Message<false>>;
}
declare class PageNumberLabel extends Label {
    label: string;
    description: string;
    constructor();
}
export {};
//# sourceMappingURL=GoToPageModal.d.ts.map