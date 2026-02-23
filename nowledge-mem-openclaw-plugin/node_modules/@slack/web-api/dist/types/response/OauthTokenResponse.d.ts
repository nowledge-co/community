import type { WebAPICallResult } from '../../WebClient';
export type OauthTokenResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    req_method?: string;
};
//# sourceMappingURL=OauthTokenResponse.d.ts.map