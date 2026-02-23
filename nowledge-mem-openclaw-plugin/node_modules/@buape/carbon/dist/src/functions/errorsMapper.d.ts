export type DiscordRawError = {
    code?: number;
    message: string;
    errors?: {
        [key: string]: any;
    };
};
export interface TransformedError {
    code: string;
    location?: string;
    message: string;
}
export declare const errorMapper: (data?: DiscordRawError) => TransformedError[];
//# sourceMappingURL=errorsMapper.d.ts.map