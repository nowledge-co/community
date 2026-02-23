import { ComponentType } from "discord-api-types/v10";
import { AnySelectMenu } from "../../abstracts/AnySelectMenu.js";
export class StringSelectMenu extends AnySelectMenu {
    type = ComponentType.StringSelect;
    isV2 = false;
    run(interaction, data) {
        // Random things to show the vars as used
        typeof interaction === "string";
        typeof data === "string";
        return;
    }
    serializeOptions() {
        return {
            type: this.type,
            options: this.options
        };
    }
}
//# sourceMappingURL=StringSelectMenu.js.map