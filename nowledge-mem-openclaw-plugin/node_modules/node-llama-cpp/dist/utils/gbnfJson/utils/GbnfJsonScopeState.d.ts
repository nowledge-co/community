export type GbnfJsonScopeSettings = {
    readonly allowNewLines: boolean;
    readonly scopePadSpaces: number;
};
export declare class GbnfJsonScopeState {
    readonly settings: GbnfJsonScopeSettings;
    readonly currentNestingScope: number;
    constructor(settings?: GbnfJsonScopeSettings, currentNestingScope?: number);
    getForNewScope(): GbnfJsonScopeState;
}
