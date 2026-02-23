import { BaseMessageInteractiveComponent } from "./BaseMessageInteractiveComponent.js";
export class AnySelectMenu extends BaseMessageInteractiveComponent {
    run(interaction, data) {
        // Random things to show the vars as used
        typeof interaction === "string";
        typeof data === "string";
        return;
    }
    minValues;
    maxValues;
    /**
     * Not available in modals, will throw an error if used
     */
    disabled;
    placeholder;
    /**
     * Defaults to true in modals, ignored in messages
     */
    required;
    serialize = () => {
        const options = this.serializeOptions();
        const extra = this.serializeExtra();
        const data = {
            ...options,
            custom_id: this.customId,
            placeholder: this.placeholder,
            min_values: this.minValues,
            max_values: this.maxValues,
            required: this.required,
            ...extra
        };
        if (this.disabled) {
            data.disabled = true;
        }
        return data;
    };
    serializeExtra() {
        return {};
    }
}
//# sourceMappingURL=AnySelectMenu.js.map