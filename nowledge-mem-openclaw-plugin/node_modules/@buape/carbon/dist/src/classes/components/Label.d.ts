import { ComponentType } from "discord-api-types/v10";
import type { AnySelectMenu } from "../../abstracts/AnySelectMenu.js";
import { BaseModalComponent } from "../../abstracts/BaseModalComponent.js";
import type { APILabelComponent2 } from "../../types/index.js";
import type { Checkbox } from "./Checkbox.js";
import type { CheckboxGroup } from "./CheckboxGroup.js";
import type { FileUpload } from "./FileUpload.js";
import type { RadioGroup } from "./RadioGroup.js";
import type { TextInput } from "./TextInput.js";
export declare abstract class Label extends BaseModalComponent {
    readonly type = ComponentType.Label;
    /**
     * The label text
     */
    abstract label: string;
    /**
     * The description of the label (optional)
     */
    description?: string;
    /**
     * The component within this label
     */
    component?: TextInput | AnySelectMenu | FileUpload | Checkbox | CheckboxGroup | RadioGroup;
    /**
     * The custom ID of the label - required by BaseModalComponent
     */
    customId: string;
    constructor(component?: TextInput | AnySelectMenu | FileUpload | Checkbox | CheckboxGroup | RadioGroup);
    serialize: () => APILabelComponent2;
}
//# sourceMappingURL=Label.d.ts.map