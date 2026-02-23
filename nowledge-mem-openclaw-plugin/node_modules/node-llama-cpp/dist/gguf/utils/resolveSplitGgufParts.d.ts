export declare function resolveSplitGgufParts(ggufPathOrUri: string): string[];
export declare function getGgufSplitPartsInfo(ggufPath: string): {
    part: number;
    parts: number;
    matchLength: number;
} | null;
export declare function createSplitPartFilename(filename: string, part: number, parts: number): string;
