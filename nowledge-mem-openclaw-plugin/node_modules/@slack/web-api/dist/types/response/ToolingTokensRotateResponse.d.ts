import type { WebAPICallResult } from '../../WebClient';
export type ToolingTokensRotateResponse = WebAPICallResult & {
    error?: string;
    exp?: number;
    iat?: number;
    needed?: string;
    ok?: boolean;
    provided?: string;
    refresh_token?: string;
    response_metadata?: ResponseMetadata;
    team_id?: string;
    token?: string;
    user_id?: string;
};
export interface ResponseMetadata {
    messages?: string[];
}
//# sourceMappingURL=ToolingTokensRotateResponse.d.ts.map