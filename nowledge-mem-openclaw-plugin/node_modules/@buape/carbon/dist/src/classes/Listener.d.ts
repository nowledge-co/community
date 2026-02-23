import { BaseListener } from "../abstracts/BaseListener.js";
import { type ListenerEventData, type ListenerEventRawData } from "../types/index.js";
import type { Client } from "./Client.js";
export declare abstract class GuildAvailableListener extends BaseListener {
    readonly type: string;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
}
export declare abstract class GuildUnavailableListener extends BaseListener {
    readonly type: string;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
}
export declare abstract class ApplicationAuthorizedListener extends BaseListener {
    readonly type = ApplicationWebhookEventType.ApplicationAuthorized;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class EntitlementCreateListener extends BaseListener {
    readonly type = ApplicationWebhookEventType.EntitlementCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class QuestUserEnrollmentListener extends BaseListener {
    readonly type = ApplicationWebhookEventType.QuestUserEnrollment;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]]): ListenerEventData[this["type"]];
}
export declare abstract class ApplicationCommandPermissionsUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ApplicationCommandPermissionsUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class AutoModerationActionExecutionListener extends BaseListener {
    readonly type = GatewayDispatchEvents.AutoModerationActionExecution;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class AutoModerationRuleCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.AutoModerationRuleCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class AutoModerationRuleDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.AutoModerationRuleDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class AutoModerationRuleUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.AutoModerationRuleUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ChannelCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ChannelCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ChannelDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ChannelDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ChannelPinsUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ChannelPinsUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ChannelUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ChannelUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class EntitlementDeleteListener extends BaseListener {
    readonly type = ApplicationWebhookEventType.EntitlementDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class EntitlementUpdateListener extends BaseListener {
    readonly type = ApplicationWebhookEventType.EntitlementUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildAuditLogEntryCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildAuditLogEntryCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildBanAddListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildBanAdd;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildBanRemoveListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildBanRemove;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildEmojisUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildEmojisUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildIntegrationsUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildIntegrationsUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildMemberAddListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildMemberAdd;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildMemberRemoveListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildMemberRemove;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildMemberUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildMemberUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildMembersChunkListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildMembersChunk;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildRoleCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildRoleCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildRoleDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildRoleDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildRoleUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildRoleUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildScheduledEventCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildScheduledEventCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildScheduledEventDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildScheduledEventDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildScheduledEventUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildScheduledEventUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildScheduledEventUserAddListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildScheduledEventUserAdd;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildScheduledEventUserRemoveListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildScheduledEventUserRemove;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildSoundboardSoundCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildSoundboardSoundCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildSoundboardSoundDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildSoundboardSoundDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildSoundboardSoundUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildSoundboardSoundUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildSoundboardSoundsUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildSoundboardSoundsUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildStickersUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildStickersUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class GuildUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.GuildUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class IntegrationCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.IntegrationCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class IntegrationDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.IntegrationDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class IntegrationUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.IntegrationUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class InteractionCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.InteractionCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class InviteCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.InviteCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class InviteDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.InviteDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class MessageCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.MessageCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class MessageDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.MessageDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class MessageDeleteBulkListener extends BaseListener {
    readonly type = GatewayDispatchEvents.MessageDeleteBulk;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class MessageReactionAddListener extends BaseListener {
    readonly type = GatewayDispatchEvents.MessageReactionAdd;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class MessageReactionRemoveListener extends BaseListener {
    readonly type = GatewayDispatchEvents.MessageReactionRemove;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class MessageReactionRemoveAllListener extends BaseListener {
    readonly type = GatewayDispatchEvents.MessageReactionRemoveAll;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class MessageReactionRemoveEmojiListener extends BaseListener {
    readonly type = GatewayDispatchEvents.MessageReactionRemoveEmoji;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class MessageUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.MessageUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class PresenceUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.PresenceUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ReadyListener extends BaseListener {
    readonly type = GatewayDispatchEvents.Ready;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ResumedListener extends BaseListener {
    readonly type = GatewayDispatchEvents.Resumed;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]]): ListenerEventData[this["type"]];
}
export declare abstract class StageInstanceCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.StageInstanceCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class StageInstanceDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.StageInstanceDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class StageInstanceUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.StageInstanceUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class SubscriptionCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.SubscriptionCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class SubscriptionDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.SubscriptionDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class SubscriptionUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.SubscriptionUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ThreadCreateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ThreadCreate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ThreadDeleteListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ThreadDelete;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ThreadListSyncListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ThreadListSync;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ThreadMemberUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ThreadMemberUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ThreadMembersUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ThreadMembersUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class ThreadUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.ThreadUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class TypingStartListener extends BaseListener {
    readonly type = GatewayDispatchEvents.TypingStart;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class UserUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.UserUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class VoiceServerUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.VoiceServerUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class VoiceStateUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.VoiceStateUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class WebhooksUpdateListener extends BaseListener {
    readonly type = GatewayDispatchEvents.WebhooksUpdate;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class MessagePollVoteAddListener extends BaseListener {
    readonly type = GatewayDispatchEvents.MessagePollVoteAdd;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class MessagePollVoteRemoveListener extends BaseListener {
    readonly type = GatewayDispatchEvents.MessagePollVoteRemove;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
export declare abstract class VoiceChannelEffectSendListener extends BaseListener {
    readonly type = GatewayDispatchEvents.VoiceChannelEffectSend;
    abstract handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
    parseRawData(data: ListenerEventRawData[this["type"]], client: Client): ListenerEventData[this["type"]];
}
//# sourceMappingURL=Listener.d.ts.map