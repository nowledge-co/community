import { Container } from "@mariozechner/pi-tui";
import type { AuthStorage } from "../../../core/auth-storage.js";
/**
 * Component that renders an OAuth provider selector
 */
export declare class OAuthSelectorComponent extends Container {
    private listContainer;
    private allProviders;
    private selectedIndex;
    private mode;
    private authStorage;
    private onSelectCallback;
    private onCancelCallback;
    constructor(mode: "login" | "logout", authStorage: AuthStorage, onSelect: (providerId: string) => void, onCancel: () => void);
    private loadProviders;
    private updateList;
    handleInput(keyData: string): void;
}
//# sourceMappingURL=oauth-selector.d.ts.map