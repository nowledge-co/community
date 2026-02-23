/**
 * TUI session selector for --resume flag
 */
import { ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import { KeybindingsManager } from "../core/keybindings.js";
import { SessionSelectorComponent } from "../modes/interactive/components/session-selector.js";
/** Show TUI session selector and return selected session path or null if cancelled */
export async function selectSession(currentSessionsLoader, allSessionsLoader) {
    return new Promise((resolve) => {
        const ui = new TUI(new ProcessTerminal());
        const keybindings = KeybindingsManager.create();
        let resolved = false;
        const selector = new SessionSelectorComponent(currentSessionsLoader, allSessionsLoader, (path) => {
            if (!resolved) {
                resolved = true;
                ui.stop();
                resolve(path);
            }
        }, () => {
            if (!resolved) {
                resolved = true;
                ui.stop();
                resolve(null);
            }
        }, () => {
            ui.stop();
            process.exit(0);
        }, () => ui.requestRender(), { showRenameHint: false, keybindings });
        ui.addChild(selector);
        ui.setFocus(selector.getSessionList());
        ui.start();
    });
}
//# sourceMappingURL=session-picker.js.map