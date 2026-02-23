import type { WebAPICallResult } from '../../WebClient';
export type DndInfoResponse = WebAPICallResult & {
    dnd_enabled?: boolean;
    error?: string;
    needed?: string;
    next_dnd_end_ts?: number;
    next_dnd_start_ts?: number;
    ok?: boolean;
    provided?: string;
};
//# sourceMappingURL=DndInfoResponse.d.ts.map