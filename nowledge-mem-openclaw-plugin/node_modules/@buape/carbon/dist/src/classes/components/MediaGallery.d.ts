import { type APIMediaGalleryComponent, ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
/**
 * A media gallery component can display between 1 and 10 images.
 * Each image can be a direct online URL or an attachment://<name> reference.
 */
export declare class MediaGallery extends BaseComponent {
    readonly type: ComponentType.MediaGallery;
    readonly isV2 = true;
    items: Array<{
        url: string;
        description?: string;
        spoiler?: boolean;
    }>;
    constructor(items?: Array<{
        url: string;
        description?: string;
        spoiler?: boolean;
    }>);
    serialize: () => APIMediaGalleryComponent;
}
//# sourceMappingURL=MediaGallery.d.ts.map