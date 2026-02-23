import { BaseModalComponent } from "../../abstracts/BaseModalComponent.js";
export class RadioGroup extends BaseModalComponent {
    type = 21;
    /**
     * The options in the radio group
     */
    options = [];
    /**
     * Whether the radio group is required
     */
    required;
    /**
     * The minimum number of options that must be selected
     */
    minValues;
    /**
     * The maximum number of options that can be selected
     */
    maxValues;
    serialize = () => {
        const data = {
            type: this.type,
            custom_id: this.customId,
            options: this.options
        };
        if (this.id !== undefined)
            data.id = this.id;
        if (this.required !== undefined)
            data.required = this.required;
        return data;
    };
}
//# sourceMappingURL=RadioGroup.js.map