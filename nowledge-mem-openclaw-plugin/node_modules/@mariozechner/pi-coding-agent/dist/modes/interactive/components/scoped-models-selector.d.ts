import type { Model } from "@mariozechner/pi-ai";
import { Container, type Focusable, Input } from "@mariozechner/pi-tui";
export interface ModelsConfig {
    allModels: Model<any>[];
    enabledModelIds: Set<string>;
    /** true if enabledModels setting is defined (empty = all enabled) */
    hasEnabledModelsFilter: boolean;
}
export interface ModelsCallbacks {
    /** Called when a model is toggled (session-only, no persist) */
    onModelToggle: (modelId: string, enabled: boolean) => void;
    /** Called when user wants to persist current selection to settings */
    onPersist: (enabledModelIds: string[]) => void;
    /** Called when user enables all models. Returns list of all model IDs. */
    onEnableAll: (allModelIds: string[]) => void;
    /** Called when user clears all models */
    onClearAll: () => void;
    /** Called when user toggles all models for a provider. Returns affected model IDs. */
    onToggleProvider: (provider: string, modelIds: string[], enabled: boolean) => void;
    onCancel: () => void;
}
/**
 * Component for enabling/disabling models for Ctrl+P cycling.
 * Changes are session-only until explicitly persisted with Ctrl+S.
 */
export declare class ScopedModelsSelectorComponent extends Container implements Focusable {
    private modelsById;
    private allIds;
    private enabledIds;
    private filteredItems;
    private selectedIndex;
    private searchInput;
    private _focused;
    get focused(): boolean;
    set focused(value: boolean);
    private listContainer;
    private footerText;
    private callbacks;
    private maxVisible;
    private isDirty;
    constructor(config: ModelsConfig, callbacks: ModelsCallbacks);
    private buildItems;
    private getFooterText;
    private refresh;
    private updateList;
    handleInput(data: string): void;
    getSearchInput(): Input;
}
//# sourceMappingURL=scoped-models-selector.d.ts.map