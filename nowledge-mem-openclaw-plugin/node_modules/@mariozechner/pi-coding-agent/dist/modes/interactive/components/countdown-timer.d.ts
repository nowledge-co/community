/**
 * Reusable countdown timer for dialog components.
 */
import type { TUI } from "@mariozechner/pi-tui";
export declare class CountdownTimer {
    private tui;
    private onTick;
    private onExpire;
    private intervalId;
    private remainingSeconds;
    constructor(timeoutMs: number, tui: TUI | undefined, onTick: (seconds: number) => void, onExpire: () => void);
    dispose(): void;
}
//# sourceMappingURL=countdown-timer.d.ts.map