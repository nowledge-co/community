export interface AutocompleteItem {
    value: string;
    label: string;
    description?: string;
}
export interface SlashCommand {
    name: string;
    description?: string;
    getArgumentCompletions?(argumentPrefix: string): AutocompleteItem[] | null;
}
export interface AutocompleteProvider {
    getSuggestions(lines: string[], cursorLine: number, cursorCol: number): {
        items: AutocompleteItem[];
        prefix: string;
    } | null;
    applyCompletion(lines: string[], cursorLine: number, cursorCol: number, item: AutocompleteItem, prefix: string): {
        lines: string[];
        cursorLine: number;
        cursorCol: number;
    };
}
export declare class CombinedAutocompleteProvider implements AutocompleteProvider {
    private commands;
    private basePath;
    private fdPath;
    constructor(commands?: (SlashCommand | AutocompleteItem)[], basePath?: string, fdPath?: string | null);
    getSuggestions(lines: string[], cursorLine: number, cursorCol: number): {
        items: AutocompleteItem[];
        prefix: string;
    } | null;
    applyCompletion(lines: string[], cursorLine: number, cursorCol: number, item: AutocompleteItem, prefix: string): {
        lines: string[];
        cursorLine: number;
        cursorCol: number;
    };
    private extractAtPrefix;
    private extractPathPrefix;
    private expandHomePath;
    private resolveScopedFuzzyQuery;
    private scopedPathForDisplay;
    private getFileSuggestions;
    private scoreEntry;
    private getFuzzyFileSuggestions;
    getForceFileSuggestions(lines: string[], cursorLine: number, cursorCol: number): {
        items: AutocompleteItem[];
        prefix: string;
    } | null;
    shouldTriggerFileCompletion(lines: string[], cursorLine: number, cursorCol: number): boolean;
}
//# sourceMappingURL=autocomplete.d.ts.map