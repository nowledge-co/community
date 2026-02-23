import { type APIButtonComponent, type APIButtonComponentWithSKUId, type APIButtonComponentWithURL, ButtonStyle, ComponentType } from "discord-api-types/v10";
import { BaseMessageInteractiveComponent } from "../../abstracts/BaseMessageInteractiveComponent.js";
import type { ButtonInteraction } from "../../internals/ButtonInteraction.js";
import type { ComponentData } from "../../types/index.js";
declare abstract class BaseButton extends BaseMessageInteractiveComponent {
    readonly type: ComponentType.Button;
    readonly isV2 = false;
    /**
     * The label of the button
     */
    abstract label: string;
    /**
     * The emoji of the button
     */
    emoji?: {
        name: string;
        id?: string;
        animated?: boolean;
    };
    /**
     * The style of the button
     */
    style: ButtonStyle;
    /**
     * The disabled state of the button
     */
    disabled: boolean;
}
export declare abstract class Button extends BaseButton {
    run(interaction: ButtonInteraction, data: ComponentData): unknown | Promise<unknown>;
    serialize: () => APIButtonComponent;
}
export declare abstract class LinkButton extends BaseButton {
    customId: string;
    /**
     * The URL that the button links to
     */
    abstract url: string;
    style: ButtonStyle.Link;
    run: () => Promise<never>;
    serialize: () => APIButtonComponentWithURL;
}
export declare abstract class PremiumButton extends BaseButton {
    style: ButtonStyle.Premium;
    /**
     * The SKU ID of the button
     */
    abstract sku_id: string;
    serialize: () => APIButtonComponentWithSKUId;
}
export {};
//# sourceMappingURL=Button.d.ts.map