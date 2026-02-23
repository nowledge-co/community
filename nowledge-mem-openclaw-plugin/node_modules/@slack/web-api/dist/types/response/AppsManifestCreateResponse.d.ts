import type { WebAPICallResult } from '../../WebClient';
export type AppsManifestCreateResponse = WebAPICallResult & {
    app_id?: string;
    credentials?: Credentials;
    error?: string;
    errors?: Error[];
    needed?: string;
    oauth_authorize_url?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    team_domain?: string;
    team_id?: string;
};
export interface Credentials {
    client_id?: string;
    client_secret?: string;
    signing_secret?: string;
    verification_token?: string;
}
export interface Error {
    code?: string;
    message?: string;
    pointer?: string;
    related_component?: string;
}
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AppsManifestCreateResponse.d.ts.map