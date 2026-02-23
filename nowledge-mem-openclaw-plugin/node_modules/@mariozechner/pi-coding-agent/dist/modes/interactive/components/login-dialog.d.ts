import { Container, type Focusable, type TUI } from "@mariozechner/pi-tui";
/**
 * Login dialog component - replaces editor during OAuth login flow
 */
export declare class LoginDialogComponent extends Container implements Focusable {
    private onComplete;
    private contentContainer;
    private input;
    private tui;
    private abortController;
    private inputResolver?;
    private inputRejecter?;
    private _focused;
    get focused(): boolean;
    set focused(value: boolean);
    constructor(tui: TUI, providerId: string, onComplete: (success: boolean, message?: string) => void);
    get signal(): AbortSignal;
    private cancel;
    /**
     * Called by onAuth callback - show URL and optional instructions
     */
    showAuth(url: string, instructions?: string): void;
    /**
     * Show input for manual code/URL entry (for callback server providers)
     */
    showManualInput(prompt: string): Promise<string>;
    /**
     * Called by onPrompt callback - show prompt and wait for input
     * Note: Does NOT clear content, appends to existing (preserves URL from showAuth)
     */
    showPrompt(message: string, placeholder?: string): Promise<string>;
    /**
     * Show waiting message (for polling flows like GitHub Copilot)
     */
    showWaiting(message: string): void;
    /**
     * Called by onProgress callback
     */
    showProgress(message: string): void;
    handleInput(data: string): void;
}
//# sourceMappingURL=login-dialog.d.ts.map