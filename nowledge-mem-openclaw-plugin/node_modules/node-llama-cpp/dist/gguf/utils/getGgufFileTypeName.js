import { GgufFileType } from "../types/GgufMetadataTypes.js";
const fileTypeNumberToNameMap = new Map();
for (const [key, value] of Object.entries(GgufFileType)) {
    if (typeof value === "number")
        fileTypeNumberToNameMap.set(value, key);
}
/**
 * Convert a GGUF file type number to its corresponding type name
 */
export function getGgufFileTypeName(fileType) {
    return fileTypeNumberToNameMap.get(fileType) ?? undefined;
}
//# sourceMappingURL=getGgufFileTypeName.js.map