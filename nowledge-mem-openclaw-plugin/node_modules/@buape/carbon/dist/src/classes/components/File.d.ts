import type { APIFileComponent } from "discord-api-types/v10";
import { ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
/**
 * Each file component can only display 1 attached file, but you can upload multiple files and add them to different file components within your payload.
 */
export declare class File extends BaseComponent {
    readonly type: ComponentType.File;
    readonly isV2 = true;
    /**
     * The attachment to display in the file component.
     */
    file: `attachment://${string}` | undefined;
    /**
     * Whether the file should be displayed as a spoiler.
     */
    spoiler: boolean;
    constructor(file?: `attachment://${string}`, spoiler?: boolean);
    serialize: () => APIFileComponent;
}
//# sourceMappingURL=File.d.ts.map