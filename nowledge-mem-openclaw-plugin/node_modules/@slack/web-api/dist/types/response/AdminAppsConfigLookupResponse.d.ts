import type { WebAPICallResult } from '../../WebClient';
export type AdminAppsConfigLookupResponse = WebAPICallResult & {
    configs?: Config[];
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface Config {
    app_id?: string;
    domain_restrictions?: DomainRestrictions;
    workflow_auth_strategy?: string;
}
export interface DomainRestrictions {
    emails?: string[];
    urls?: string[];
}
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminAppsConfigLookupResponse.d.ts.map