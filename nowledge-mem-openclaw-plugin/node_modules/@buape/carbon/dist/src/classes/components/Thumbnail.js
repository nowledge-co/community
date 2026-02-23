import { ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
export class Thumbnail extends BaseComponent {
    type = ComponentType.Thumbnail;
    isV2 = true;
    /**
     * The URL of the thumbnail. This can either be a direct online URL or an attachment://<name> reference
     */
    url;
    constructor(url) {
        super();
        if (url)
            this.url = url;
    }
    serialize = () => {
        if (!this.url)
            throw new Error("Thumbnail must have a URL");
        return {
            type: this.type,
            id: this.id,
            media: {
                url: this.url
            }
        };
    };
}
//# sourceMappingURL=Thumbnail.js.map