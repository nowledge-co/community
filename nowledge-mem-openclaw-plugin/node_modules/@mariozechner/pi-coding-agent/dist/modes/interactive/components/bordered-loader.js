import { CancellableLoader, Container, Loader, Spacer, Text } from "@mariozechner/pi-tui";
import { DynamicBorder } from "./dynamic-border.js";
import { keyHint } from "./keybinding-hints.js";
/** Loader wrapped with borders for extension UI */
export class BorderedLoader extends Container {
    loader;
    cancellable;
    signalController;
    constructor(tui, theme, message, options) {
        super();
        this.cancellable = options?.cancellable ?? true;
        const borderColor = (s) => theme.fg("border", s);
        this.addChild(new DynamicBorder(borderColor));
        if (this.cancellable) {
            this.loader = new CancellableLoader(tui, (s) => theme.fg("accent", s), (s) => theme.fg("muted", s), message);
        }
        else {
            this.signalController = new AbortController();
            this.loader = new Loader(tui, (s) => theme.fg("accent", s), (s) => theme.fg("muted", s), message);
        }
        this.addChild(this.loader);
        if (this.cancellable) {
            this.addChild(new Spacer(1));
            this.addChild(new Text(keyHint("selectCancel", "cancel"), 1, 0));
        }
        this.addChild(new Spacer(1));
        this.addChild(new DynamicBorder(borderColor));
    }
    get signal() {
        if (this.cancellable) {
            return this.loader.signal;
        }
        return this.signalController?.signal ?? new AbortController().signal;
    }
    set onAbort(fn) {
        if (this.cancellable) {
            this.loader.onAbort = fn;
        }
    }
    handleInput(data) {
        if (this.cancellable) {
            this.loader.handleInput(data);
        }
    }
    dispose() {
        if ("dispose" in this.loader && typeof this.loader.dispose === "function") {
            this.loader.dispose();
        }
    }
}
//# sourceMappingURL=bordered-loader.js.map