import { ComponentType } from "discord-api-types/v10";
import { AnySelectMenu } from "../../abstracts/AnySelectMenu.js";
export class MentionableSelectMenu extends AnySelectMenu {
    type = ComponentType.MentionableSelect;
    isV2 = false;
    defaultValues;
    run(interaction, data) {
        // Random things to show the vars as used
        typeof interaction === "string";
        typeof data === "string";
        return;
    }
    serializeOptions() {
        return {
            type: this.type,
            default_values: this.defaultValues
        };
    }
}
//# sourceMappingURL=MentionableSelectMenu.js.map