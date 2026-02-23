import type { APIThumbnailComponent } from "discord-api-types/v10";
import { ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
export declare class Thumbnail extends BaseComponent {
    readonly type: ComponentType.Thumbnail;
    readonly isV2 = true;
    /**
     * The URL of the thumbnail. This can either be a direct online URL or an attachment://<name> reference
     */
    url?: string;
    constructor(url?: string);
    serialize: () => APIThumbnailComponent;
}
//# sourceMappingURL=Thumbnail.d.ts.map