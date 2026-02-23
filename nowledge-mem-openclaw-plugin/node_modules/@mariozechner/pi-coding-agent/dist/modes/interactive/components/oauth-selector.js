import { getOAuthProviders } from "@mariozechner/pi-ai";
import { Container, getEditorKeybindings, Spacer, TruncatedText } from "@mariozechner/pi-tui";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";
/**
 * Component that renders an OAuth provider selector
 */
export class OAuthSelectorComponent extends Container {
    listContainer;
    allProviders = [];
    selectedIndex = 0;
    mode;
    authStorage;
    onSelectCallback;
    onCancelCallback;
    constructor(mode, authStorage, onSelect, onCancel) {
        super();
        this.mode = mode;
        this.authStorage = authStorage;
        this.onSelectCallback = onSelect;
        this.onCancelCallback = onCancel;
        // Load all OAuth providers
        this.loadProviders();
        // Add top border
        this.addChild(new DynamicBorder());
        this.addChild(new Spacer(1));
        // Add title
        const title = mode === "login" ? "Select provider to login:" : "Select provider to logout:";
        this.addChild(new TruncatedText(theme.bold(title)));
        this.addChild(new Spacer(1));
        // Create list container
        this.listContainer = new Container();
        this.addChild(this.listContainer);
        this.addChild(new Spacer(1));
        // Add bottom border
        this.addChild(new DynamicBorder());
        // Initial render
        this.updateList();
    }
    loadProviders() {
        this.allProviders = getOAuthProviders();
    }
    updateList() {
        this.listContainer.clear();
        for (let i = 0; i < this.allProviders.length; i++) {
            const provider = this.allProviders[i];
            if (!provider)
                continue;
            const isSelected = i === this.selectedIndex;
            // Check if user is logged in for this provider
            const credentials = this.authStorage.get(provider.id);
            const isLoggedIn = credentials?.type === "oauth";
            const statusIndicator = isLoggedIn ? theme.fg("success", " ✓ logged in") : "";
            let line = "";
            if (isSelected) {
                const prefix = theme.fg("accent", "→ ");
                const text = theme.fg("accent", provider.name);
                line = prefix + text + statusIndicator;
            }
            else {
                const text = `  ${provider.name}`;
                line = text + statusIndicator;
            }
            this.listContainer.addChild(new TruncatedText(line, 0, 0));
        }
        // Show "no providers" if empty
        if (this.allProviders.length === 0) {
            const message = this.mode === "login" ? "No OAuth providers available" : "No OAuth providers logged in. Use /login first.";
            this.listContainer.addChild(new TruncatedText(theme.fg("muted", `  ${message}`), 0, 0));
        }
    }
    handleInput(keyData) {
        const kb = getEditorKeybindings();
        // Up arrow
        if (kb.matches(keyData, "selectUp")) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateList();
        }
        // Down arrow
        else if (kb.matches(keyData, "selectDown")) {
            this.selectedIndex = Math.min(this.allProviders.length - 1, this.selectedIndex + 1);
            this.updateList();
        }
        // Enter
        else if (kb.matches(keyData, "selectConfirm")) {
            const selectedProvider = this.allProviders[this.selectedIndex];
            if (selectedProvider) {
                this.onSelectCallback(selectedProvider.id);
            }
        }
        // Escape or Ctrl+C
        else if (kb.matches(keyData, "selectCancel")) {
            this.onCancelCallback();
        }
    }
}
//# sourceMappingURL=oauth-selector.js.map