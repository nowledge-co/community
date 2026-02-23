import { ChannelType } from "discord-api-types/v10";
import { BaseListener } from "../abstracts/BaseListener.js";
import { channelFactory } from "../functions/channelFactory.js";
import { Guild } from "../structures/Guild.js";
import { GuildMember } from "../structures/GuildMember.js";
import { GuildThreadChannel } from "../structures/GuildThreadChannel.js";
import { Message } from "../structures/Message.js";
import { Role } from "../structures/Role.js";
import { ThreadMember } from "../structures/ThreadMember.js";
import { User } from "../structures/User.js";
import { ListenerEvent } from "../types/index.js";
export class GuildAvailableListener extends BaseListener {
    type = ListenerEvent.GuildAvailable;
}
export class GuildUnavailableListener extends BaseListener {
    type = ListenerEvent.GuildUnavailable;
}
export class ApplicationAuthorizedListener extends BaseListener {
    type = ListenerEvent.ApplicationAuthorized;
    parseRawData(data, client) {
        const guild = data.guild ? new Guild(client, data.guild) : undefined;
        const user = new User(client, data.user);
        const { guild: _, user: __, ...restData } = data;
        return {
            guild,
            user,
            rawGuild: data.guild,
            rawUser: data.user,
            ...restData
        };
    }
}
export class EntitlementCreateListener extends BaseListener {
    type = ListenerEvent.EntitlementCreate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const user = data.user_id ? new User(client, data.user_id) : undefined;
        return {
            guild,
            user,
            ...data
        };
    }
}
export class QuestUserEnrollmentListener extends BaseListener {
    type = ListenerEvent.QuestUserEnrollment;
    parseRawData(data) {
        return data;
    }
}
export class ApplicationCommandPermissionsUpdateListener extends BaseListener {
    type = ListenerEvent.ApplicationCommandPermissionsUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class AutoModerationActionExecutionListener extends BaseListener {
    type = ListenerEvent.AutoModerationActionExecution;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const user = new User(client, data.user_id);
        const message = data.message_id
            ? new Message(client, {
                id: data.message_id,
                channelId: data.channel_id
            })
            : undefined;
        return {
            guild,
            user,
            message,
            ...data
        };
    }
}
export class AutoModerationRuleCreateListener extends BaseListener {
    type = ListenerEvent.AutoModerationRuleCreate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const creator = new User(client, data.creator_id);
        return { guild, creator, ...data };
    }
}
export class AutoModerationRuleDeleteListener extends BaseListener {
    type = ListenerEvent.AutoModerationRuleDelete;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const creator = new User(client, data.creator_id);
        return { guild, creator, ...data };
    }
}
export class AutoModerationRuleUpdateListener extends BaseListener {
    type = ListenerEvent.AutoModerationRuleUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const creator = new User(client, data.creator_id);
        return { guild, creator, ...data };
    }
}
export class ChannelCreateListener extends BaseListener {
    type = ListenerEvent.ChannelCreate;
    parseRawData(data, client) {
        const rawChannel = data;
        // biome-ignore lint/style/noNonNullAssertion: channelFactory will always return a channel
        const channel = channelFactory(client, rawChannel);
        return {
            channel,
            rawChannel,
            ...data
        };
    }
}
export class ChannelDeleteListener extends BaseListener {
    type = ListenerEvent.ChannelDelete;
    parseRawData(data, client) {
        const rawChannel = data;
        // biome-ignore lint/style/noNonNullAssertion: channelFactory will always return a channel
        const channel = channelFactory(client, rawChannel);
        return {
            channel,
            rawChannel,
            ...data
        };
    }
}
export class ChannelPinsUpdateListener extends BaseListener {
    type = ListenerEvent.ChannelPinsUpdate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const channel = channelFactory(client, {
            id: data.channel_id,
            type: ChannelType.GuildText
        });
        return {
            guild,
            channel,
            ...data
        };
    }
}
export class ChannelUpdateListener extends BaseListener {
    type = ListenerEvent.ChannelUpdate;
    parseRawData(data, client) {
        const rawChannel = data;
        // biome-ignore lint/style/noNonNullAssertion: channelFactory will always return a channel
        const channel = channelFactory(client, rawChannel);
        return {
            rawChannel,
            channel,
            ...data
        };
    }
}
export class EntitlementDeleteListener extends BaseListener {
    type = ListenerEvent.EntitlementDelete;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const user = data.user_id ? new User(client, data.user_id) : undefined;
        return {
            guild,
            user,
            ...data
        };
    }
}
export class EntitlementUpdateListener extends BaseListener {
    type = ListenerEvent.EntitlementUpdate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const user = data.user_id ? new User(client, data.user_id) : undefined;
        return {
            guild,
            user,
            ...data
        };
    }
}
export class GuildAuditLogEntryCreateListener extends BaseListener {
    type = ListenerEvent.GuildAuditLogEntryCreate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const user = new User(client, data.user_id || "");
        const target = data.target_id
            ? new User(client, data.target_id)
            : undefined;
        return {
            guild,
            user,
            target,
            ...data
        };
    }
}
export class GuildBanAddListener extends BaseListener {
    type = ListenerEvent.GuildBanAdd;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const user = new User(client, data.user);
        return {
            ...data,
            guild,
            rawUser: data.user,
            user
        };
    }
}
export class GuildBanRemoveListener extends BaseListener {
    type = ListenerEvent.GuildBanRemove;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const user = new User(client, data.user);
        return {
            ...data,
            user,
            guild,
            rawUser: data.user
        };
    }
}
export class GuildCreateListener extends BaseListener {
    type = ListenerEvent.GuildCreate;
    parseRawData(data, client) {
        const guild = new Guild(client, data);
        return {
            guild,
            ...data
        };
    }
}
export class GuildDeleteListener extends BaseListener {
    type = ListenerEvent.GuildDelete;
    parseRawData(data, client) {
        const guild = new Guild(client, data.id);
        return {
            guild,
            ...data
        };
    }
}
export class GuildEmojisUpdateListener extends BaseListener {
    type = ListenerEvent.GuildEmojisUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class GuildIntegrationsUpdateListener extends BaseListener {
    type = ListenerEvent.GuildIntegrationsUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class GuildMemberAddListener extends BaseListener {
    type = ListenerEvent.GuildMemberAdd;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const member = new GuildMember(client, data, guild);
        return {
            guild,
            member,
            ...data
        };
    }
}
export class GuildMemberRemoveListener extends BaseListener {
    type = ListenerEvent.GuildMemberRemove;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const user = new User(client, data.user);
        return {
            ...data,
            guild,
            user,
            rawUser: data.user
        };
    }
}
export class GuildMemberUpdateListener extends BaseListener {
    type = ListenerEvent.GuildMemberUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const memberData = {
            ...data,
            joined_at: data.joined_at ?? new Date().toISOString(),
            deaf: false,
            mute: false,
            flags: data.flags ?? 0,
            user: {
                ...data.user,
                global_name: data.user.global_name ?? null
            }
        };
        const member = new GuildMember(client, memberData, guild);
        return {
            guild,
            member,
            rawMember: data,
            ...data
        };
    }
}
export class GuildMembersChunkListener extends BaseListener {
    type = ListenerEvent.GuildMembersChunk;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const guildMembers = data.members.map((member) => {
            return new GuildMember(client, member, guild);
        });
        return {
            ...data,
            guild,
            rawMembers: data.members,
            members: guildMembers
        };
    }
}
export class GuildRoleCreateListener extends BaseListener {
    type = ListenerEvent.GuildRoleCreate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const role = new Role(client, data.role, data.guild_id);
        return {
            ...data,
            guild,
            rawRole: data.role,
            role
        };
    }
}
export class GuildRoleDeleteListener extends BaseListener {
    type = ListenerEvent.GuildRoleDelete;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const role = new Role(client, data.role_id, data.guild_id);
        return {
            ...data,
            guild,
            role
        };
    }
}
export class GuildRoleUpdateListener extends BaseListener {
    type = ListenerEvent.GuildRoleUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const role = new Role(client, data.role, data.guild_id);
        return {
            ...data,
            guild,
            rawRole: data.role,
            role
        };
    }
}
export class GuildScheduledEventCreateListener extends BaseListener {
    type = ListenerEvent.GuildScheduledEventCreate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const creator = data.creator ? new User(client, data.creator) : undefined;
        return {
            ...data,
            guild,
            rawCreator: data.creator,
            creator
        };
    }
}
export class GuildScheduledEventDeleteListener extends BaseListener {
    type = ListenerEvent.GuildScheduledEventDelete;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class GuildScheduledEventUpdateListener extends BaseListener {
    type = ListenerEvent.GuildScheduledEventUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class GuildScheduledEventUserAddListener extends BaseListener {
    type = ListenerEvent.GuildScheduledEventUserAdd;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const user = new User(client, data.user_id);
        return {
            guild,
            user,
            ...data
        };
    }
}
export class GuildScheduledEventUserRemoveListener extends BaseListener {
    type = ListenerEvent.GuildScheduledEventUserRemove;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const user = new User(client, data.user_id);
        return {
            guild,
            user,
            ...data
        };
    }
}
export class GuildSoundboardSoundCreateListener extends BaseListener {
    type = ListenerEvent.GuildSoundboardSoundCreate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        return {
            ...data,
            guild
        };
    }
}
export class GuildSoundboardSoundDeleteListener extends BaseListener {
    type = ListenerEvent.GuildSoundboardSoundDelete;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class GuildSoundboardSoundUpdateListener extends BaseListener {
    type = ListenerEvent.GuildSoundboardSoundUpdate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        return {
            guild,
            ...data
        };
    }
}
export class GuildSoundboardSoundsUpdateListener extends BaseListener {
    type = ListenerEvent.GuildSoundboardSoundsUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class GuildStickersUpdateListener extends BaseListener {
    type = ListenerEvent.GuildStickersUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class GuildUpdateListener extends BaseListener {
    type = ListenerEvent.GuildUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data);
        return {
            guild,
            ...data
        };
    }
}
export class IntegrationCreateListener extends BaseListener {
    type = ListenerEvent.IntegrationCreate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const user = data.user ? new User(client, data.user) : undefined;
        return {
            guild,
            user,
            rawUser: data.user,
            ...data
        };
    }
}
export class IntegrationDeleteListener extends BaseListener {
    type = ListenerEvent.IntegrationDelete;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const application = data.application_id
            ? new User(client, data.application_id)
            : undefined;
        return {
            guild,
            application,
            ...data
        };
    }
}
export class IntegrationUpdateListener extends BaseListener {
    type = ListenerEvent.IntegrationUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class InteractionCreateListener extends BaseListener {
    type = ListenerEvent.InteractionCreate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const user = data.user ? new User(client, data.user) : undefined;
        return {
            guild,
            user,
            rawUser: data.user,
            ...data
        };
    }
}
export class InviteCreateListener extends BaseListener {
    type = ListenerEvent.InviteCreate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const inviter = data.inviter ? new User(client, data.inviter) : undefined;
        const targetUser = data.target_user
            ? new User(client, data.target_user)
            : undefined;
        return {
            guild,
            inviter,
            targetUser,
            rawInviter: data.inviter,
            rawTargetUser: data.target_user,
            ...data
        };
    }
}
export class InviteDeleteListener extends BaseListener {
    type = ListenerEvent.InviteDelete;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const channel = guild ? guild.fetchChannel(data.channel_id) : undefined;
        return {
            guild,
            channel,
            rawChannel: data.channel_id,
            ...data
        };
    }
}
export class MessageCreateListener extends BaseListener {
    type = ListenerEvent.MessageCreate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const member = guild && data.member
            ? new GuildMember(client, {
                ...data.member,
                user: data.author
            }, guild)
            : undefined;
        const author = new User(client, data.author);
        const message = new Message(client, data);
        return {
            ...data,
            guild,
            member,
            author,
            message,
            rawMessage: data,
            rawMember: data.member,
            rawAuthor: data.author
        };
    }
}
export class MessageDeleteListener extends BaseListener {
    type = ListenerEvent.MessageDelete;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const message = new Message(client, {
            id: data.id,
            channelId: data.channel_id
        });
        return {
            guild,
            message,
            ...data
        };
    }
}
export class MessageDeleteBulkListener extends BaseListener {
    type = ListenerEvent.MessageDeleteBulk;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const messages = data.ids.map((id) => new Message(client, {
            id,
            channelId: data.channel_id
        }));
        return {
            guild,
            messages,
            ...data
        };
    }
}
export class MessageReactionAddListener extends BaseListener {
    type = ListenerEvent.MessageReactionAdd;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const member = guild && data.member
            ? new GuildMember(client, data.member, guild)
            : undefined;
        const user = new User(client, data.user_id);
        const message = new Message(client, {
            id: data.message_id,
            channelId: data.channel_id
        });
        const { user_id, ...restData } = data;
        return {
            ...restData,
            guild,
            member,
            rawMember: data.member,
            user,
            message
        };
    }
}
export class MessageReactionRemoveListener extends BaseListener {
    type = ListenerEvent.MessageReactionRemove;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const user = new User(client, data.user_id);
        const message = new Message(client, {
            id: data.message_id,
            channelId: data.channel_id
        });
        const { user_id, ...restData } = data;
        return {
            ...restData,
            guild,
            user,
            message
        };
    }
}
export class MessageReactionRemoveAllListener extends BaseListener {
    type = ListenerEvent.MessageReactionRemoveAll;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const message = new Message(client, {
            id: data.message_id,
            channelId: data.channel_id
        });
        return {
            guild,
            message,
            ...data
        };
    }
}
export class MessageReactionRemoveEmojiListener extends BaseListener {
    type = ListenerEvent.MessageReactionRemoveEmoji;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const message = new Message(client, {
            id: data.message_id,
            channelId: data.channel_id
        });
        return {
            guild,
            message,
            ...data
        };
    }
}
export class MessageUpdateListener extends BaseListener {
    type = ListenerEvent.MessageUpdate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const message = new Message(client, data);
        return {
            guild,
            message,
            ...data
        };
    }
}
export class PresenceUpdateListener extends BaseListener {
    type = ListenerEvent.PresenceUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const user = new User(client, data.user.id);
        return {
            ...data,
            guild,
            user
        };
    }
}
export class ReadyListener extends BaseListener {
    type = ListenerEvent.Ready;
    parseRawData(data, client) {
        const user = new User(client, data.user);
        return {
            ...data,
            rawUser: data.user,
            user
        };
    }
}
export class ResumedListener extends BaseListener {
    type = ListenerEvent.Resumed;
    parseRawData(data) {
        return data;
    }
}
export class StageInstanceCreateListener extends BaseListener {
    type = ListenerEvent.StageInstanceCreate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class StageInstanceDeleteListener extends BaseListener {
    type = ListenerEvent.StageInstanceDelete;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class StageInstanceUpdateListener extends BaseListener {
    type = ListenerEvent.StageInstanceUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class SubscriptionCreateListener extends BaseListener {
    type = ListenerEvent.SubscriptionCreate;
    parseRawData(data, client) {
        const user = data.user_id ? new User(client, data.user_id) : undefined;
        return {
            ...data,
            user
        };
    }
}
export class SubscriptionDeleteListener extends BaseListener {
    type = ListenerEvent.SubscriptionDelete;
    parseRawData(data, client) {
        const user = data.user_id ? new User(client, data.user_id) : undefined;
        return {
            ...data,
            user
        };
    }
}
export class SubscriptionUpdateListener extends BaseListener {
    type = ListenerEvent.SubscriptionUpdate;
    parseRawData(data, client) {
        const user = data.user_id ? new User(client, data.user_id) : undefined;
        return {
            ...data,
            user
        };
    }
}
export class ThreadCreateListener extends BaseListener {
    type = ListenerEvent.ThreadCreate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const thread = new GuildThreadChannel(client, data);
        return {
            guild,
            thread,
            ...data
        };
    }
}
export class ThreadDeleteListener extends BaseListener {
    type = ListenerEvent.ThreadDelete;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class ThreadListSyncListener extends BaseListener {
    type = ListenerEvent.ThreadListSync;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const threads = data.threads.map((thread) => new GuildThreadChannel(client, thread));
        const members = data.members.map((member) => {
            return new ThreadMember(client, member, data.guild_id);
        });
        return {
            ...data,
            guild,
            threads,
            members,
            rawMembers: data.members,
            rawThreads: data.threads
        };
    }
}
export class ThreadMemberUpdateListener extends BaseListener {
    type = ListenerEvent.ThreadMemberUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        if (!data.id)
            throw new Error("Thread ID not provided in payload when docs specified it would be");
        const thread = new GuildThreadChannel(client, data.id);
        const member = data.member
            ? new ThreadMember(client, data, data.guild_id)
            : undefined;
        return {
            ...data,
            guild,
            thread,
            member
        };
    }
}
export class ThreadMembersUpdateListener extends BaseListener {
    type = ListenerEvent.ThreadMembersUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        if (!data.id)
            throw new Error("Thread ID not provided in payload when docs specified it would be");
        const thread = new GuildThreadChannel(client, data.id);
        const addedMembers = data.added_members?.map((member) => new ThreadMember(client, member, data.guild_id));
        const removedMembers = data.removed_member_ids?.map((id) => new User(client, id));
        return {
            guild,
            thread,
            addedMembers,
            removedMembers,
            ...data
        };
    }
}
export class ThreadUpdateListener extends BaseListener {
    type = ListenerEvent.ThreadUpdate;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        if (!data.id)
            throw new Error("Thread ID not provided in payload when docs specified it would be");
        const thread = new GuildThreadChannel(client, data.id);
        return {
            guild,
            thread,
            ...data
        };
    }
}
export class TypingStartListener extends BaseListener {
    type = ListenerEvent.TypingStart;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const member = guild && data.member
            ? new GuildMember(client, data.member, guild)
            : undefined;
        const user = new User(client, data.user_id);
        return {
            guild,
            member,
            user,
            rawMember: data.member,
            ...data
        };
    }
}
export class UserUpdateListener extends BaseListener {
    type = ListenerEvent.UserUpdate;
    parseRawData(data, client) {
        const user = new User(client, data);
        return {
            user,
            ...data
        };
    }
}
export class VoiceServerUpdateListener extends BaseListener {
    type = ListenerEvent.VoiceServerUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            guild,
            ...data
        };
    }
}
export class VoiceStateUpdateListener extends BaseListener {
    type = ListenerEvent.VoiceStateUpdate;
    parseRawData(data, client) {
        const guild = "guild_id" in data && typeof data.guild_id === "string"
            ? new Guild(client, data.guild_id)
            : undefined;
        const member = guild && data.member
            ? new GuildMember(client, data.member, guild)
            : undefined;
        return {
            ...data,
            rawMember: data.member,
            guild,
            member
        };
    }
}
export class WebhooksUpdateListener extends BaseListener {
    type = ListenerEvent.WebhooksUpdate;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        return {
            ...data,
            guild
        };
    }
}
export class MessagePollVoteAddListener extends BaseListener {
    type = ListenerEvent.MessagePollVoteAdd;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const user = new User(client, data.user_id);
        const message = new Message(client, {
            id: data.message_id,
            channelId: data.channel_id
        });
        return {
            guild,
            user,
            message,
            ...data
        };
    }
}
export class MessagePollVoteRemoveListener extends BaseListener {
    type = ListenerEvent.MessagePollVoteRemove;
    parseRawData(data, client) {
        const guild = data.guild_id
            ? new Guild(client, data.guild_id)
            : undefined;
        const user = new User(client, data.user_id);
        const message = new Message(client, {
            id: data.message_id,
            channelId: data.channel_id
        });
        return {
            guild,
            user,
            message,
            ...data
        };
    }
}
export class VoiceChannelEffectSendListener extends BaseListener {
    type = ListenerEvent.VoiceChannelEffectSend;
    parseRawData(data, client) {
        const guild = new Guild(client, data.guild_id);
        const user = new User(client, data.user_id);
        return {
            guild,
            user,
            ...data
        };
    }
}
//# sourceMappingURL=Listener.js.map