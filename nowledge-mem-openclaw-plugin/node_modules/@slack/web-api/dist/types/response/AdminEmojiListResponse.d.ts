import type { WebAPICallResult } from '../../WebClient';
export type AdminEmojiListResponse = WebAPICallResult & {
    emoji?: {
        [key: string]: Emoji;
    };
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface Emoji {
    date_created?: number;
    uploaded_by?: string;
    url?: string;
}
export interface ResponseMetadata {
    next_cursor?: string;
}
//# sourceMappingURL=AdminEmojiListResponse.d.ts.map