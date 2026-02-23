/**
 * Generic selector component for extensions.
 * Displays a list of string options with keyboard navigation.
 */
import { Container, getEditorKeybindings, Spacer, Text } from "@mariozechner/pi-tui";
import { theme } from "../theme/theme.js";
import { CountdownTimer } from "./countdown-timer.js";
import { DynamicBorder } from "./dynamic-border.js";
import { keyHint, rawKeyHint } from "./keybinding-hints.js";
export class ExtensionSelectorComponent extends Container {
    options;
    selectedIndex = 0;
    listContainer;
    onSelectCallback;
    onCancelCallback;
    titleText;
    baseTitle;
    countdown;
    constructor(title, options, onSelect, onCancel, opts) {
        super();
        this.options = options;
        this.onSelectCallback = onSelect;
        this.onCancelCallback = onCancel;
        this.baseTitle = title;
        this.addChild(new DynamicBorder());
        this.addChild(new Spacer(1));
        this.titleText = new Text(theme.fg("accent", title), 1, 0);
        this.addChild(this.titleText);
        this.addChild(new Spacer(1));
        if (opts?.timeout && opts.timeout > 0 && opts.tui) {
            this.countdown = new CountdownTimer(opts.timeout, opts.tui, (s) => this.titleText.setText(theme.fg("accent", `${this.baseTitle} (${s}s)`)), () => this.onCancelCallback());
        }
        this.listContainer = new Container();
        this.addChild(this.listContainer);
        this.addChild(new Spacer(1));
        this.addChild(new Text(rawKeyHint("↑↓", "navigate") +
            "  " +
            keyHint("selectConfirm", "select") +
            "  " +
            keyHint("selectCancel", "cancel"), 1, 0));
        this.addChild(new Spacer(1));
        this.addChild(new DynamicBorder());
        this.updateList();
    }
    updateList() {
        this.listContainer.clear();
        for (let i = 0; i < this.options.length; i++) {
            const isSelected = i === this.selectedIndex;
            const text = isSelected
                ? theme.fg("accent", "→ ") + theme.fg("accent", this.options[i])
                : `  ${theme.fg("text", this.options[i])}`;
            this.listContainer.addChild(new Text(text, 1, 0));
        }
    }
    handleInput(keyData) {
        const kb = getEditorKeybindings();
        if (kb.matches(keyData, "selectUp") || keyData === "k") {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateList();
        }
        else if (kb.matches(keyData, "selectDown") || keyData === "j") {
            this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
            this.updateList();
        }
        else if (kb.matches(keyData, "selectConfirm") || keyData === "\n") {
            const selected = this.options[this.selectedIndex];
            if (selected)
                this.onSelectCallback(selected);
        }
        else if (kb.matches(keyData, "selectCancel")) {
            this.onCancelCallback();
        }
    }
    dispose() {
        this.countdown?.dispose();
    }
}
//# sourceMappingURL=extension-selector.js.map