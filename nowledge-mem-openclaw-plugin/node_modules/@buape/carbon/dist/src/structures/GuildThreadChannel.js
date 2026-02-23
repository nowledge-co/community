import { Routes } from "discord-api-types/v10";
import { BaseGuildChannel } from "../abstracts/BaseGuildChannel.js";
export class GuildThreadChannel extends BaseGuildChannel {
    /**
     * Whether the thread is archived.
     */
    get archived() {
        if (!this.rawData)
            return undefined;
        return this.rawData.thread_metadata?.archived;
    }
    /**
     * The duration until the thread is auto archived.
     */
    get autoArchiveDuration() {
        if (!this.rawData)
            return undefined;
        return this.rawData.thread_metadata?.auto_archive_duration;
    }
    /**
     * The timestamp of when the thread was archived.
     */
    get archiveTimestamp() {
        if (!this.rawData)
            return undefined;
        return this.rawData.thread_metadata?.archive_timestamp;
    }
    /**
     * Whether the thread is locked.
     */
    get locked() {
        if (!this.rawData)
            return undefined;
        return this.rawData.thread_metadata?.locked;
    }
    /**
     * Whether non-moderators can add other non-moderators to a thread; only available on private threads
     */
    get invitable() {
        if (!this.rawData)
            return undefined;
        return this.rawData.thread_metadata?.invitable;
    }
    /**
     * The timestamp of when the thread was created.
     */
    get createTimestamp() {
        if (!this.rawData)
            return undefined;
        return this.rawData.thread_metadata?.create_timestamp;
    }
    /**
     * The number of messages in the thread.
     */
    get messageCount() {
        if (!this.rawData)
            return undefined;
        return this.rawData.message_count;
    }
    /**
     * The number of members in the thread.
     *
     * @remarks
     * This is only accurate until 50, after that, Discord stops counting.
     */
    get memberCount() {
        if (!this.rawData)
            return undefined;
        return this.rawData.member_count;
    }
    /**
     * The ID of the owner of the thread.
     */
    get ownerId() {
        if (!this.rawData)
            return undefined;
        return this.rawData.owner_id;
    }
    /**
     * The number of messages sent in the thread.
     */
    get totalMessageSent() {
        if (!this.rawData)
            return undefined;
        return this.rawData.total_message_sent;
    }
    /**
     * The tags applied to the thread.
     */
    get appliedTags() {
        if (!this.rawData)
            return undefined;
        return this.rawData.applied_tags;
    }
    /**
     * Join the thread
     */
    async join() {
        await this.addMember("@me");
    }
    /**
     * Add a member to the thread
     */
    async addMember(userId) {
        await this.client.rest.put(Routes.threadMembers(this.id, userId));
    }
    /**
     * Leave the thread
     */
    async leave() {
        await this.removeMember("@me");
    }
    /**
     * Get the pinned messages in the thread
     */
    async removeMember(userId) {
        await this.client.rest.delete(Routes.threadMembers(this.id, userId));
    }
    /**
     * Archive the thread
     */
    async archive() {
        await this.client.rest.patch(Routes.channel(this.id), {
            body: { archive: true }
        });
        Reflect.set(this.rawData?.thread_metadata ?? {}, "archived", true);
    }
    /**
     * Unarchive the thread
     */
    async unarchive() {
        await this.client.rest.patch(Routes.channel(this.id), {
            body: { archive: false }
        });
        Reflect.set(this.rawData?.thread_metadata ?? {}, "archived", false);
    }
    /**
     * Set the auto archive duration of the thread
     */
    async setAutoArchiveDuration(duration) {
        await this.client.rest.patch(Routes.channel(this.id), {
            body: { auto_archive_duration: duration }
        });
        Reflect.set(this.rawData?.thread_metadata ?? {}, "auto_archive_duration", duration);
    }
    /**
     * Lock the thread
     */
    async lock() {
        await this.client.rest.put(Routes.channel(this.id), {
            body: { locked: true }
        });
        Reflect.set(this.rawData?.thread_metadata ?? {}, "locked", true);
    }
    /**
     * Unlock the thread
     */
    async unlock() {
        await this.client.rest.put(Routes.channel(this.id), {
            body: { locked: false }
        });
        Reflect.set(this.rawData?.thread_metadata ?? {}, "locked", false);
    }
}
//# sourceMappingURL=GuildThreadChannel.js.map