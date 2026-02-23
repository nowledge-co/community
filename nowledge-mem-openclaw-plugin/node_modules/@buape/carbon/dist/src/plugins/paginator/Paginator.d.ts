import type { Client } from "../../classes/Client.js";
import type { ButtonInteraction } from "../../internals/ButtonInteraction.js";
import type { CommandInteraction } from "../../internals/CommandInteraction.js";
import type { ModalInteraction } from "../../internals/ModalInteraction.js";
import type { MessagePayloadObject } from "../../types/index.js";
export declare class Paginator {
    readonly pages: MessagePayloadObject[];
    readonly id: string;
    protected currentPage: number;
    private timeout;
    private readonly timeoutDuration;
    /**
     * The user ID who is allowed to interact with the paginator
     */
    readonly userId?: string;
    constructor(
    /**
     * The pages to display in the paginator, with no limit on the amount of pages
     */
    pages: typeof this.pages, { 
    /**
     * The client to use for the paginator
     */
    client, 
    /**
     * How long in milliseconds the paginator will wait before disabling the buttons
     * @default 300000 (5 minutes)
     */
    timeoutDuration, 
    /**
     * The user ID who is allowed to interact with the paginator
     */
    userId }: {
        client: Client;
        timeoutDuration?: number;
        userId?: string;
    });
    private startTimeout;
    private disableButtons;
    destroy(): void;
    private getCurrentPage;
    goToPage(pageIndex: number, interaction: ButtonInteraction): Promise<import("../../index.js").Message<false> | undefined>;
    goToPageFromModal(pageIndex: number, interaction: ModalInteraction): Promise<import("../../index.js").Message<false> | undefined>;
    private createNavigationButtons;
    private getCurrentPageWithButtons;
    getInitialPage(): MessagePayloadObject;
    /**
     * Sends the paginator message using the provided interaction
     * @param interaction The interaction to use for sending the message
     */
    send(interaction: CommandInteraction): Promise<void>;
}
//# sourceMappingURL=Paginator.d.ts.map