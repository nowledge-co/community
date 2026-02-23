import type { WebAPICallResult } from '../../WebClient';
export type AdminWorkflowsCollaboratorsRemoveResponse = WebAPICallResult & {
    error?: string;
    errors?: Error[];
    needed?: string;
    ok?: boolean;
    provided?: string;
};
export interface Error {
    message?: string;
    user?: string;
    workflow?: string;
}
//# sourceMappingURL=AdminWorkflowsCollaboratorsRemoveResponse.d.ts.map