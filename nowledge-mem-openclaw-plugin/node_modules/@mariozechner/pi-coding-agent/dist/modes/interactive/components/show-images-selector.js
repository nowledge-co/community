import { Container, SelectList } from "@mariozechner/pi-tui";
import { getSelectListTheme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";
/**
 * Component that renders a show images selector with borders
 */
export class ShowImagesSelectorComponent extends Container {
    selectList;
    constructor(currentValue, onSelect, onCancel) {
        super();
        const items = [
            { value: "yes", label: "Yes", description: "Show images inline in terminal" },
            { value: "no", label: "No", description: "Show text placeholder instead" },
        ];
        // Add top border
        this.addChild(new DynamicBorder());
        // Create selector
        this.selectList = new SelectList(items, 5, getSelectListTheme());
        // Preselect current value
        this.selectList.setSelectedIndex(currentValue ? 0 : 1);
        this.selectList.onSelect = (item) => {
            onSelect(item.value === "yes");
        };
        this.selectList.onCancel = () => {
            onCancel();
        };
        this.addChild(this.selectList);
        // Add bottom border
        this.addChild(new DynamicBorder());
    }
    getSelectList() {
        return this.selectList;
    }
}
//# sourceMappingURL=show-images-selector.js.map