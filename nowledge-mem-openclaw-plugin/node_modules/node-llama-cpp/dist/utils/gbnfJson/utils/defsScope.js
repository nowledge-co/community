import { MultiKeyMap } from "lifecycle-utils";
export class DefScopeDefs {
    defScopeDefs = new MultiKeyMap();
    registerDefs(scopeDefs) {
        for (const [defName, def] of Object.entries(scopeDefs))
            this.defScopeDefs.set([defName, def], scopeDefs);
    }
}
export function joinDefs(parent, current) {
    if (current == null || Object.keys(current).length === 0)
        return parent;
    return {
        ...parent,
        ...current
    };
}
//# sourceMappingURL=defsScope.js.map