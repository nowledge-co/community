import type { OptionalArgument } from '../helpers';
import type { CursorPaginationEnabled, FileArgument, FileCommentArgument, MessageArgument, OptionalTeamAssignable, TokenOverridable, TraditionalPagingEnabled } from './common';
export interface ReactionsFull {
    /** @description If `true`, return the complete reaction list. */
    full?: boolean;
}
export interface ReactionName {
    /** @description Reaction (emoji) name. */
    name: string;
}
export interface ReactionsAddArguments extends MessageArgument, TokenOverridable, ReactionName {
}
export type ReactionsGetArguments = ReactionsFull & TokenOverridable & (MessageArgument | FileArgument | FileCommentArgument);
export type ReactionsListArguments = OptionalArgument<ReactionsFull & TokenOverridable & TraditionalPagingEnabled & CursorPaginationEnabled & OptionalTeamAssignable & {
    /** @description Show reactions made by this user. Defaults to the authed user. */
    user?: string;
}>;
export type ReactionsRemoveArguments = TokenOverridable & ReactionName & (MessageArgument | FileArgument | FileCommentArgument);
//# sourceMappingURL=reactions.d.ts.map