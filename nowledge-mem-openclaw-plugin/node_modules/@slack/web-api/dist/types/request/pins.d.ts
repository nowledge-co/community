import type { MessageArgument, TokenOverridable } from './common';
export interface PinsAddArguments extends MessageArgument, TokenOverridable {
}
export interface PinsListArguments extends TokenOverridable {
    /** @description Channel to get pinned items for. */
    channel: string;
}
export interface PinsRemoveArguments extends MessageArgument, TokenOverridable {
}
//# sourceMappingURL=pins.d.ts.map