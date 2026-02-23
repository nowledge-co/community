import type { APICheckboxGroupActionComponent } from "discord-api-types/v10";
import { BaseModalComponent } from "../../abstracts/BaseModalComponent.js";
export declare abstract class CheckboxGroup extends BaseModalComponent {
    readonly type: 22;
    abstract customId: string;
    /**
     * The options in the checkbox group
     */
    options: APICheckboxGroupActionComponent["options"];
    /**
     * Whether the checkbox group is required
     */
    required?: boolean;
    /**
     * The minimum number of options that must be selected
     */
    minValues?: number;
    /**
     * The maximum number of options that can be selected
     */
    maxValues?: number;
    serialize: () => APICheckboxGroupActionComponent;
}
//# sourceMappingURL=CheckboxGroup.d.ts.map