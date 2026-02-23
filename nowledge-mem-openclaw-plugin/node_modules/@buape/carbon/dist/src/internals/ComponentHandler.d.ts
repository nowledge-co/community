import { type APIMessageComponentInteraction, type APIMessageComponentInteractionData, type ComponentType } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { BaseMessageInteractiveComponent } from "../abstracts/BaseMessageInteractiveComponent.js";
export declare class ComponentHandler extends Base {
    private componentCache;
    oneOffComponents: Map<`${string}-${string}`, {
        resolve: (data: APIMessageComponentInteractionData) => void;
    }>;
    private getComponentCacheKey;
    registerComponent(component: BaseMessageInteractiveComponent): void;
    hasComponentWithKey(key: string, componentType?: ComponentType): boolean;
    findComponent(customId: string, componentType: ComponentType): BaseMessageInteractiveComponent | undefined;
    handleInteraction(data: APIMessageComponentInteraction): Promise<void>;
}
//# sourceMappingURL=ComponentHandler.d.ts.map