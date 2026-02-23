import { ComponentType } from "discord-api-types/v10";
import { BaseModalComponent } from "../../abstracts/BaseModalComponent.js";
export class FileUpload extends BaseModalComponent {
    type = ComponentType.FileUpload;
    /**
     * The minimum number of files that must be uploaded
     * Defaults to 1, minimum is 0, maximum is 10
     */
    minValues;
    /**
     * The maximum number of files that can be uploaded
     * Defaults to 1, maximum is 10
     */
    maxValues;
    /**
     * Whether the component is required
     * Defaults to true
     */
    required;
    serialize = () => {
        const data = {
            type: this.type,
            custom_id: this.customId
        };
        if (this.id !== undefined)
            data.id = this.id;
        if (this.minValues !== undefined)
            data.min_values = this.minValues;
        if (this.maxValues !== undefined)
            data.max_values = this.maxValues;
        if (this.required !== undefined)
            data.required = this.required;
        return data;
    };
}
//# sourceMappingURL=FileUpload.js.map