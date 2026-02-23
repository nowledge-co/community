import type { APICheckboxActionComponent, APICheckboxGroupActionComponent, APIFileUploadComponent, APIRadioGroupActionComponent, APITextInputComponent, ComponentType } from "discord-api-types/v10";
import type { APILabelComponent2 } from "../types/index.js";
import { BaseComponent } from "./BaseComponent.js";
export declare abstract class BaseModalComponent extends BaseComponent {
    abstract type: ComponentType;
    readonly isV2 = true;
    abstract serialize: () => APITextInputComponent | APILabelComponent2 | APIFileUploadComponent | APICheckboxGroupActionComponent | APICheckboxActionComponent | APIRadioGroupActionComponent;
}
//# sourceMappingURL=BaseModalComponent.d.ts.map