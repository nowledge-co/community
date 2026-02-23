import type { WebAPICallResult } from '../../WebClient';
export type CanvasesSectionsLookupResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
    sections?: Section[];
};
export interface ResponseMetadata {
    messages?: string[];
}
export interface Section {
    id?: string;
}
//# sourceMappingURL=CanvasesSectionsLookupResponse.d.ts.map