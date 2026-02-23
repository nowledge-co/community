import type { WebAPICallResult } from '../../WebClient';
export type EmojiListResponse = WebAPICallResult & {
    cache_ts?: string;
    categories?: Category[];
    categories_version?: string;
    emoji?: {
        [key: string]: string;
    };
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
export interface Category {
    emoji_names?: string[];
    name?: string;
}
//# sourceMappingURL=EmojiListResponse.d.ts.map