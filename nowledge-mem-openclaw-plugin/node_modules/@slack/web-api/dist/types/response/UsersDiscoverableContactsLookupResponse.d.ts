import type { WebAPICallResult } from '../../WebClient';
export type UsersDiscoverableContactsLookupResponse = WebAPICallResult & {
    error?: string;
    is_discoverable?: boolean;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=UsersDiscoverableContactsLookupResponse.d.ts.map