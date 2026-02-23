import { GgufFileReader } from "../fileReaders/GgufFileReader.js";
import { GgufFileInfo } from "../types/GgufFileInfoTypes.js";
export declare function parseGguf({ fileReader, readTensorInfo, ignoreKeys, logWarnings }: {
    fileReader: GgufFileReader;
    readTensorInfo?: boolean;
    ignoreKeys?: string[];
    logWarnings?: boolean;
}): Promise<GgufFileInfo>;
