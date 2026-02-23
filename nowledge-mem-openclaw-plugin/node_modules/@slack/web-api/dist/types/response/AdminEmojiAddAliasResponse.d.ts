import type { WebAPICallResult } from '../../WebClient';
export type AdminEmojiAddAliasResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminEmojiAddAliasResponse.d.ts.map