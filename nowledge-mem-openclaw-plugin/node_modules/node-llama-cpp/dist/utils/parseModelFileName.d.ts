export declare function parseModelFileName(filename: string): {
    name: string | undefined;
    subType: string;
    quantization: string | undefined;
    fileType: string | undefined;
    version: string | undefined;
    contextSize: string | undefined;
    parameters: `${number}B` | undefined;
    parts: {
        part: string;
        parts: string;
    } | undefined;
    otherInfo: string[];
};
export declare function isFilePartText(text?: string): boolean;
