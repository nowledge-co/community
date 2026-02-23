import { type APIThreadChannel, type ThreadChannelType } from "discord-api-types/v10";
import { BaseGuildChannel } from "../abstracts/BaseGuildChannel.js";
import type { IfPartial } from "../types/index.js";
export declare class GuildThreadChannel<Type extends ThreadChannelType, IsPartial extends boolean = false> extends BaseGuildChannel<Type, IsPartial> {
    rawData: APIThreadChannel | null;
    /**
     * Whether the thread is archived.
     */
    get archived(): IfPartial<IsPartial, boolean | undefined>;
    /**
     * The duration until the thread is auto archived.
     */
    get autoArchiveDuration(): IfPartial<IsPartial, number | undefined>;
    /**
     * The timestamp of when the thread was archived.
     */
    get archiveTimestamp(): IfPartial<IsPartial, string | undefined>;
    /**
     * Whether the thread is locked.
     */
    get locked(): IfPartial<IsPartial, boolean | undefined>;
    /**
     * Whether non-moderators can add other non-moderators to a thread; only available on private threads
     */
    get invitable(): IfPartial<IsPartial, boolean | undefined>;
    /**
     * The timestamp of when the thread was created.
     */
    get createTimestamp(): IfPartial<IsPartial, string | undefined>;
    /**
     * The number of messages in the thread.
     */
    get messageCount(): IfPartial<IsPartial, number | undefined>;
    /**
     * The number of members in the thread.
     *
     * @remarks
     * This is only accurate until 50, after that, Discord stops counting.
     */
    get memberCount(): IfPartial<IsPartial, number | undefined>;
    /**
     * The ID of the owner of the thread.
     */
    get ownerId(): IfPartial<IsPartial, string | undefined>;
    /**
     * The number of messages sent in the thread.
     */
    get totalMessageSent(): IfPartial<IsPartial, number | undefined>;
    /**
     * The tags applied to the thread.
     */
    get appliedTags(): IfPartial<IsPartial, string[] | undefined>;
    /**
     * Join the thread
     */
    join(): Promise<void>;
    /**
     * Add a member to the thread
     */
    addMember(userId: string): Promise<void>;
    /**
     * Leave the thread
     */
    leave(): Promise<void>;
    /**
     * Get the pinned messages in the thread
     */
    removeMember(userId: string): Promise<void>;
    /**
     * Archive the thread
     */
    archive(): Promise<void>;
    /**
     * Unarchive the thread
     */
    unarchive(): Promise<void>;
    /**
     * Set the auto archive duration of the thread
     */
    setAutoArchiveDuration(duration: number): Promise<void>;
    /**
     * Lock the thread
     */
    lock(): Promise<void>;
    /**
     * Unlock the thread
     */
    unlock(): Promise<void>;
}
//# sourceMappingURL=GuildThreadChannel.d.ts.map