import type { WebAPICallResult } from '../../WebClient';
export type RtmConnectResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    self?: Self;
    team?: Team;
    url?: string;
};
export interface Self {
    id?: string;
    name?: string;
}
export interface Team {
    domain?: string;
    id?: string;
    name?: string;
}
//# sourceMappingURL=RtmConnectResponse.d.ts.map