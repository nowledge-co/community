import { type APIWebhookEventApplicationAuthorizedData, type APIWebhookEventApplicationDeauthorizedData, type APIWebhookEventEntitlementCreateData, type APIWebhookEventQuestUserEnrollmentData, ApplicationWebhookEventType, type GatewayApplicationCommandPermissionsUpdateDispatchData, type GatewayAutoModerationActionExecutionDispatchData, type GatewayAutoModerationRuleCreateDispatchData, type GatewayAutoModerationRuleDeleteDispatchData, type GatewayAutoModerationRuleUpdateDispatchData, type GatewayChannelCreateDispatchData, type GatewayChannelDeleteDispatchData, type GatewayChannelPinsUpdateDispatchData, type GatewayChannelUpdateDispatchData, GatewayDispatchEvents, type GatewayEntitlementDeleteDispatchData, type GatewayEntitlementUpdateDispatchData, type GatewayGuildAuditLogEntryCreateDispatchData, type GatewayGuildBanAddDispatchData, type GatewayGuildBanRemoveDispatchData, type GatewayGuildCreateDispatchData, type GatewayGuildDeleteDispatchData, type GatewayGuildEmojisUpdateDispatchData, type GatewayGuildIntegrationsUpdateDispatchData, type GatewayGuildMemberAddDispatchData, type GatewayGuildMemberRemoveDispatchData, type GatewayGuildMembersChunkDispatchData, type GatewayGuildMemberUpdateDispatchData, type GatewayGuildRoleCreateDispatchData, type GatewayGuildRoleDeleteDispatchData, type GatewayGuildRoleUpdateDispatchData, type GatewayGuildScheduledEventCreateDispatchData, type GatewayGuildScheduledEventDeleteDispatchData, type GatewayGuildScheduledEventUpdateDispatchData, type GatewayGuildScheduledEventUserAddDispatchData, type GatewayGuildScheduledEventUserRemoveDispatchData, type GatewayGuildSoundboardSoundCreateDispatchData, type GatewayGuildSoundboardSoundDeleteDispatchData, type GatewayGuildSoundboardSoundsUpdateDispatchData, type GatewayGuildSoundboardSoundUpdateDispatchData, type GatewayGuildStickersUpdateDispatchData, type GatewayGuildUpdateDispatchData, type GatewayIntegrationCreateDispatchData, type GatewayIntegrationDeleteDispatchData, type GatewayIntegrationUpdateDispatchData, type GatewayInteractionCreateDispatchData, type GatewayInviteCreateDispatchData, type GatewayInviteDeleteDispatchData, type GatewayMessageCreateDispatchData, type GatewayMessageDeleteBulkDispatchData, type GatewayMessageDeleteDispatchData, type GatewayMessagePollVoteDispatchData, type GatewayMessageReactionAddDispatchData, type GatewayMessageReactionRemoveAllDispatchData, type GatewayMessageReactionRemoveDispatchData, type GatewayMessageReactionRemoveEmojiDispatchData, type GatewayMessageUpdateDispatchData, type GatewayPresenceUpdateDispatchData, type GatewayRateLimitedDispatchData, type GatewayReadyDispatchData, type GatewayResumedDispatch, type GatewayStageInstanceCreateDispatchData, type GatewayStageInstanceDeleteDispatchData, type GatewayStageInstanceUpdateDispatchData, type GatewaySubscriptionCreateDispatchData, type GatewaySubscriptionDeleteDispatchData, type GatewaySubscriptionUpdateDispatchData, type GatewayThreadCreateDispatchData, type GatewayThreadDeleteDispatchData, type GatewayThreadListSyncDispatchData, type GatewayThreadMembersUpdateDispatchData, type GatewayThreadMemberUpdateDispatchData, type GatewayThreadUpdateDispatchData, type GatewayTypingStartDispatchData, type GatewayUserUpdateDispatchData, type GatewayVoiceChannelEffectSendDispatchData, type GatewayVoiceServerUpdateDispatchData, type GatewayVoiceStateUpdateDispatchData, type GatewayWebhooksUpdateDispatchData, type ThreadChannelType } from "discord-api-types/v10";
import type { AnyChannel } from "../functions/channelFactory.js";
import type { Guild } from "../structures/Guild.js";
import type { GuildMember } from "../structures/GuildMember.js";
import type { GuildThreadChannel } from "../structures/GuildThreadChannel.js";
import type { Message } from "../structures/Message.js";
import type { Role } from "../structures/Role.js";
import type { ThreadMember } from "../structures/ThreadMember.js";
import type { User } from "../structures/User.js";
export declare const WebhookEvent: {
    ApplicationAuthorized: ApplicationWebhookEventType.ApplicationAuthorized;
    ApplicationDeauthorized: ApplicationWebhookEventType.ApplicationDeauthorized;
    EntitlementCreate: ApplicationWebhookEventType.EntitlementCreate;
    EntitlementUpdate: ApplicationWebhookEventType.EntitlementUpdate;
    EntitlementDelete: ApplicationWebhookEventType.EntitlementDelete;
    QuestUserEnrollment: ApplicationWebhookEventType.QuestUserEnrollment;
};
export declare const GatewayEvent: {
    ApplicationCommandPermissionsUpdate: GatewayDispatchEvents.ApplicationCommandPermissionsUpdate;
    AutoModerationActionExecution: GatewayDispatchEvents.AutoModerationActionExecution;
    AutoModerationRuleCreate: GatewayDispatchEvents.AutoModerationRuleCreate;
    AutoModerationRuleDelete: GatewayDispatchEvents.AutoModerationRuleDelete;
    AutoModerationRuleUpdate: GatewayDispatchEvents.AutoModerationRuleUpdate;
    ChannelCreate: GatewayDispatchEvents.ChannelCreate;
    ChannelDelete: GatewayDispatchEvents.ChannelDelete;
    ChannelPinsUpdate: GatewayDispatchEvents.ChannelPinsUpdate;
    ChannelUpdate: GatewayDispatchEvents.ChannelUpdate;
    EntitlementCreate: GatewayDispatchEvents.EntitlementCreate;
    EntitlementDelete: GatewayDispatchEvents.EntitlementDelete;
    EntitlementUpdate: GatewayDispatchEvents.EntitlementUpdate;
    GuildAuditLogEntryCreate: GatewayDispatchEvents.GuildAuditLogEntryCreate;
    GuildBanAdd: GatewayDispatchEvents.GuildBanAdd;
    GuildBanRemove: GatewayDispatchEvents.GuildBanRemove;
    GuildCreate: GatewayDispatchEvents.GuildCreate;
    GuildDelete: GatewayDispatchEvents.GuildDelete;
    GuildEmojisUpdate: GatewayDispatchEvents.GuildEmojisUpdate;
    GuildIntegrationsUpdate: GatewayDispatchEvents.GuildIntegrationsUpdate;
    GuildMemberAdd: GatewayDispatchEvents.GuildMemberAdd;
    GuildMemberRemove: GatewayDispatchEvents.GuildMemberRemove;
    GuildMembersChunk: GatewayDispatchEvents.GuildMembersChunk;
    GuildMemberUpdate: GatewayDispatchEvents.GuildMemberUpdate;
    GuildRoleCreate: GatewayDispatchEvents.GuildRoleCreate;
    GuildRoleDelete: GatewayDispatchEvents.GuildRoleDelete;
    GuildRoleUpdate: GatewayDispatchEvents.GuildRoleUpdate;
    GuildScheduledEventCreate: GatewayDispatchEvents.GuildScheduledEventCreate;
    GuildScheduledEventDelete: GatewayDispatchEvents.GuildScheduledEventDelete;
    GuildScheduledEventUpdate: GatewayDispatchEvents.GuildScheduledEventUpdate;
    GuildScheduledEventUserAdd: GatewayDispatchEvents.GuildScheduledEventUserAdd;
    GuildScheduledEventUserRemove: GatewayDispatchEvents.GuildScheduledEventUserRemove;
    GuildSoundboardSoundCreate: GatewayDispatchEvents.GuildSoundboardSoundCreate;
    GuildSoundboardSoundDelete: GatewayDispatchEvents.GuildSoundboardSoundDelete;
    GuildSoundboardSoundsUpdate: GatewayDispatchEvents.GuildSoundboardSoundsUpdate;
    GuildSoundboardSoundUpdate: GatewayDispatchEvents.GuildSoundboardSoundUpdate;
    SoundboardSounds: GatewayDispatchEvents.SoundboardSounds;
    GuildStickersUpdate: GatewayDispatchEvents.GuildStickersUpdate;
    GuildUpdate: GatewayDispatchEvents.GuildUpdate;
    IntegrationCreate: GatewayDispatchEvents.IntegrationCreate;
    IntegrationDelete: GatewayDispatchEvents.IntegrationDelete;
    IntegrationUpdate: GatewayDispatchEvents.IntegrationUpdate;
    InteractionCreate: GatewayDispatchEvents.InteractionCreate;
    InviteCreate: GatewayDispatchEvents.InviteCreate;
    InviteDelete: GatewayDispatchEvents.InviteDelete;
    MessageCreate: GatewayDispatchEvents.MessageCreate;
    MessageDelete: GatewayDispatchEvents.MessageDelete;
    MessageDeleteBulk: GatewayDispatchEvents.MessageDeleteBulk;
    MessagePollVoteAdd: GatewayDispatchEvents.MessagePollVoteAdd;
    MessagePollVoteRemove: GatewayDispatchEvents.MessagePollVoteRemove;
    MessageReactionAdd: GatewayDispatchEvents.MessageReactionAdd;
    MessageReactionRemove: GatewayDispatchEvents.MessageReactionRemove;
    MessageReactionRemoveAll: GatewayDispatchEvents.MessageReactionRemoveAll;
    MessageReactionRemoveEmoji: GatewayDispatchEvents.MessageReactionRemoveEmoji;
    MessageUpdate: GatewayDispatchEvents.MessageUpdate;
    PresenceUpdate: GatewayDispatchEvents.PresenceUpdate;
    RateLimited: GatewayDispatchEvents.RateLimited;
    Ready: GatewayDispatchEvents.Ready;
    Resumed: GatewayDispatchEvents.Resumed;
    StageInstanceCreate: GatewayDispatchEvents.StageInstanceCreate;
    StageInstanceDelete: GatewayDispatchEvents.StageInstanceDelete;
    StageInstanceUpdate: GatewayDispatchEvents.StageInstanceUpdate;
    SubscriptionCreate: GatewayDispatchEvents.SubscriptionCreate;
    SubscriptionDelete: GatewayDispatchEvents.SubscriptionDelete;
    SubscriptionUpdate: GatewayDispatchEvents.SubscriptionUpdate;
    ThreadCreate: GatewayDispatchEvents.ThreadCreate;
    ThreadDelete: GatewayDispatchEvents.ThreadDelete;
    ThreadListSync: GatewayDispatchEvents.ThreadListSync;
    ThreadMembersUpdate: GatewayDispatchEvents.ThreadMembersUpdate;
    ThreadMemberUpdate: GatewayDispatchEvents.ThreadMemberUpdate;
    ThreadUpdate: GatewayDispatchEvents.ThreadUpdate;
    TypingStart: GatewayDispatchEvents.TypingStart;
    UserUpdate: GatewayDispatchEvents.UserUpdate;
    VoiceChannelEffectSend: GatewayDispatchEvents.VoiceChannelEffectSend;
    VoiceServerUpdate: GatewayDispatchEvents.VoiceServerUpdate;
    VoiceStateUpdate: GatewayDispatchEvents.VoiceStateUpdate;
    WebhooksUpdate: GatewayDispatchEvents.WebhooksUpdate;
};
export declare const ListenerEvent: {
    GuildAvailable: string;
    GuildUnavailable: string;
    ApplicationAuthorized: ApplicationWebhookEventType.ApplicationAuthorized;
    ApplicationDeauthorized: ApplicationWebhookEventType.ApplicationDeauthorized;
    EntitlementCreate: ApplicationWebhookEventType.EntitlementCreate;
    EntitlementUpdate: ApplicationWebhookEventType.EntitlementUpdate;
    EntitlementDelete: ApplicationWebhookEventType.EntitlementDelete;
    QuestUserEnrollment: ApplicationWebhookEventType.QuestUserEnrollment;
    ApplicationCommandPermissionsUpdate: GatewayDispatchEvents.ApplicationCommandPermissionsUpdate;
    AutoModerationActionExecution: GatewayDispatchEvents.AutoModerationActionExecution;
    AutoModerationRuleCreate: GatewayDispatchEvents.AutoModerationRuleCreate;
    AutoModerationRuleDelete: GatewayDispatchEvents.AutoModerationRuleDelete;
    AutoModerationRuleUpdate: GatewayDispatchEvents.AutoModerationRuleUpdate;
    ChannelCreate: GatewayDispatchEvents.ChannelCreate;
    ChannelDelete: GatewayDispatchEvents.ChannelDelete;
    ChannelPinsUpdate: GatewayDispatchEvents.ChannelPinsUpdate;
    ChannelUpdate: GatewayDispatchEvents.ChannelUpdate;
    GuildAuditLogEntryCreate: GatewayDispatchEvents.GuildAuditLogEntryCreate;
    GuildBanAdd: GatewayDispatchEvents.GuildBanAdd;
    GuildBanRemove: GatewayDispatchEvents.GuildBanRemove;
    GuildCreate: GatewayDispatchEvents.GuildCreate;
    GuildDelete: GatewayDispatchEvents.GuildDelete;
    GuildEmojisUpdate: GatewayDispatchEvents.GuildEmojisUpdate;
    GuildIntegrationsUpdate: GatewayDispatchEvents.GuildIntegrationsUpdate;
    GuildMemberAdd: GatewayDispatchEvents.GuildMemberAdd;
    GuildMemberRemove: GatewayDispatchEvents.GuildMemberRemove;
    GuildMembersChunk: GatewayDispatchEvents.GuildMembersChunk;
    GuildMemberUpdate: GatewayDispatchEvents.GuildMemberUpdate;
    GuildRoleCreate: GatewayDispatchEvents.GuildRoleCreate;
    GuildRoleDelete: GatewayDispatchEvents.GuildRoleDelete;
    GuildRoleUpdate: GatewayDispatchEvents.GuildRoleUpdate;
    GuildScheduledEventCreate: GatewayDispatchEvents.GuildScheduledEventCreate;
    GuildScheduledEventDelete: GatewayDispatchEvents.GuildScheduledEventDelete;
    GuildScheduledEventUpdate: GatewayDispatchEvents.GuildScheduledEventUpdate;
    GuildScheduledEventUserAdd: GatewayDispatchEvents.GuildScheduledEventUserAdd;
    GuildScheduledEventUserRemove: GatewayDispatchEvents.GuildScheduledEventUserRemove;
    GuildSoundboardSoundCreate: GatewayDispatchEvents.GuildSoundboardSoundCreate;
    GuildSoundboardSoundDelete: GatewayDispatchEvents.GuildSoundboardSoundDelete;
    GuildSoundboardSoundsUpdate: GatewayDispatchEvents.GuildSoundboardSoundsUpdate;
    GuildSoundboardSoundUpdate: GatewayDispatchEvents.GuildSoundboardSoundUpdate;
    SoundboardSounds: GatewayDispatchEvents.SoundboardSounds;
    GuildStickersUpdate: GatewayDispatchEvents.GuildStickersUpdate;
    GuildUpdate: GatewayDispatchEvents.GuildUpdate;
    IntegrationCreate: GatewayDispatchEvents.IntegrationCreate;
    IntegrationDelete: GatewayDispatchEvents.IntegrationDelete;
    IntegrationUpdate: GatewayDispatchEvents.IntegrationUpdate;
    InteractionCreate: GatewayDispatchEvents.InteractionCreate;
    InviteCreate: GatewayDispatchEvents.InviteCreate;
    InviteDelete: GatewayDispatchEvents.InviteDelete;
    MessageCreate: GatewayDispatchEvents.MessageCreate;
    MessageDelete: GatewayDispatchEvents.MessageDelete;
    MessageDeleteBulk: GatewayDispatchEvents.MessageDeleteBulk;
    MessagePollVoteAdd: GatewayDispatchEvents.MessagePollVoteAdd;
    MessagePollVoteRemove: GatewayDispatchEvents.MessagePollVoteRemove;
    MessageReactionAdd: GatewayDispatchEvents.MessageReactionAdd;
    MessageReactionRemove: GatewayDispatchEvents.MessageReactionRemove;
    MessageReactionRemoveAll: GatewayDispatchEvents.MessageReactionRemoveAll;
    MessageReactionRemoveEmoji: GatewayDispatchEvents.MessageReactionRemoveEmoji;
    MessageUpdate: GatewayDispatchEvents.MessageUpdate;
    PresenceUpdate: GatewayDispatchEvents.PresenceUpdate;
    RateLimited: GatewayDispatchEvents.RateLimited;
    Ready: GatewayDispatchEvents.Ready;
    Resumed: GatewayDispatchEvents.Resumed;
    StageInstanceCreate: GatewayDispatchEvents.StageInstanceCreate;
    StageInstanceDelete: GatewayDispatchEvents.StageInstanceDelete;
    StageInstanceUpdate: GatewayDispatchEvents.StageInstanceUpdate;
    SubscriptionCreate: GatewayDispatchEvents.SubscriptionCreate;
    SubscriptionDelete: GatewayDispatchEvents.SubscriptionDelete;
    SubscriptionUpdate: GatewayDispatchEvents.SubscriptionUpdate;
    ThreadCreate: GatewayDispatchEvents.ThreadCreate;
    ThreadDelete: GatewayDispatchEvents.ThreadDelete;
    ThreadListSync: GatewayDispatchEvents.ThreadListSync;
    ThreadMembersUpdate: GatewayDispatchEvents.ThreadMembersUpdate;
    ThreadMemberUpdate: GatewayDispatchEvents.ThreadMemberUpdate;
    ThreadUpdate: GatewayDispatchEvents.ThreadUpdate;
    TypingStart: GatewayDispatchEvents.TypingStart;
    UserUpdate: GatewayDispatchEvents.UserUpdate;
    VoiceChannelEffectSend: GatewayDispatchEvents.VoiceChannelEffectSend;
    VoiceServerUpdate: GatewayDispatchEvents.VoiceServerUpdate;
    VoiceStateUpdate: GatewayDispatchEvents.VoiceStateUpdate;
    WebhooksUpdate: GatewayDispatchEvents.WebhooksUpdate;
};
export type ListenerEventType = (typeof ListenerEvent)[keyof typeof ListenerEvent];
export type ListenerEventAdditionalData = {
    clientId: string;
};
export type ListenerEventRawData = {
    [ListenerEvent.ApplicationAuthorized]: APIWebhookEventApplicationAuthorizedData;
    [ListenerEvent.ApplicationDeauthorized]: APIWebhookEventApplicationDeauthorizedData;
    [ListenerEvent.EntitlementCreate]: APIWebhookEventEntitlementCreateData;
    [ListenerEvent.QuestUserEnrollment]: APIWebhookEventQuestUserEnrollmentData;
    [ListenerEvent.ApplicationCommandPermissionsUpdate]: GatewayApplicationCommandPermissionsUpdateDispatchData;
    [ListenerEvent.AutoModerationActionExecution]: GatewayAutoModerationActionExecutionDispatchData;
    [ListenerEvent.AutoModerationRuleCreate]: GatewayAutoModerationRuleCreateDispatchData;
    [ListenerEvent.AutoModerationRuleDelete]: GatewayAutoModerationRuleDeleteDispatchData;
    [ListenerEvent.AutoModerationRuleUpdate]: GatewayAutoModerationRuleUpdateDispatchData;
    [ListenerEvent.ChannelCreate]: GatewayChannelCreateDispatchData;
    [ListenerEvent.ChannelDelete]: GatewayChannelDeleteDispatchData;
    [ListenerEvent.ChannelPinsUpdate]: GatewayChannelPinsUpdateDispatchData;
    [ListenerEvent.ChannelUpdate]: GatewayChannelUpdateDispatchData;
    [ListenerEvent.EntitlementDelete]: GatewayEntitlementDeleteDispatchData;
    [ListenerEvent.EntitlementUpdate]: GatewayEntitlementUpdateDispatchData;
    [ListenerEvent.GuildAuditLogEntryCreate]: GatewayGuildAuditLogEntryCreateDispatchData;
    [ListenerEvent.GuildBanAdd]: GatewayGuildBanAddDispatchData;
    [ListenerEvent.GuildBanRemove]: GatewayGuildBanRemoveDispatchData;
    [ListenerEvent.GuildCreate]: GatewayGuildCreateDispatchData;
    [ListenerEvent.GuildDelete]: GatewayGuildDeleteDispatchData;
    [ListenerEvent.GuildEmojisUpdate]: GatewayGuildEmojisUpdateDispatchData;
    [ListenerEvent.GuildIntegrationsUpdate]: GatewayGuildIntegrationsUpdateDispatchData;
    [ListenerEvent.GuildMemberAdd]: GatewayGuildMemberAddDispatchData;
    [ListenerEvent.GuildMemberRemove]: GatewayGuildMemberRemoveDispatchData;
    [ListenerEvent.GuildMemberUpdate]: GatewayGuildMemberUpdateDispatchData;
    [ListenerEvent.GuildMembersChunk]: GatewayGuildMembersChunkDispatchData;
    [ListenerEvent.GuildRoleCreate]: GatewayGuildRoleCreateDispatchData;
    [ListenerEvent.GuildRoleDelete]: GatewayGuildRoleDeleteDispatchData;
    [ListenerEvent.GuildRoleUpdate]: GatewayGuildRoleUpdateDispatchData;
    [ListenerEvent.GuildScheduledEventCreate]: GatewayGuildScheduledEventCreateDispatchData;
    [ListenerEvent.GuildScheduledEventDelete]: GatewayGuildScheduledEventDeleteDispatchData;
    [ListenerEvent.GuildScheduledEventUpdate]: GatewayGuildScheduledEventUpdateDispatchData;
    [ListenerEvent.GuildScheduledEventUserAdd]: GatewayGuildScheduledEventUserAddDispatchData;
    [ListenerEvent.GuildScheduledEventUserRemove]: GatewayGuildScheduledEventUserRemoveDispatchData;
    [ListenerEvent.GuildSoundboardSoundCreate]: GatewayGuildSoundboardSoundCreateDispatchData;
    [ListenerEvent.GuildSoundboardSoundDelete]: GatewayGuildSoundboardSoundDeleteDispatchData;
    [ListenerEvent.GuildSoundboardSoundUpdate]: GatewayGuildSoundboardSoundUpdateDispatchData;
    [ListenerEvent.GuildSoundboardSoundsUpdate]: GatewayGuildSoundboardSoundsUpdateDispatchData;
    [ListenerEvent.SoundboardSounds]: GatewayGuildSoundboardSoundsUpdateDispatchData;
    [ListenerEvent.GuildStickersUpdate]: GatewayGuildStickersUpdateDispatchData;
    [ListenerEvent.GuildUpdate]: GatewayGuildUpdateDispatchData;
    [ListenerEvent.IntegrationCreate]: GatewayIntegrationCreateDispatchData;
    [ListenerEvent.IntegrationDelete]: GatewayIntegrationDeleteDispatchData;
    [ListenerEvent.IntegrationUpdate]: GatewayIntegrationUpdateDispatchData;
    [ListenerEvent.InteractionCreate]: GatewayInteractionCreateDispatchData;
    [ListenerEvent.InviteCreate]: GatewayInviteCreateDispatchData;
    [ListenerEvent.InviteDelete]: GatewayInviteDeleteDispatchData;
    [ListenerEvent.MessageCreate]: GatewayMessageCreateDispatchData;
    [ListenerEvent.MessageDelete]: GatewayMessageDeleteDispatchData;
    [ListenerEvent.MessageDeleteBulk]: GatewayMessageDeleteBulkDispatchData;
    [ListenerEvent.MessagePollVoteAdd]: GatewayMessagePollVoteDispatchData;
    [ListenerEvent.MessagePollVoteRemove]: GatewayMessagePollVoteDispatchData;
    [ListenerEvent.MessageReactionAdd]: GatewayMessageReactionAddDispatchData;
    [ListenerEvent.MessageReactionRemove]: GatewayMessageReactionRemoveDispatchData;
    [ListenerEvent.MessageReactionRemoveAll]: GatewayMessageReactionRemoveAllDispatchData;
    [ListenerEvent.MessageReactionRemoveEmoji]: GatewayMessageReactionRemoveEmojiDispatchData;
    [ListenerEvent.MessageUpdate]: GatewayMessageUpdateDispatchData;
    [ListenerEvent.PresenceUpdate]: GatewayPresenceUpdateDispatchData;
    [ListenerEvent.RateLimited]: GatewayRateLimitedDispatchData;
    [ListenerEvent.Ready]: GatewayReadyDispatchData;
    [ListenerEvent.Resumed]: GatewayResumedDispatch["d"];
    [ListenerEvent.StageInstanceCreate]: GatewayStageInstanceCreateDispatchData;
    [ListenerEvent.StageInstanceDelete]: GatewayStageInstanceDeleteDispatchData;
    [ListenerEvent.StageInstanceUpdate]: GatewayStageInstanceUpdateDispatchData;
    [ListenerEvent.SubscriptionCreate]: GatewaySubscriptionCreateDispatchData;
    [ListenerEvent.SubscriptionDelete]: GatewaySubscriptionDeleteDispatchData;
    [ListenerEvent.SubscriptionUpdate]: GatewaySubscriptionUpdateDispatchData;
    [ListenerEvent.ThreadCreate]: GatewayThreadCreateDispatchData;
    [ListenerEvent.ThreadDelete]: GatewayThreadDeleteDispatchData;
    [ListenerEvent.ThreadListSync]: GatewayThreadListSyncDispatchData;
    [ListenerEvent.ThreadMembersUpdate]: GatewayThreadMembersUpdateDispatchData;
    [ListenerEvent.ThreadMemberUpdate]: GatewayThreadMemberUpdateDispatchData;
    [ListenerEvent.ThreadUpdate]: GatewayThreadUpdateDispatchData;
    [ListenerEvent.TypingStart]: GatewayTypingStartDispatchData;
    [ListenerEvent.UserUpdate]: GatewayUserUpdateDispatchData;
    [ListenerEvent.VoiceChannelEffectSend]: GatewayVoiceChannelEffectSendDispatchData;
    [ListenerEvent.VoiceServerUpdate]: GatewayVoiceServerUpdateDispatchData;
    [ListenerEvent.VoiceStateUpdate]: GatewayVoiceStateUpdateDispatchData;
    [ListenerEvent.WebhooksUpdate]: GatewayWebhooksUpdateDispatchData;
};
export type ListenerEventData = {
    [ListenerEvent.ApplicationAuthorized]: Omit<APIWebhookEventApplicationAuthorizedData, "guild" | "user"> & {
        guild?: Guild;
        user: User;
        rawGuild: APIWebhookEventApplicationAuthorizedData["guild"];
        rawUser: APIWebhookEventApplicationAuthorizedData["user"];
    };
    [ListenerEvent.ApplicationDeauthorized]: Omit<APIWebhookEventApplicationDeauthorizedData, "user"> & {
        user: User;
        rawUser: APIWebhookEventApplicationDeauthorizedData["user"];
    };
    [ListenerEvent.EntitlementCreate]: Omit<APIWebhookEventEntitlementCreateData, "guild" | "user"> & {
        guild?: Guild<true>;
        user?: User<true>;
    };
    [ListenerEvent.QuestUserEnrollment]: APIWebhookEventQuestUserEnrollmentData;
    [ListenerEvent.ApplicationCommandPermissionsUpdate]: Omit<GatewayApplicationCommandPermissionsUpdateDispatchData, "guild"> & {
        guild: Guild<true>;
    };
    [ListenerEvent.AutoModerationActionExecution]: Omit<GatewayAutoModerationActionExecutionDispatchData, "guild" | "user" | "message"> & {
        guild: Guild<true>;
        user: User<true>;
        message?: Message<true>;
    };
    [ListenerEvent.AutoModerationRuleCreate]: Omit<GatewayAutoModerationRuleCreateDispatchData, "guild" | "creator"> & {
        guild: Guild<true>;
        creator: User<true>;
    };
    [ListenerEvent.AutoModerationRuleDelete]: Omit<GatewayAutoModerationRuleDeleteDispatchData, "guild" | "creator"> & {
        guild: Guild<true>;
        creator: User<true>;
    };
    [ListenerEvent.AutoModerationRuleUpdate]: Omit<GatewayAutoModerationRuleUpdateDispatchData, "guild" | "creator"> & {
        guild: Guild<true>;
        creator: User<true>;
    };
    [ListenerEvent.ChannelCreate]: Omit<GatewayChannelCreateDispatchData, "channel"> & {
        channel?: AnyChannel;
        rawChannel: GatewayChannelCreateDispatchData;
    };
    [ListenerEvent.ChannelDelete]: Omit<GatewayChannelDeleteDispatchData, "channel"> & {
        channel?: AnyChannel;
        rawChannel: GatewayChannelDeleteDispatchData;
    };
    [ListenerEvent.ChannelPinsUpdate]: Omit<GatewayChannelPinsUpdateDispatchData, "guild" | "channel"> & {
        guild?: Guild<true>;
        channel?: AnyChannel;
    };
    [ListenerEvent.ChannelUpdate]: Omit<GatewayChannelUpdateDispatchData, "channel"> & {
        channel?: AnyChannel;
        rawChannel: GatewayChannelUpdateDispatchData;
    };
    [ListenerEvent.EntitlementDelete]: GatewayEntitlementDeleteDispatchData & {
        guild?: Guild<true>;
        user?: User<true>;
    };
    [ListenerEvent.EntitlementUpdate]: GatewayEntitlementUpdateDispatchData & {
        guild?: Guild<true>;
        user?: User<true>;
    };
    [ListenerEvent.GuildAuditLogEntryCreate]: GatewayGuildAuditLogEntryCreateDispatchData & {
        guild: Guild<true>;
        user: User<true>;
        target?: User<true>;
    };
    [ListenerEvent.GuildBanAdd]: Omit<GatewayGuildBanAddDispatchData, "user"> & {
        guild: Guild<true>;
        rawUser: GatewayGuildBanAddDispatchData["user"];
        user: User<false>;
    };
    [ListenerEvent.GuildBanRemove]: Omit<GatewayGuildBanRemoveDispatchData, "user"> & {
        guild: Guild<true>;
        rawUser: GatewayGuildBanRemoveDispatchData["user"];
        user: User<false>;
    };
    [ListenerEvent.GuildCreate]: Omit<GatewayGuildCreateDispatchData, "guild"> & {
        guild: Guild;
    };
    [ListenerEvent.GuildDelete]: Omit<GatewayGuildDeleteDispatchData, "guild"> & {
        guild: Guild<true>;
    };
    [ListenerEvent.GuildEmojisUpdate]: GatewayGuildEmojisUpdateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.GuildIntegrationsUpdate]: GatewayGuildIntegrationsUpdateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.GuildMemberAdd]: Omit<GatewayGuildMemberAddDispatchData, "guild" | "member"> & {
        guild: Guild<true>;
        member: GuildMember<false, true>;
    };
    [ListenerEvent.GuildMemberRemove]: Omit<GatewayGuildMemberRemoveDispatchData, "user"> & {
        guild: Guild<true>;
        user: User<false>;
        rawUser: GatewayGuildMemberRemoveDispatchData["user"];
    };
    [ListenerEvent.GuildMemberUpdate]: Omit<GatewayGuildMemberUpdateDispatchData, "member"> & {
        guild: Guild<true>;
        member: GuildMember<false, true>;
        rawMember: GatewayGuildMemberUpdateDispatchData;
    };
    [ListenerEvent.GuildMembersChunk]: Omit<GatewayGuildMembersChunkDispatchData, "members"> & {
        guild: Guild<true>;
        rawMembers: GatewayGuildMembersChunkDispatchData["members"];
        members: GuildMember<false, true>[];
    };
    [ListenerEvent.GuildRoleCreate]: Omit<GatewayGuildRoleCreateDispatchData, "role"> & {
        guild: Guild<true>;
        rawRole: GatewayGuildRoleCreateDispatchData["role"];
        role: Role;
    };
    [ListenerEvent.GuildRoleDelete]: GatewayGuildRoleDeleteDispatchData & {
        guild: Guild<true>;
        role: Role<true>;
    };
    [ListenerEvent.GuildRoleUpdate]: Omit<GatewayGuildRoleUpdateDispatchData, "role"> & {
        guild: Guild<true>;
        rawRole: GatewayGuildRoleUpdateDispatchData["role"];
        role: Role;
    };
    [ListenerEvent.GuildScheduledEventCreate]: Omit<GatewayGuildScheduledEventCreateDispatchData, "creator"> & {
        guild: Guild<true>;
        rawCreator: GatewayGuildScheduledEventCreateDispatchData["creator"];
        creator?: User;
    };
    [ListenerEvent.GuildScheduledEventDelete]: GatewayGuildScheduledEventDeleteDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.GuildScheduledEventUpdate]: GatewayGuildScheduledEventUpdateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.GuildScheduledEventUserAdd]: GatewayGuildScheduledEventUserAddDispatchData & {
        guild: Guild<true>;
        user: User<true>;
    };
    [ListenerEvent.GuildScheduledEventUserRemove]: GatewayGuildScheduledEventUserRemoveDispatchData & {
        guild: Guild<true>;
        user: User<true>;
    };
    [ListenerEvent.GuildSoundboardSoundCreate]: GatewayGuildSoundboardSoundCreateDispatchData & {
        guild?: Guild<true>;
    };
    [ListenerEvent.GuildSoundboardSoundDelete]: GatewayGuildSoundboardSoundDeleteDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.GuildSoundboardSoundUpdate]: GatewayGuildSoundboardSoundUpdateDispatchData & {
        guild?: Guild<true>;
    };
    [ListenerEvent.GuildSoundboardSoundsUpdate]: GatewayGuildSoundboardSoundsUpdateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.SoundboardSounds]: GatewayGuildSoundboardSoundsUpdateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.GuildStickersUpdate]: GatewayGuildStickersUpdateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.GuildUpdate]: GatewayGuildUpdateDispatchData & {
        guild: Guild;
    };
    [ListenerEvent.IntegrationCreate]: GatewayIntegrationCreateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.IntegrationDelete]: GatewayIntegrationDeleteDispatchData & {
        guild: Guild<true>;
        application?: User<true>;
    };
    [ListenerEvent.IntegrationUpdate]: GatewayIntegrationUpdateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.InteractionCreate]: GatewayInteractionCreateDispatchData;
    [ListenerEvent.InviteCreate]: Omit<GatewayInviteCreateDispatchData, "inviter" | "target_user"> & {
        guild?: Guild<true>;
        inviter?: User;
        targetUser?: User;
        rawInviter: GatewayInviteCreateDispatchData["inviter"];
        rawTargetUser: GatewayInviteCreateDispatchData["target_user"];
    };
    [ListenerEvent.InviteDelete]: GatewayInviteDeleteDispatchData & {
        guild?: Guild<true>;
        channel?: Promise<AnyChannel>;
    };
    [ListenerEvent.MessageCreate]: Omit<GatewayMessageCreateDispatchData, "member" | "author"> & {
        guild?: Guild<true>;
        member?: GuildMember<false, true>;
        author: User;
        message: Message;
        rawMessage: GatewayMessageCreateDispatchData;
        rawMember: GatewayMessageCreateDispatchData["member"];
        rawAuthor: GatewayMessageCreateDispatchData["author"];
    };
    [ListenerEvent.MessageDelete]: GatewayMessageDeleteDispatchData & {
        guild?: Guild<true>;
        message: Message<true>;
    };
    [ListenerEvent.MessageDeleteBulk]: GatewayMessageDeleteBulkDispatchData & {
        guild?: Guild<true>;
        messages: Message<true>[];
    };
    [ListenerEvent.MessagePollVoteAdd]: GatewayMessagePollVoteDispatchData & {
        guild?: Guild<true>;
        user: User<true>;
        message: Message<true>;
    };
    [ListenerEvent.MessagePollVoteRemove]: GatewayMessagePollVoteDispatchData & {
        guild?: Guild<true>;
        user: User<true>;
        message: Message<true>;
    };
    [ListenerEvent.MessageReactionAdd]: Omit<GatewayMessageReactionAddDispatchData, "member"> & {
        guild?: Guild<true>;
        member?: GuildMember;
        rawMember: GatewayMessageReactionAddDispatchData["member"];
        user: User<true>;
        message: Message<true>;
    };
    [ListenerEvent.MessageReactionRemove]: GatewayMessageReactionRemoveDispatchData & {
        guild?: Guild<true>;
        user: User<true>;
        message: Message<true>;
    };
    [ListenerEvent.MessageReactionRemoveAll]: GatewayMessageReactionRemoveAllDispatchData & {
        guild?: Guild<true>;
        message: Message<true>;
    };
    [ListenerEvent.MessageReactionRemoveEmoji]: GatewayMessageReactionRemoveEmojiDispatchData & {
        guild?: Guild<true>;
        message: Message<true>;
    };
    [ListenerEvent.MessageUpdate]: Omit<GatewayMessageUpdateDispatchData, "message"> & {
        guild?: Guild<true>;
        message: Message;
    };
    [ListenerEvent.PresenceUpdate]: GatewayPresenceUpdateDispatchData & {
        guild: Guild<true>;
        user: User<true>;
    };
    [ListenerEvent.RateLimited]: GatewayRateLimitedDispatchData;
    [ListenerEvent.Ready]: Omit<GatewayReadyDispatchData, "user"> & {
        user: User;
        rawUser: GatewayReadyDispatchData["user"];
    };
    [ListenerEvent.Resumed]: GatewayResumedDispatch["d"];
    [ListenerEvent.StageInstanceCreate]: GatewayStageInstanceCreateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.StageInstanceDelete]: GatewayStageInstanceDeleteDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.StageInstanceUpdate]: GatewayStageInstanceUpdateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.SubscriptionCreate]: GatewaySubscriptionCreateDispatchData & {
        user?: User<true>;
    };
    [ListenerEvent.SubscriptionDelete]: GatewaySubscriptionDeleteDispatchData & {
        user?: User<true>;
    };
    [ListenerEvent.SubscriptionUpdate]: GatewaySubscriptionUpdateDispatchData & {
        user?: User<true>;
    };
    [ListenerEvent.ThreadCreate]: Omit<GatewayThreadCreateDispatchData, "thread"> & {
        guild?: Guild<true>;
        thread: GuildThreadChannel<ThreadChannelType>;
    };
    [ListenerEvent.ThreadDelete]: GatewayThreadDeleteDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.ThreadListSync]: Omit<GatewayThreadListSyncDispatchData, "guild" | "threads"> & {
        guild: Guild<true>;
        threads: GuildThreadChannel<ThreadChannelType>[];
        members: ThreadMember[];
        rawMembers: GatewayThreadListSyncDispatchData["members"];
        rawThreads: GatewayThreadListSyncDispatchData["threads"];
    };
    [ListenerEvent.ThreadMemberUpdate]: GatewayThreadMemberUpdateDispatchData & {
        guild: Guild<true>;
        thread: GuildThreadChannel<ThreadChannelType, true>;
        member?: ThreadMember;
    };
    [ListenerEvent.ThreadMembersUpdate]: Omit<GatewayThreadMembersUpdateDispatchData, "thread"> & {
        guild: Guild<true>;
        thread: GuildThreadChannel<ThreadChannelType, true>;
        addedMembers?: ThreadMember[];
        removedMembers?: User<true>[];
    };
    [ListenerEvent.ThreadUpdate]: Omit<GatewayThreadUpdateDispatchData, "thread"> & {
        guild?: Guild<true>;
        thread: GuildThreadChannel<ThreadChannelType, true>;
    };
    [ListenerEvent.TypingStart]: Omit<GatewayTypingStartDispatchData, "member"> & {
        guild?: Guild<true>;
        member?: GuildMember<false, true>;
        user: User<true>;
        rawMember: GatewayTypingStartDispatchData["member"];
    };
    [ListenerEvent.UserUpdate]: GatewayUserUpdateDispatchData & {
        user: User;
    };
    [ListenerEvent.VoiceChannelEffectSend]: GatewayVoiceChannelEffectSendDispatchData & {
        guild: Guild<true>;
        user: User<true>;
    };
    [ListenerEvent.VoiceServerUpdate]: GatewayVoiceServerUpdateDispatchData & {
        guild: Guild<true>;
    };
    [ListenerEvent.VoiceStateUpdate]: Omit<GatewayVoiceStateUpdateDispatchData, "member"> & {
        guild?: Guild<true>;
        member?: GuildMember<false, true>;
        rawMember: GatewayVoiceStateUpdateDispatchData["member"];
    };
    [ListenerEvent.WebhooksUpdate]: GatewayWebhooksUpdateDispatchData & {
        guild: Guild<true>;
    };
};
//# sourceMappingURL=listeners.d.ts.map