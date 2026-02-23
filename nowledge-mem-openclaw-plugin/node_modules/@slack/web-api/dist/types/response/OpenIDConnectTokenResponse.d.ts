import type { WebAPICallResult } from '../../WebClient';
export type OpenIDConnectTokenResponse = WebAPICallResult & {
    access_token?: string;
    error?: string;
    expires_in?: number;
    id_token?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    refresh_token?: string;
    token_type?: string;
    warning?: string;
};
//# sourceMappingURL=OpenIDConnectTokenResponse.d.ts.map