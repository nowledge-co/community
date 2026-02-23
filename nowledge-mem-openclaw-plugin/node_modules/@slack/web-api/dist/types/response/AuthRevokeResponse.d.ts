import type { WebAPICallResult } from '../../WebClient';
export type AuthRevokeResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=AuthRevokeResponse.d.ts.map