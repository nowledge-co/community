import type { APIRadioGroupActionComponent } from "discord-api-types/v10";
import { BaseModalComponent } from "../../abstracts/BaseModalComponent.js";
export declare abstract class RadioGroup extends BaseModalComponent {
    readonly type: 21;
    abstract customId: string;
    /**
     * The options in the radio group
     */
    options: APIRadioGroupActionComponent["options"];
    /**
     * Whether the radio group is required
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
    serialize: () => APIRadioGroupActionComponent;
}
//# sourceMappingURL=RadioGroup.d.ts.map