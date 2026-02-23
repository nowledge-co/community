import type { WebAPICallResult } from '../../WebClient';
export type DndTeamInfoResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    users?: {
        [key: string]: User;
    };
};
export interface User {
    dnd_enabled?: boolean;
    next_dnd_end_ts?: number;
    next_dnd_start_ts?: number;
}
//# sourceMappingURL=DndTeamInfoResponse.d.ts.map