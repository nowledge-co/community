import type { OptionalArgument } from '../../helpers';
import type { ChannelIDs, CursorPaginationEnabled, OptionalTeamAssignable, TeamID, TokenOverridable, UserID, UserIDs } from '../common';
interface IsRestricted {
    /** @description Set to `true` if user should be added to the workspace as a guest. */
    is_restricted?: boolean;
}
interface IsUltraRestricted {
    /** @description Set to `true` if user should be added to the workspace as a guest. */
    is_ultra_restricted?: boolean;
}
interface SessionExpirationTarget {
    /** @description Only expire mobile sessions. Defaults to `false`. */
    mobile_only?: boolean;
    /** @description Only expire web sessions. Defaults to `false`. */
    web_only?: boolean;
}
export interface TeamIDWithoutDeactivatedWorkspaces extends TeamID {
    include_deactivated_user_workspaces?: false;
}
export interface DeactivatedWorkspacesWithoutTeamID {
    team_id?: never;
    /**
     * @description Only applies when using an org token and when no `team_id` is provided. If `true`, return workspaces
     * for a user even if they may be deactivated on them. If `false`, return workspaces for a user only when user is
     * active on them. Default is `false`.
     */
    include_deactivated_user_workspaces?: true;
}
type TeamIDOrDeactivatedWorkspaces = TeamIDWithoutDeactivatedWorkspaces | DeactivatedWorkspacesWithoutTeamID;
export interface BothTeamAndUserID extends TeamID, UserID {
}
export interface NeitherTeamNorUserID {
    team_id?: never;
    user_id?: never;
}
type EitherTeamAndUserIDOrNeither = BothTeamAndUserID | NeitherTeamNorUserID;
export interface AdminUsersAssignArguments extends TeamID, UserID, Partial<ChannelIDs>, IsRestricted, IsUltraRestricted, TokenOverridable {
}
export interface AdminUsersInviteArguments extends ChannelIDs, TeamID, IsRestricted, IsUltraRestricted, TokenOverridable {
    /** @description The email address of the person to invite. */
    email: string;
    /** @description An optional message to send to the user in the invite email. */
    custom_message?: string;
    /**
     * @description Allow invited user to sign in via email and password. Only available for Enterprise Grid teams via
     * admin invite.
     */
    email_password_policy_enabled?: boolean;
    /**
     * @description Timestamp when guest account should be disabled. Only include this timestamp if you are inviting a
     * guest user and you want their account to expire on a certain date.
     */
    guest_expiration_ts?: string;
    /** @description Full name of the user. */
    real_name?: string;
    /**
     * @description Allow this invite to be resent in the future if a user has not signed up yet.
     * Resending can only be done via the UI and has no expiration. Defaults to `false`.
     */
    resend?: boolean;
}
export type AdminUsersListArguments = OptionalArgument<TeamIDOrDeactivatedWorkspaces & TokenOverridable & CursorPaginationEnabled & {
    /**
     * @description If `true`, only active users will be returned. If `false`, only deactivated users will be returned.
     * Default is `true`.
     */
    is_active?: boolean;
}>;
export interface AdminUsersRemoveArguments extends TeamID, UserID, TokenOverridable {
}
export interface AdminUsersSessionClearSettingsArguments extends UserIDs, TokenOverridable {
}
export interface AdminUsersSessionGetSettingsArguments extends UserIDs, TokenOverridable {
}
export interface AdminUsersSessionInvalidateArguments extends TeamID, TokenOverridable {
    /** @description ID of the session to invalidate. */
    session_id: string;
}
export type AdminUsersSessionListArguments = OptionalArgument<EitherTeamAndUserIDOrNeither & TokenOverridable & CursorPaginationEnabled>;
export interface AdminUsersSessionResetArguments extends UserID, SessionExpirationTarget, TokenOverridable {
}
export interface AdminUsersSessionResetBulkArguments extends UserIDs, SessionExpirationTarget, TokenOverridable {
}
export interface AdminUsersSessionSetSettingsArguments extends UserIDs, TokenOverridable {
    /** @description Terminate the session when the client—either the desktop app or a browser window—is closed. */
    desktop_app_browser_quit?: boolean;
    /**
     * @description The session duration in seconds. The minimum value is 28800, which represents 8 hours;
     * the max value is 315569520 or 10 years (that's a long Slack session).
     */
    duration?: number;
}
export interface AdminUsersSetAdminArguments extends TeamID, UserID, TokenOverridable {
}
export interface AdminUsersSetExpirationArguments extends UserID, TokenOverridable, OptionalTeamAssignable {
    /** @description Epoch timestamp in seconds when guest account should be disabled. */
    expiration_ts: number;
}
export interface AdminUsersSetOwnerArguments extends TeamID, UserID, TokenOverridable {
}
export interface AdminUsersSetRegularArguments extends TeamID, UserID, TokenOverridable {
}
export interface AdminUsersUnsupportedVersionsExportArguments extends TokenOverridable {
    /**
     * @description Unix timestamp of the date of past or upcoming end of support cycles.
     * If not provided will include all announced end of support cycles. Defaults to `0`.
     */
    date_end_of_support?: number;
    /**
     * @description Unix timestamp of a date to start looking for user sessions.
     * If not provided will start six months ago.
     */
    date_sessions_started?: number;
}
export {};
//# sourceMappingURL=users.d.ts.map