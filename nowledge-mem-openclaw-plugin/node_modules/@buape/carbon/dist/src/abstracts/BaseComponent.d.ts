import type { APIMessageComponent, APIModalComponent2, ComponentType } from "discord-api-types/v10";
export declare abstract class BaseComponent {
    /**
     * The type of the component
     */
    abstract readonly type: ComponentType | number;
    /**
     * Whether the component is a v2 component and requires the IS_COMPONENTS_V2 flag
     */
    abstract readonly isV2: boolean;
    /**
     * 32 bit integer used as an optional identifier for component
     * The id field is optional and is used to identify components in the response from an interaction that aren't interactive components.
     * The id must be unique within the message and is generated sequentially by Discord if left empty.
     * Generation of ids won't use another id that exists in the message if you have one defined for another component.
     */
    id?: number;
    abstract serialize: () => APIMessageComponent | APIModalComponent2;
}
//# sourceMappingURL=BaseComponent.d.ts.map