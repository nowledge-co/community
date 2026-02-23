import { Container, SelectList } from "@mariozechner/pi-tui";
import { getAvailableThemes, getSelectListTheme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";
/**
 * Component that renders a theme selector
 */
export class ThemeSelectorComponent extends Container {
    selectList;
    onPreview;
    constructor(currentTheme, onSelect, onCancel, onPreview) {
        super();
        this.onPreview = onPreview;
        // Get available themes and create select items
        const themes = getAvailableThemes();
        const themeItems = themes.map((name) => ({
            value: name,
            label: name,
            description: name === currentTheme ? "(current)" : undefined,
        }));
        // Add top border
        this.addChild(new DynamicBorder());
        // Create selector
        this.selectList = new SelectList(themeItems, 10, getSelectListTheme());
        // Preselect current theme
        const currentIndex = themes.indexOf(currentTheme);
        if (currentIndex !== -1) {
            this.selectList.setSelectedIndex(currentIndex);
        }
        this.selectList.onSelect = (item) => {
            onSelect(item.value);
        };
        this.selectList.onCancel = () => {
            onCancel();
        };
        this.selectList.onSelectionChange = (item) => {
            this.onPreview(item.value);
        };
        this.addChild(this.selectList);
        // Add bottom border
        this.addChild(new DynamicBorder());
    }
    getSelectList() {
        return this.selectList;
    }
}
//# sourceMappingURL=theme-selector.js.map