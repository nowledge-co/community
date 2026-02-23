import type { WebAPICallResult } from '../../WebClient';
export type CallsParticipantsAddResponse = WebAPICallResult & {
    call?: Call;
    error?: string;
    needed?: string;
    ok?: boolean;
    provided?: string;
};
export interface Call {
    channels?: string[];
    date_start?: number;
    desktop_app_join_url?: string;
    external_display_id?: string;
    external_unique_id?: string;
    id?: string;
    join_url?: string;
    title?: string;
    users?: User[];
}
export interface User {
    avatar_url?: string;
    display_name?: string;
    external_id?: string;
    slack_id?: string;
}
//# sourceMappingURL=CallsParticipantsAddResponse.d.ts.map