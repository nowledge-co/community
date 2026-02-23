import type { WebAPICallResult } from '../../WebClient';
export type DndSetSnoozeResponse = WebAPICallResult & {
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
    snooze_enabled?: boolean;
    snooze_endtime?: number;
    snooze_is_indefinite?: boolean;
    snooze_remaining?: number;
};
//# sourceMappingURL=DndSetSnoozeResponse.d.ts.map