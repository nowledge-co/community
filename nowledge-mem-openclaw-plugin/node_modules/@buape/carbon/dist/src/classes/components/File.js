import { ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
/**
 * Each file component can only display 1 attached file, but you can upload multiple files and add them to different file components within your payload.
 */
export class File extends BaseComponent {
    type = ComponentType.File;
    isV2 = true;
    /**
     * The attachment to display in the file component.
     */
    file;
    /**
     * Whether the file should be displayed as a spoiler.
     */
    spoiler = false;
    constructor(file, spoiler) {
        super();
        this.file = file || undefined;
        this.spoiler = spoiler ?? false;
    }
    serialize = () => {
        if (!this.file) {
            throw new Error("File component must have a file attached");
        }
        return {
            type: ComponentType.File,
            id: this.id,
            file: {
                url: this.file
            },
            spoiler: this.spoiler
        };
    };
}
//# sourceMappingURL=File.js.map