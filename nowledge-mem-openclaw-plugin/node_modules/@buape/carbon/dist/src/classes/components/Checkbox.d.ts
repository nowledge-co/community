import type { APICheckboxActionComponent } from "discord-api-types/v10";
import { BaseModalComponent } from "../../abstracts/BaseModalComponent.js";
export declare abstract class Checkbox extends BaseModalComponent {
    readonly type: 23;
    abstract customId: string;
    /**
     * Whether the checkbox is checked by default
     */
    default?: boolean;
    serialize: () => APICheckboxActionComponent;
}
//# sourceMappingURL=Checkbox.d.ts.map