import type { WebAPICallResult } from '../../WebClient';
export type AdminUsersListResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    users?: User[];
};
export interface ResponseMetadata {
    messages?: string[];
    next_cursor?: string;
}
export interface User {
    date_created?: number;
    email?: string;
    expiration_ts?: number;
    full_name?: string;
    has_2fa?: boolean;
    has_sso?: boolean;
    id?: string;
    is_active?: boolean;
    is_admin?: boolean;
    is_bot?: boolean;
    is_owner?: boolean;
    is_primary_owner?: boolean;
    is_restricted?: boolean;
    is_ultra_restricted?: boolean;
    last_active_ts?: number;
    roles?: string[];
    username?: string;
    workspaces?: string[];
}
//# sourceMappingURL=AdminUsersListResponse.d.ts.map