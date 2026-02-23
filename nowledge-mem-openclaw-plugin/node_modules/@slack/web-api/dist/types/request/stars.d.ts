import type { CursorPaginationEnabled, FileArgument, FileCommentArgument, MessageArgument, OptionalTeamAssignable, TokenOverridable, TraditionalPagingEnabled } from './common';
/** @description When starring something, it can be starred _to_ a channel. */
export interface StarsChannelDestination {
    /** @description Encoded channel ID the star belongs to. */
    channel: string;
}
export type StarsAddRemoveArguments = TokenOverridable & (StarsChannelDestination | MessageArgument | FileArgument | FileCommentArgument);
export interface StarsListArguments extends TokenOverridable, TraditionalPagingEnabled, CursorPaginationEnabled, OptionalTeamAssignable {
}
//# sourceMappingURL=stars.d.ts.map