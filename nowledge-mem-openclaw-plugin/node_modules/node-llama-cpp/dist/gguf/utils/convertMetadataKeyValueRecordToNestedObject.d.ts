import { MetadataKeyValueRecord, MetadataValue } from "../types/GgufFileInfoTypes.js";
export declare function convertMetadataKeyValueRecordToNestedObject(keyValueRecord: MetadataKeyValueRecord, { logOverrideWarnings, ignoreKeys, noDirectSubNestingKeys }?: {
    logOverrideWarnings?: boolean;
    ignoreKeys?: readonly string[];
    noDirectSubNestingKeys?: readonly string[];
}): Record<string, MetadataValue>;
