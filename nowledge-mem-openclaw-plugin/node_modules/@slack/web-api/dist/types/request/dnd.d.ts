import type { OptionalArgument } from '../helpers';
import type { OptionalTeamAssignable, TokenOverridable } from './common';
export type DndEndDndArguments = OptionalArgument<TokenOverridable>;
export type DndEndSnoozeArguments = OptionalArgument<TokenOverridable>;
export type DndInfoArguments = OptionalArgument<TokenOverridable & OptionalTeamAssignable & {
    /** @description User to fetch status for (defaults to authed user). */
    user?: string;
}>;
export interface DndSetSnoozeArguments extends TokenOverridable {
    /** @description Number of minutes, from now, to snooze until. */
    num_minutes: number;
}
export interface DndTeamInfoArguments extends TokenOverridable, OptionalTeamAssignable {
    /** @description Comma-separated list of users to fetch Do Not Disturb status for. */
    users: string;
}
//# sourceMappingURL=dnd.d.ts.map