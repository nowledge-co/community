import { MultiKeyMap } from "lifecycle-utils";
import { GbnfJsonSchema } from "../types.js";
export declare class DefScopeDefs {
    defScopeDefs: MultiKeyMap<[string, GbnfJsonSchema], Record<string, GbnfJsonSchema>>;
    registerDefs(scopeDefs: Record<string, GbnfJsonSchema>): void;
}
export declare function joinDefs(parent: Record<string, GbnfJsonSchema>, current?: Record<string, GbnfJsonSchema>): Record<string, GbnfJsonSchema>;
