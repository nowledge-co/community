import type { TUI } from "../tui.js";
import { Text } from "./text.js";
/**
 * Loader component that updates every 80ms with spinning animation
 */
export declare class Loader extends Text {
    private spinnerColorFn;
    private messageColorFn;
    private message;
    private frames;
    private currentFrame;
    private intervalId;
    private ui;
    constructor(ui: TUI, spinnerColorFn: (str: string) => string, messageColorFn: (str: string) => string, message?: string);
    render(width: number): string[];
    start(): void;
    stop(): void;
    setMessage(message: string): void;
    private updateDisplay;
}
//# sourceMappingURL=loader.d.ts.map