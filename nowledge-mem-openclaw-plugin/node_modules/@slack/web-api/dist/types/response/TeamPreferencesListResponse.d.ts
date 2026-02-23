import type { WebAPICallResult } from '../../WebClient';
export type TeamPreferencesListResponse = WebAPICallResult & {
    allow_message_deletion?: boolean;
    disable_file_uploads?: string;
    display_real_names?: boolean;
    error?: string;
    msg_edit_window_mins?: number;
    needed?: string;
    ok?: boolean;
    provided?: string;
    who_can_post_general?: string;
};
//# sourceMappingURL=TeamPreferencesListResponse.d.ts.map