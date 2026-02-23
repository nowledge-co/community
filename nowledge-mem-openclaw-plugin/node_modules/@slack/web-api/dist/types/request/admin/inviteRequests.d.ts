import type { CursorPaginationEnabled, OptionalTeamAssignable, TokenOverridable } from '../common';
interface InviteRequestID {
    /** @description ID of the request to invite. */
    invite_request_id: string;
}
export interface AdminInviteRequestsApproveArguments extends InviteRequestID, Required<OptionalTeamAssignable>, TokenOverridable {
}
export interface AdminInviteRequestsApprovedListArguments extends Required<OptionalTeamAssignable>, TokenOverridable, CursorPaginationEnabled {
}
export interface AdminInviteRequestsDeniedListArguments extends Required<OptionalTeamAssignable>, TokenOverridable, CursorPaginationEnabled {
}
export interface AdminInviteRequestsDenyArguments extends InviteRequestID, Required<OptionalTeamAssignable>, TokenOverridable {
}
export interface AdminInviteRequestsListArguments extends Required<OptionalTeamAssignable>, TokenOverridable, CursorPaginationEnabled {
}
export {};
//# sourceMappingURL=inviteRequests.d.ts.map