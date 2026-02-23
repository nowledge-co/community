import type { WebAPICallResult } from '../../WebClient';
export type MigrationExchangeResponse = WebAPICallResult & {
    enterprise_id?: string;
    error?: string;
    invalid_user_ids?: string[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    team_id?: string;
    user_id_map?: {
        [key: string]: string;
    };
    warning?: string;
};
//# sourceMappingURL=MigrationExchangeResponse.d.ts.map