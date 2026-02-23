import type { ChannelId } from "../channels/plugins/types.js";
export declare function resolveEffectiveAllowFromLists(params: {
    allowFrom?: Array<string | number> | null;
    groupAllowFrom?: Array<string | number> | null;
    storeAllowFrom?: Array<string | number> | null;
    dmPolicy?: string | null;
}): {
    effectiveAllowFrom: string[];
    effectiveGroupAllowFrom: string[];
};
export type DmGroupAccessDecision = "allow" | "block" | "pairing";
export declare function resolveDmGroupAccessDecision(params: {
    isGroup: boolean;
    dmPolicy?: string | null;
    groupPolicy?: string | null;
    effectiveAllowFrom: Array<string | number>;
    effectiveGroupAllowFrom: Array<string | number>;
    isSenderAllowed: (allowFrom: string[]) => boolean;
}): {
    decision: DmGroupAccessDecision;
    reason: string;
};
export declare function resolveDmAllowState(params: {
    provider: ChannelId;
    allowFrom?: Array<string | number> | null;
    normalizeEntry?: (raw: string) => string;
    readStore?: (provider: ChannelId) => Promise<string[]>;
}): Promise<{
    configAllowFrom: string[];
    hasWildcard: boolean;
    allowCount: number;
    isMultiUserDm: boolean;
}>;
