import { firstDefined } from "../channels/allow-from.js";
export type NormalizedAllowFrom = {
    entries: string[];
    hasWildcard: boolean;
    hasEntries: boolean;
};
export declare const normalizeAllowFrom: (list?: Array<string | number>) => NormalizedAllowFrom;
export declare const normalizeAllowFromWithStore: (params: {
    allowFrom?: Array<string | number>;
    storeAllowFrom?: string[];
    dmPolicy?: string;
}) => NormalizedAllowFrom;
export declare const isSenderAllowed: (params: {
    allow: NormalizedAllowFrom;
    senderId?: string;
}) => boolean;
export { firstDefined };
