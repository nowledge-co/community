export declare function parseHttpContentRange(value?: string | null): {
    start: number;
    end: number;
    size: number;
    length: number;
} | null;
