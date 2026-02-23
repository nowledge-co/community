import { BaseModalComponent } from "../../abstracts/BaseModalComponent.js";
export class Checkbox extends BaseModalComponent {
    type = 23;
    /**
     * Whether the checkbox is checked by default
     */
    default;
    serialize = () => {
        const data = {
            type: this.type,
            custom_id: this.customId
        };
        if (this.id !== undefined)
            data.id = this.id;
        if (this.default !== undefined)
            data.default = this.default;
        return data;
    };
}
//# sourceMappingURL=Checkbox.js.map