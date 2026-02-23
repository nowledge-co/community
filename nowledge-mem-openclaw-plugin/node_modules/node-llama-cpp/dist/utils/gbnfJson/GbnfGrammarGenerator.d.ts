import { MultiKeyMap } from "lifecycle-utils";
import { GbnfJsonSchema } from "./types.js";
export declare class GbnfGrammarGenerator {
    rules: Map<string, string>;
    ruleContentToRuleName: Map<string, string>;
    literalValueRuleNames: Map<string | number, string>;
    defRuleNames: MultiKeyMap<[string, GbnfJsonSchema], string | null>;
    defScopeDefs: MultiKeyMap<[string, GbnfJsonSchema], Record<string, GbnfJsonSchema>>;
    usedRootRuleName: boolean;
    private ruleId;
    private valueRuleId;
    private defRuleId;
    generateRuleName(): string;
    generateRuleNameForLiteralValue(value: string | number): string;
    generateRuleNameForDef(defName: string, def: GbnfJsonSchema): string;
    registerDefs(scopeDefs: Record<string, GbnfJsonSchema>): void;
    generateGbnfFile(rootGrammar: string): string;
    getProposedLiteralValueRuleNameLength(): number;
}
