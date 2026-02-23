export class BaseComponent {
    /**
     * 32 bit integer used as an optional identifier for component
     * The id field is optional and is used to identify components in the response from an interaction that aren't interactive components.
     * The id must be unique within the message and is generated sequentially by Discord if left empty.
     * Generation of ids won't use another id that exists in the message if you have one defined for another component.
     */
    id;
}
//# sourceMappingURL=BaseComponent.js.map