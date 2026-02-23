import type { WebAPICallResult } from '../../WebClient';
export type FilesCommentsEditResponse = WebAPICallResult & {
    comment?: Comment;
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
export interface Comment {
    comment?: string;
    created?: number;
    id?: string;
    is_intro?: boolean;
    timestamp?: number;
    user?: string;
}
//# sourceMappingURL=FilesCommentsEditResponse.d.ts.map