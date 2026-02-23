import { type APIFileUploadComponent, ComponentType } from "discord-api-types/v10";
import { BaseModalComponent } from "../../abstracts/BaseModalComponent.js";
export declare abstract class FileUpload extends BaseModalComponent {
    readonly type = ComponentType.FileUpload;
    abstract customId: string;
    /**
     * The minimum number of files that must be uploaded
     * Defaults to 1, minimum is 0, maximum is 10
     */
    minValues?: number;
    /**
     * The maximum number of files that can be uploaded
     * Defaults to 1, maximum is 10
     */
    maxValues?: number;
    /**
     * Whether the component is required
     * Defaults to true
     */
    required?: boolean;
    serialize: () => APIFileUploadComponent;
}
//# sourceMappingURL=FileUpload.d.ts.map