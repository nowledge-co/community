import type { ChannelOutboundTargetMode } from "../../channels/plugins/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions.js";
import type { AgentDefaultsConfig } from "../../config/types.agent-defaults.js";
import type { DeliverableMessageChannel, GatewayMessageChannel } from "../../utils/message-channel.js";
export type OutboundChannel = DeliverableMessageChannel | "none";
export type HeartbeatTarget = OutboundChannel | "last";
export type OutboundTarget = {
    channel: OutboundChannel;
    to?: string;
    reason?: string;
    accountId?: string;
    threadId?: string | number;
    lastChannel?: DeliverableMessageChannel;
    lastAccountId?: string;
};
export type HeartbeatSenderContext = {
    sender: string;
    provider?: DeliverableMessageChannel;
    allowFrom: string[];
};
export type OutboundTargetResolution = {
    ok: true;
    to: string;
} | {
    ok: false;
    error: Error;
};
export type SessionDeliveryTarget = {
    channel?: DeliverableMessageChannel;
    to?: string;
    accountId?: string;
    threadId?: string | number;
    /** Whether threadId came from an explicit source (config/param/:topic: parsing) vs session history. */
    threadIdExplicit?: boolean;
    mode: ChannelOutboundTargetMode;
    lastChannel?: DeliverableMessageChannel;
    lastTo?: string;
    lastAccountId?: string;
    lastThreadId?: string | number;
};
export declare function resolveSessionDeliveryTarget(params: {
    entry?: SessionEntry;
    requestedChannel?: GatewayMessageChannel | "last";
    explicitTo?: string;
    explicitThreadId?: string | number;
    fallbackChannel?: DeliverableMessageChannel;
    allowMismatchedLastTo?: boolean;
    mode?: ChannelOutboundTargetMode;
}): SessionDeliveryTarget;
export declare function resolveOutboundTarget(params: {
    channel: GatewayMessageChannel;
    to?: string;
    allowFrom?: string[];
    cfg?: OpenClawConfig;
    accountId?: string | null;
    mode?: ChannelOutboundTargetMode;
}): OutboundTargetResolution;
export declare function resolveHeartbeatDeliveryTarget(params: {
    cfg: OpenClawConfig;
    entry?: SessionEntry;
    heartbeat?: AgentDefaultsConfig["heartbeat"];
}): OutboundTarget;
export declare function resolveHeartbeatSenderContext(params: {
    cfg: OpenClawConfig;
    entry?: SessionEntry;
    delivery: OutboundTarget;
}): HeartbeatSenderContext;
