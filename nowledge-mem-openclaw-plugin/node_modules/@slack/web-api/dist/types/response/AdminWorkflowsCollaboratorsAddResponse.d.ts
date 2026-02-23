import type { WebAPICallResult } from '../../WebClient';
export type AdminWorkflowsCollaboratorsAddResponse = WebAPICallResult & {
    error?: string;
    errors?: Error[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface Error {
    message?: string;
    user?: string;
    workflow?: string;
}
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=AdminWorkflowsCollaboratorsAddResponse.d.ts.map