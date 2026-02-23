import type { WebAPICallResult } from '../../WebClient';
export type ImListResponse = WebAPICallResult & {
    error?: string;
    ims?: Im[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    warning?: string;
};
export interface Im {
    created?: number;
    id?: string;
    is_archived?: boolean;
    is_im?: boolean;
    is_org_shared?: boolean;
    is_user_deleted?: boolean;
    priority?: number;
    user?: string;
}
export interface ResponseMetadata {
    messages?: string[];
    next_cursor?: string;
    warnings?: string[];
}
//# sourceMappingURL=ImListResponse.d.ts.map