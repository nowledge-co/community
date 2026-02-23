import { ButtonStyle, ComponentType } from "discord-api-types/v10";
import { BaseMessageInteractiveComponent } from "../../abstracts/BaseMessageInteractiveComponent.js";
class BaseButton extends BaseMessageInteractiveComponent {
    type = ComponentType.Button;
    isV2 = false;
    /**
     * The emoji of the button
     */
    emoji;
    /**
     * The style of the button
     */
    style = ButtonStyle.Primary;
    /**
     * The disabled state of the button
     */
    disabled = false;
}
export class Button extends BaseButton {
    run(interaction, data) {
        // Random things to show the vars as used
        typeof interaction === "string";
        typeof data === "string";
        return;
    }
    serialize = () => {
        if (this.style === ButtonStyle.Link) {
            throw new Error("Link buttons cannot be serialized. Are you using the right class?");
        }
        if (this.style === ButtonStyle.Premium) {
            throw new Error("Premium buttons cannot be serialized. Are you using the right class?");
        }
        return {
            type: ComponentType.Button,
            style: this.style,
            label: this.label,
            custom_id: this.customId,
            disabled: this.disabled,
            emoji: this.emoji
        };
    };
}
export class LinkButton extends BaseButton {
    customId = "link";
    style = ButtonStyle.Link;
    run = async () => {
        throw new Error("Link buttons cannot be used in a run method");
    };
    serialize = () => {
        return {
            type: ComponentType.Button,
            url: this.url,
            style: this.style,
            label: this.label,
            disabled: this.disabled,
            emoji: this.emoji
        };
    };
}
export class PremiumButton extends BaseButton {
    style = ButtonStyle.Premium;
    serialize = () => {
        return {
            style: this.style,
            type: ComponentType.Button,
            disabled: this.disabled,
            sku_id: this.sku_id
        };
    };
}
//# sourceMappingURL=Button.js.map