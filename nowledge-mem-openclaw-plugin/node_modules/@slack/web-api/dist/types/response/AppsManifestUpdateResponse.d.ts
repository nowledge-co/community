import type { WebAPICallResult } from '../../WebClient';
export type AppsManifestUpdateResponse = WebAPICallResult & {
    app_id?: string;
    error?: string;
    needed?: string;
    ok?: boolean;
    permissions_updated?: boolean;
    provided?: string;
};
//# sourceMappingURL=AppsManifestUpdateResponse.d.ts.map