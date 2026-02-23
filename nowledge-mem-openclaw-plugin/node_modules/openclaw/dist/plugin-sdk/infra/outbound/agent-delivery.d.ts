import type { ChannelOutboundTargetMode } from "../../channels/plugins/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions.js";
import { type GatewayMessageChannel } from "../../utils/message-channel.js";
import type { OutboundTargetResolution } from "./targets.js";
import { type SessionDeliveryTarget } from "./targets.js";
export type AgentDeliveryPlan = {
    baseDelivery: SessionDeliveryTarget;
    resolvedChannel: GatewayMessageChannel;
    resolvedTo?: string;
    resolvedAccountId?: string;
    resolvedThreadId?: string | number;
    deliveryTargetMode?: ChannelOutboundTargetMode;
};
export declare function resolveAgentDeliveryPlan(params: {
    sessionEntry?: SessionEntry;
    requestedChannel?: string;
    explicitTo?: string;
    explicitThreadId?: string | number;
    accountId?: string;
    wantsDelivery: boolean;
}): AgentDeliveryPlan;
export declare function resolveAgentOutboundTarget(params: {
    cfg: OpenClawConfig;
    plan: AgentDeliveryPlan;
    targetMode?: ChannelOutboundTargetMode;
    validateExplicitTarget?: boolean;
}): {
    resolvedTarget: OutboundTargetResolution | null;
    resolvedTo?: string;
    targetMode: ChannelOutboundTargetMode;
};
