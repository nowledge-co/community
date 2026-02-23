export class GbnfJsonScopeState {
    settings;
    currentNestingScope;
    constructor(settings = {
        allowNewLines: true,
        scopePadSpaces: 4
    }, currentNestingScope = 0) {
        this.settings = settings;
        this.currentNestingScope = currentNestingScope;
    }
    getForNewScope() {
        return new GbnfJsonScopeState(this.settings, this.currentNestingScope + 1);
    }
}
//# sourceMappingURL=GbnfJsonScopeState.js.map