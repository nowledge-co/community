export declare class ContentDisposition {
    type: string;
    parameters: Record<string, unknown>;
    constructor(type: string, parameters: Record<string, string | undefined | boolean>);
}
/**
 * Create an attachment Content-Disposition header.
 *
 * @param filename file name
 * @param options
 */
export declare function contentDisposition(filename?: string, options?: Partial<{
    type: string;
    fallback: string | boolean;
}>): string;
/**
 * Parse Content-Disposition header string.
 * @param header string
 */
export declare function parse(header: string): ContentDisposition;
//# sourceMappingURL=index.d.ts.map