import { type APIContainerComponent, ComponentType } from "discord-api-types/v10";
import { BaseComponent } from "../../abstracts/BaseComponent.js";
import type { BaseMessageInteractiveComponent } from "../../abstracts/BaseMessageInteractiveComponent.js";
import type { File } from "./File.js";
import type { MediaGallery } from "./MediaGallery.js";
import type { Row } from "./Row.js";
import type { Section } from "./Section.js";
import type { Separator } from "./Separator.js";
import type { TextDisplay } from "./TextDisplay.js";
export declare class Container extends BaseComponent {
    readonly type: ComponentType.Container;
    readonly isV2 = true;
    components: (Row<BaseMessageInteractiveComponent> | TextDisplay | Section | MediaGallery | Separator | File)[];
    /**
     * The accent color of the container
     */
    accentColor?: `#${string}` | string | number;
    /**
     * Whether the container should be marked a spoiler
     */
    spoiler: boolean;
    constructor(components?: (Row<BaseMessageInteractiveComponent> | TextDisplay | Section | MediaGallery | Separator | File)[], options?: {
        accentColor?: `#${string}` | string | number;
        spoiler?: boolean;
    });
    serialize: () => APIContainerComponent;
}
//# sourceMappingURL=Container.d.ts.map