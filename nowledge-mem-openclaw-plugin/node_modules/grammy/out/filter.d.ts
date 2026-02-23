import { type Context } from "./context.js";
import { type Update } from "./types.js";
type FilterFunction<C extends Context, D extends C> = (ctx: C) => ctx is D;
/**
 * > This is an advanced function of grammY.
 *
 * Takes a filter query and turns it into a predicate function that can check in
 * constant time whether a given context object satisfies the query. The created
 * predicate can be passed to `bot.filter` and will narrow down the context
 * accordingly.
 *
 * This function is used internally by `bot.on` but exposed for advanced usage
 * like the following.
 * ```ts
 * // Listens for updates except forwards of messages or channel posts
 * bot.drop(matchFilter(':forward_origin'), ctx => { ... })
 * ```
 *
 * Check out the
 * [documentation](https://grammy.dev/ref/core/composer#on)
 * of `bot.on` for examples. In addition, the
 * [website](https://grammy.dev/guide/filter-queries) contains more
 * information about how filter queries work in grammY.
 *
 * @param filter A filter query or an array of filter queries
 */
export declare function matchFilter<C extends Context, Q extends FilterQuery>(filter: Q | Q[]): FilterFunction<C, Filter<C, Q>>;
export declare function parse(filter: FilterQuery | FilterQuery[]): string[][];
export declare function preprocess(filter: string[]): string[][];
declare const UPDATE_KEYS: {
    readonly message: {
        readonly direct_messages_topic: {};
        readonly chat_owner_left: {
            readonly new_owner: {};
        };
        readonly chat_owner_changd: {};
        readonly new_chat_members: {
            readonly me: {};
            readonly is_bot: {};
            readonly is_premium: {};
            readonly added_to_attachment_menu: {};
        };
        readonly left_chat_member: {
            readonly me: {};
            readonly is_bot: {};
            readonly is_premium: {};
            readonly added_to_attachment_menu: {};
        };
        readonly group_chat_created: {};
        readonly supergroup_chat_created: {};
        readonly migrate_to_chat_id: {};
        readonly migrate_from_chat_id: {};
        readonly successful_payment: {};
        readonly refunded_payment: {};
        readonly users_shared: {};
        readonly chat_shared: {};
        readonly connected_website: {};
        readonly write_access_allowed: {};
        readonly passport_data: {};
        readonly boost_added: {};
        readonly forum_topic_created: {
            readonly is_name_implicit: {};
        };
        readonly forum_topic_edited: {
            readonly name: {};
            readonly icon_custom_emoji_id: {};
        };
        readonly forum_topic_closed: {};
        readonly forum_topic_reopened: {};
        readonly general_forum_topic_hidden: {};
        readonly general_forum_topic_unhidden: {};
        readonly checklist: {
            readonly others_can_add_tasks: {};
            readonly others_can_mark_tasks_as_done: {};
        };
        readonly checklist_tasks_done: {};
        readonly checklist_tasks_added: {};
        readonly suggested_post_info: {};
        readonly suggested_post_approved: {};
        readonly suggested_post_approval_failed: {};
        readonly suggested_post_declined: {};
        readonly suggested_post_paid: {};
        readonly suggested_post_refunded: {};
        readonly sender_boost_count: {};
        readonly forward_origin: {
            readonly user: {};
            readonly hidden_user: {};
            readonly chat: {};
            readonly channel: {};
        };
        readonly is_topic_message: {};
        readonly is_automatic_forward: {};
        readonly business_connection_id: {};
        readonly text: {};
        readonly animation: {};
        readonly audio: {};
        readonly document: {};
        readonly paid_media: {};
        readonly photo: {};
        readonly sticker: {
            readonly is_video: {};
            readonly is_animated: {};
            readonly premium_animation: {};
        };
        readonly story: {};
        readonly video: {};
        readonly video_note: {};
        readonly voice: {};
        readonly contact: {};
        readonly dice: {};
        readonly game: {};
        readonly poll: {};
        readonly venue: {};
        readonly location: {};
        readonly entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption_entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption: {};
        readonly link_preview_options: {
            readonly url: {};
            readonly prefer_small_media: {};
            readonly prefer_large_media: {};
            readonly show_above_text: {};
        };
        readonly effect_id: {};
        readonly paid_star_count: {};
        readonly has_media_spoiler: {};
        readonly new_chat_title: {};
        readonly new_chat_photo: {};
        readonly delete_chat_photo: {};
        readonly message_auto_delete_timer_changed: {};
        readonly pinned_message: {};
        readonly invoice: {};
        readonly proximity_alert_triggered: {};
        readonly chat_background_set: {};
        readonly giveaway_created: {};
        readonly giveaway: {
            readonly only_new_members: {};
            readonly has_public_winners: {};
        };
        readonly giveaway_winners: {
            readonly only_new_members: {};
            readonly was_refunded: {};
        };
        readonly giveaway_completed: {};
        readonly gift: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly gift_upgrade_sent: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly unique_gift: {
            readonly transfer_star_count: {};
        };
        readonly paid_message_price_changed: {};
        readonly video_chat_scheduled: {};
        readonly video_chat_started: {};
        readonly video_chat_ended: {};
        readonly video_chat_participants_invited: {};
        readonly web_app_data: {};
    };
    readonly edited_message: {
        readonly direct_messages_topic: {};
        readonly chat_owner_left: {
            readonly new_owner: {};
        };
        readonly chat_owner_changd: {};
        readonly new_chat_members: {
            readonly me: {};
            readonly is_bot: {};
            readonly is_premium: {};
            readonly added_to_attachment_menu: {};
        };
        readonly left_chat_member: {
            readonly me: {};
            readonly is_bot: {};
            readonly is_premium: {};
            readonly added_to_attachment_menu: {};
        };
        readonly group_chat_created: {};
        readonly supergroup_chat_created: {};
        readonly migrate_to_chat_id: {};
        readonly migrate_from_chat_id: {};
        readonly successful_payment: {};
        readonly refunded_payment: {};
        readonly users_shared: {};
        readonly chat_shared: {};
        readonly connected_website: {};
        readonly write_access_allowed: {};
        readonly passport_data: {};
        readonly boost_added: {};
        readonly forum_topic_created: {
            readonly is_name_implicit: {};
        };
        readonly forum_topic_edited: {
            readonly name: {};
            readonly icon_custom_emoji_id: {};
        };
        readonly forum_topic_closed: {};
        readonly forum_topic_reopened: {};
        readonly general_forum_topic_hidden: {};
        readonly general_forum_topic_unhidden: {};
        readonly checklist: {
            readonly others_can_add_tasks: {};
            readonly others_can_mark_tasks_as_done: {};
        };
        readonly checklist_tasks_done: {};
        readonly checklist_tasks_added: {};
        readonly suggested_post_info: {};
        readonly suggested_post_approved: {};
        readonly suggested_post_approval_failed: {};
        readonly suggested_post_declined: {};
        readonly suggested_post_paid: {};
        readonly suggested_post_refunded: {};
        readonly sender_boost_count: {};
        readonly forward_origin: {
            readonly user: {};
            readonly hidden_user: {};
            readonly chat: {};
            readonly channel: {};
        };
        readonly is_topic_message: {};
        readonly is_automatic_forward: {};
        readonly business_connection_id: {};
        readonly text: {};
        readonly animation: {};
        readonly audio: {};
        readonly document: {};
        readonly paid_media: {};
        readonly photo: {};
        readonly sticker: {
            readonly is_video: {};
            readonly is_animated: {};
            readonly premium_animation: {};
        };
        readonly story: {};
        readonly video: {};
        readonly video_note: {};
        readonly voice: {};
        readonly contact: {};
        readonly dice: {};
        readonly game: {};
        readonly poll: {};
        readonly venue: {};
        readonly location: {};
        readonly entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption_entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption: {};
        readonly link_preview_options: {
            readonly url: {};
            readonly prefer_small_media: {};
            readonly prefer_large_media: {};
            readonly show_above_text: {};
        };
        readonly effect_id: {};
        readonly paid_star_count: {};
        readonly has_media_spoiler: {};
        readonly new_chat_title: {};
        readonly new_chat_photo: {};
        readonly delete_chat_photo: {};
        readonly message_auto_delete_timer_changed: {};
        readonly pinned_message: {};
        readonly invoice: {};
        readonly proximity_alert_triggered: {};
        readonly chat_background_set: {};
        readonly giveaway_created: {};
        readonly giveaway: {
            readonly only_new_members: {};
            readonly has_public_winners: {};
        };
        readonly giveaway_winners: {
            readonly only_new_members: {};
            readonly was_refunded: {};
        };
        readonly giveaway_completed: {};
        readonly gift: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly gift_upgrade_sent: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly unique_gift: {
            readonly transfer_star_count: {};
        };
        readonly paid_message_price_changed: {};
        readonly video_chat_scheduled: {};
        readonly video_chat_started: {};
        readonly video_chat_ended: {};
        readonly video_chat_participants_invited: {};
        readonly web_app_data: {};
    };
    readonly channel_post: {
        readonly channel_chat_created: {};
        readonly direct_message_price_changed: {};
        readonly is_paid_post: {};
        readonly forward_origin: {
            readonly user: {};
            readonly hidden_user: {};
            readonly chat: {};
            readonly channel: {};
        };
        readonly is_topic_message: {};
        readonly is_automatic_forward: {};
        readonly business_connection_id: {};
        readonly text: {};
        readonly animation: {};
        readonly audio: {};
        readonly document: {};
        readonly paid_media: {};
        readonly photo: {};
        readonly sticker: {
            readonly is_video: {};
            readonly is_animated: {};
            readonly premium_animation: {};
        };
        readonly story: {};
        readonly video: {};
        readonly video_note: {};
        readonly voice: {};
        readonly contact: {};
        readonly dice: {};
        readonly game: {};
        readonly poll: {};
        readonly venue: {};
        readonly location: {};
        readonly entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption_entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption: {};
        readonly link_preview_options: {
            readonly url: {};
            readonly prefer_small_media: {};
            readonly prefer_large_media: {};
            readonly show_above_text: {};
        };
        readonly effect_id: {};
        readonly paid_star_count: {};
        readonly has_media_spoiler: {};
        readonly new_chat_title: {};
        readonly new_chat_photo: {};
        readonly delete_chat_photo: {};
        readonly message_auto_delete_timer_changed: {};
        readonly pinned_message: {};
        readonly invoice: {};
        readonly proximity_alert_triggered: {};
        readonly chat_background_set: {};
        readonly giveaway_created: {};
        readonly giveaway: {
            readonly only_new_members: {};
            readonly has_public_winners: {};
        };
        readonly giveaway_winners: {
            readonly only_new_members: {};
            readonly was_refunded: {};
        };
        readonly giveaway_completed: {};
        readonly gift: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly gift_upgrade_sent: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly unique_gift: {
            readonly transfer_star_count: {};
        };
        readonly paid_message_price_changed: {};
        readonly video_chat_scheduled: {};
        readonly video_chat_started: {};
        readonly video_chat_ended: {};
        readonly video_chat_participants_invited: {};
        readonly web_app_data: {};
    };
    readonly edited_channel_post: {
        readonly channel_chat_created: {};
        readonly direct_message_price_changed: {};
        readonly is_paid_post: {};
        readonly forward_origin: {
            readonly user: {};
            readonly hidden_user: {};
            readonly chat: {};
            readonly channel: {};
        };
        readonly is_topic_message: {};
        readonly is_automatic_forward: {};
        readonly business_connection_id: {};
        readonly text: {};
        readonly animation: {};
        readonly audio: {};
        readonly document: {};
        readonly paid_media: {};
        readonly photo: {};
        readonly sticker: {
            readonly is_video: {};
            readonly is_animated: {};
            readonly premium_animation: {};
        };
        readonly story: {};
        readonly video: {};
        readonly video_note: {};
        readonly voice: {};
        readonly contact: {};
        readonly dice: {};
        readonly game: {};
        readonly poll: {};
        readonly venue: {};
        readonly location: {};
        readonly entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption_entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption: {};
        readonly link_preview_options: {
            readonly url: {};
            readonly prefer_small_media: {};
            readonly prefer_large_media: {};
            readonly show_above_text: {};
        };
        readonly effect_id: {};
        readonly paid_star_count: {};
        readonly has_media_spoiler: {};
        readonly new_chat_title: {};
        readonly new_chat_photo: {};
        readonly delete_chat_photo: {};
        readonly message_auto_delete_timer_changed: {};
        readonly pinned_message: {};
        readonly invoice: {};
        readonly proximity_alert_triggered: {};
        readonly chat_background_set: {};
        readonly giveaway_created: {};
        readonly giveaway: {
            readonly only_new_members: {};
            readonly has_public_winners: {};
        };
        readonly giveaway_winners: {
            readonly only_new_members: {};
            readonly was_refunded: {};
        };
        readonly giveaway_completed: {};
        readonly gift: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly gift_upgrade_sent: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly unique_gift: {
            readonly transfer_star_count: {};
        };
        readonly paid_message_price_changed: {};
        readonly video_chat_scheduled: {};
        readonly video_chat_started: {};
        readonly video_chat_ended: {};
        readonly video_chat_participants_invited: {};
        readonly web_app_data: {};
    };
    readonly business_connection: {
        readonly can_reply: {};
        readonly is_enabled: {};
    };
    readonly business_message: {
        readonly direct_messages_topic: {};
        readonly chat_owner_left: {
            readonly new_owner: {};
        };
        readonly chat_owner_changd: {};
        readonly new_chat_members: {
            readonly me: {};
            readonly is_bot: {};
            readonly is_premium: {};
            readonly added_to_attachment_menu: {};
        };
        readonly left_chat_member: {
            readonly me: {};
            readonly is_bot: {};
            readonly is_premium: {};
            readonly added_to_attachment_menu: {};
        };
        readonly group_chat_created: {};
        readonly supergroup_chat_created: {};
        readonly migrate_to_chat_id: {};
        readonly migrate_from_chat_id: {};
        readonly successful_payment: {};
        readonly refunded_payment: {};
        readonly users_shared: {};
        readonly chat_shared: {};
        readonly connected_website: {};
        readonly write_access_allowed: {};
        readonly passport_data: {};
        readonly boost_added: {};
        readonly forum_topic_created: {
            readonly is_name_implicit: {};
        };
        readonly forum_topic_edited: {
            readonly name: {};
            readonly icon_custom_emoji_id: {};
        };
        readonly forum_topic_closed: {};
        readonly forum_topic_reopened: {};
        readonly general_forum_topic_hidden: {};
        readonly general_forum_topic_unhidden: {};
        readonly checklist: {
            readonly others_can_add_tasks: {};
            readonly others_can_mark_tasks_as_done: {};
        };
        readonly checklist_tasks_done: {};
        readonly checklist_tasks_added: {};
        readonly suggested_post_info: {};
        readonly suggested_post_approved: {};
        readonly suggested_post_approval_failed: {};
        readonly suggested_post_declined: {};
        readonly suggested_post_paid: {};
        readonly suggested_post_refunded: {};
        readonly sender_boost_count: {};
        readonly forward_origin: {
            readonly user: {};
            readonly hidden_user: {};
            readonly chat: {};
            readonly channel: {};
        };
        readonly is_topic_message: {};
        readonly is_automatic_forward: {};
        readonly business_connection_id: {};
        readonly text: {};
        readonly animation: {};
        readonly audio: {};
        readonly document: {};
        readonly paid_media: {};
        readonly photo: {};
        readonly sticker: {
            readonly is_video: {};
            readonly is_animated: {};
            readonly premium_animation: {};
        };
        readonly story: {};
        readonly video: {};
        readonly video_note: {};
        readonly voice: {};
        readonly contact: {};
        readonly dice: {};
        readonly game: {};
        readonly poll: {};
        readonly venue: {};
        readonly location: {};
        readonly entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption_entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption: {};
        readonly link_preview_options: {
            readonly url: {};
            readonly prefer_small_media: {};
            readonly prefer_large_media: {};
            readonly show_above_text: {};
        };
        readonly effect_id: {};
        readonly paid_star_count: {};
        readonly has_media_spoiler: {};
        readonly new_chat_title: {};
        readonly new_chat_photo: {};
        readonly delete_chat_photo: {};
        readonly message_auto_delete_timer_changed: {};
        readonly pinned_message: {};
        readonly invoice: {};
        readonly proximity_alert_triggered: {};
        readonly chat_background_set: {};
        readonly giveaway_created: {};
        readonly giveaway: {
            readonly only_new_members: {};
            readonly has_public_winners: {};
        };
        readonly giveaway_winners: {
            readonly only_new_members: {};
            readonly was_refunded: {};
        };
        readonly giveaway_completed: {};
        readonly gift: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly gift_upgrade_sent: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly unique_gift: {
            readonly transfer_star_count: {};
        };
        readonly paid_message_price_changed: {};
        readonly video_chat_scheduled: {};
        readonly video_chat_started: {};
        readonly video_chat_ended: {};
        readonly video_chat_participants_invited: {};
        readonly web_app_data: {};
    };
    readonly edited_business_message: {
        readonly direct_messages_topic: {};
        readonly chat_owner_left: {
            readonly new_owner: {};
        };
        readonly chat_owner_changd: {};
        readonly new_chat_members: {
            readonly me: {};
            readonly is_bot: {};
            readonly is_premium: {};
            readonly added_to_attachment_menu: {};
        };
        readonly left_chat_member: {
            readonly me: {};
            readonly is_bot: {};
            readonly is_premium: {};
            readonly added_to_attachment_menu: {};
        };
        readonly group_chat_created: {};
        readonly supergroup_chat_created: {};
        readonly migrate_to_chat_id: {};
        readonly migrate_from_chat_id: {};
        readonly successful_payment: {};
        readonly refunded_payment: {};
        readonly users_shared: {};
        readonly chat_shared: {};
        readonly connected_website: {};
        readonly write_access_allowed: {};
        readonly passport_data: {};
        readonly boost_added: {};
        readonly forum_topic_created: {
            readonly is_name_implicit: {};
        };
        readonly forum_topic_edited: {
            readonly name: {};
            readonly icon_custom_emoji_id: {};
        };
        readonly forum_topic_closed: {};
        readonly forum_topic_reopened: {};
        readonly general_forum_topic_hidden: {};
        readonly general_forum_topic_unhidden: {};
        readonly checklist: {
            readonly others_can_add_tasks: {};
            readonly others_can_mark_tasks_as_done: {};
        };
        readonly checklist_tasks_done: {};
        readonly checklist_tasks_added: {};
        readonly suggested_post_info: {};
        readonly suggested_post_approved: {};
        readonly suggested_post_approval_failed: {};
        readonly suggested_post_declined: {};
        readonly suggested_post_paid: {};
        readonly suggested_post_refunded: {};
        readonly sender_boost_count: {};
        readonly forward_origin: {
            readonly user: {};
            readonly hidden_user: {};
            readonly chat: {};
            readonly channel: {};
        };
        readonly is_topic_message: {};
        readonly is_automatic_forward: {};
        readonly business_connection_id: {};
        readonly text: {};
        readonly animation: {};
        readonly audio: {};
        readonly document: {};
        readonly paid_media: {};
        readonly photo: {};
        readonly sticker: {
            readonly is_video: {};
            readonly is_animated: {};
            readonly premium_animation: {};
        };
        readonly story: {};
        readonly video: {};
        readonly video_note: {};
        readonly voice: {};
        readonly contact: {};
        readonly dice: {};
        readonly game: {};
        readonly poll: {};
        readonly venue: {};
        readonly location: {};
        readonly entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption_entities: {
            readonly mention: {};
            readonly hashtag: {};
            readonly cashtag: {};
            readonly bot_command: {};
            readonly url: {};
            readonly email: {};
            readonly phone_number: {};
            readonly bold: {};
            readonly italic: {};
            readonly underline: {};
            readonly strikethrough: {};
            readonly spoiler: {};
            readonly blockquote: {};
            readonly expandable_blockquote: {};
            readonly code: {};
            readonly pre: {};
            readonly text_link: {};
            readonly text_mention: {};
            readonly custom_emoji: {};
        };
        readonly caption: {};
        readonly link_preview_options: {
            readonly url: {};
            readonly prefer_small_media: {};
            readonly prefer_large_media: {};
            readonly show_above_text: {};
        };
        readonly effect_id: {};
        readonly paid_star_count: {};
        readonly has_media_spoiler: {};
        readonly new_chat_title: {};
        readonly new_chat_photo: {};
        readonly delete_chat_photo: {};
        readonly message_auto_delete_timer_changed: {};
        readonly pinned_message: {};
        readonly invoice: {};
        readonly proximity_alert_triggered: {};
        readonly chat_background_set: {};
        readonly giveaway_created: {};
        readonly giveaway: {
            readonly only_new_members: {};
            readonly has_public_winners: {};
        };
        readonly giveaway_winners: {
            readonly only_new_members: {};
            readonly was_refunded: {};
        };
        readonly giveaway_completed: {};
        readonly gift: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly gift_upgrade_sent: {
            can_be_upgraded: {};
            is_upgrade_separate: {};
            is_private: {};
        };
        readonly unique_gift: {
            readonly transfer_star_count: {};
        };
        readonly paid_message_price_changed: {};
        readonly video_chat_scheduled: {};
        readonly video_chat_started: {};
        readonly video_chat_ended: {};
        readonly video_chat_participants_invited: {};
        readonly web_app_data: {};
    };
    readonly deleted_business_messages: {};
    readonly inline_query: {};
    readonly chosen_inline_result: {};
    readonly callback_query: {
        readonly data: {};
        readonly game_short_name: {};
    };
    readonly shipping_query: {};
    readonly pre_checkout_query: {};
    readonly poll: {};
    readonly poll_answer: {};
    readonly my_chat_member: {
        readonly from: {
            readonly me: {};
            readonly is_bot: {};
            readonly is_premium: {};
            readonly added_to_attachment_menu: {};
        };
    };
    readonly chat_member: {
        readonly from: {
            readonly me: {};
            readonly is_bot: {};
            readonly is_premium: {};
            readonly added_to_attachment_menu: {};
        };
    };
    readonly chat_join_request: {};
    readonly message_reaction: {
        readonly old_reaction: {
            readonly emoji: {};
            readonly custom_emoji: {};
            readonly paid: {};
        };
        readonly new_reaction: {
            readonly emoji: {};
            readonly custom_emoji: {};
            readonly paid: {};
        };
    };
    readonly message_reaction_count: {
        readonly reactions: {
            readonly emoji: {};
            readonly custom_emoji: {};
            readonly paid: {};
        };
    };
    readonly chat_boost: {};
    readonly removed_chat_boost: {};
    readonly purchased_paid_media: {};
};
type KeyOf<T> = string & keyof T;
type S = typeof UPDATE_KEYS;
type L1S = KeyOf<S>;
type L2S<L1 extends L1S = L1S> = L1 extends unknown ? `${L1}:${KeyOf<S[L1]>}` : never;
type L3S<L1 extends L1S = L1S> = L1 extends unknown ? L3S_<L1> : never;
type L3S_<L1 extends L1S, L2 extends KeyOf<S[L1]> = KeyOf<S[L1]>> = L2 extends unknown ? `${L1}:${L2}:${KeyOf<S[L1][L2]>}` : never;
type L123 = L1S | L2S | L3S;
type InjectShortcuts<Q extends L123 = L123> = Q extends `${infer L1}:${infer L2}:${infer L3}` ? `${CollapseL1<L1, L1Shortcuts>}:${CollapseL2<L2, L2Shortcuts>}:${L3}` : Q extends `${infer L1}:${infer L2}` ? `${CollapseL1<L1, L1Shortcuts>}:${CollapseL2<L2>}` : CollapseL1<Q>;
type CollapseL1<Q extends string, L extends L1Shortcuts = Exclude<L1Shortcuts, "">> = Q | (L extends string ? Q extends typeof L1_SHORTCUTS[L][number] ? L : never : never);
type CollapseL2<Q extends string, L extends L2Shortcuts = Exclude<L2Shortcuts, "">> = Q | (L extends string ? Q extends typeof L2_SHORTCUTS[L][number] ? L : never : never);
type ComputeFilterQueryList = InjectShortcuts;
/**
 * Represents a filter query that can be passed to `bot.on`. There are three
 * different kinds of filter queries: Level 1, Level 2, and Level 3. Check out
 * the [website](https://grammy.dev/guide/filter-queries) to read about how
 * filter queries work in grammY, and how to use them.
 *
 * Here are three brief examples:
 * ```ts
 * // Listen for messages of any type (Level 1)
 * bot.on('message', ctx => { ... })
 * // Listen for audio messages only (Level 2)
 * bot.on('message:audio', ctx => { ... })
 * // Listen for text messages that have a URL entity (Level 3)
 * bot.on('message:entities:url', ctx => { ... })
 * ```
 */
export type FilterQuery = ComputeFilterQueryList;
/**
 * Any kind of value that appears in the Telegram Bot API. When intersected with
 * an optional field, it effectively removes `| undefined`.
 */
type NotUndefined = {};
/**
 * Given a FilterQuery, returns an object that, when intersected with an Update,
 * marks those properties as required that are guaranteed to exist.
 */
type RunQuery<Q extends string> = L1Discriminator<Q, L1Parts<Q>>;
type L1Parts<Q extends string> = Q extends `${infer L1}:${string}` ? L1 : Q;
type L2Parts<Q extends string, L1 extends string> = Q extends `${L1}:${infer L2}:${string}` ? L2 : Q extends `${L1}:${infer L2}` ? L2 : never;
type L1Discriminator<Q extends string, L1 extends string> = Combine<L1Fragment<Q, L1>, L1>;
type L1Fragment<Q extends string, L1 extends string> = L1 extends unknown ? Record<L1, L2Discriminator<L1, L2Parts<Q, L1>>> : never;
type L2Discriminator<L1 extends string, L2 extends string> = [L2] extends [
    never
] ? L2ShallowFragment<L1> : Combine<L2Fragment<L1, L2>, L2>;
type L2Fragment<L1 extends string, L2 extends string> = L2 extends unknown ? Record<L2 | AddTwins<L1, L2>, NotUndefined> : never;
type L2ShallowFragment<L1 extends string> = Record<AddTwins<L1, never>, NotUndefined>;
type Combine<U, K extends string> = U extends unknown ? U & Partial<Record<Exclude<K, keyof U>, undefined>> : never;
/**
 * This type infers which properties will be present on the given context object
 * provided it matches the given filter query. If the filter query is a union
 * type, the produced context object will be a union of possible combinations,
 * hence allowing you to narrow down manually which of the properties are
 * present.
 *
 * In some sense, this type computes `matchFilter` on the type level.
 */
export type Filter<C extends Context, Q extends FilterQuery> = PerformQuery<C, RunQuery<ExpandShortcuts<Q>>>;
export type FilterCore<Q extends FilterQuery> = PerformQueryCore<RunQuery<ExpandShortcuts<Q>>>;
type PerformQuery<C extends Context, U extends object> = U extends unknown ? FilteredContext<C, Update & U> : never;
type PerformQueryCore<U extends object> = U extends unknown ? FilteredContextCore<Update & U> : never;
type FilteredContext<C extends Context, U extends Update> = C & FilteredContextCore<U>;
type FilteredContextCore<U extends Update> = Record<"update", U> & Shortcuts<U>;
interface Shortcuts<U extends Update> {
    message: [U["message"]] extends [object] ? U["message"] : undefined;
    editedMessage: [U["edited_message"]] extends [object] ? U["edited_message"] : undefined;
    channelPost: [U["channel_post"]] extends [object] ? U["channel_post"] : undefined;
    editedChannelPost: [U["edited_channel_post"]] extends [object] ? U["edited_channel_post"] : undefined;
    businessConnection: [U["business_connection"]] extends [object] ? U["business_connection"] : undefined;
    businessMessage: [U["business_message"]] extends [object] ? U["business_message"] : undefined;
    editedBusinessMessage: [U["edited_business_message"]] extends [object] ? U["edited_business_message"] : undefined;
    deletedBusinessMessages: [U["deleted_business_messages"]] extends [object] ? U["deleted_business_messages"] : undefined;
    messageReaction: [U["message_reaction"]] extends [object] ? U["message_reaction"] : undefined;
    messageReactionCount: [U["message_reaction_count"]] extends [object] ? U["message_reaction_count"] : undefined;
    inlineQuery: [U["inline_query"]] extends [object] ? U["inline_query"] : undefined;
    chosenInlineResult: [U["chosen_inline_result"]] extends [object] ? U["chosen_inline_result"] : undefined;
    callbackQuery: [U["callback_query"]] extends [object] ? U["callback_query"] : undefined;
    shippingQuery: [U["shipping_query"]] extends [object] ? U["shipping_query"] : undefined;
    preCheckoutQuery: [U["pre_checkout_query"]] extends [object] ? U["pre_checkout_query"] : undefined;
    poll: [U["poll"]] extends [object] ? U["poll"] : undefined;
    pollAnswer: [U["poll_answer"]] extends [object] ? U["poll_answer"] : undefined;
    myChatMember: [U["my_chat_member"]] extends [object] ? U["my_chat_member"] : undefined;
    chatMember: [U["chat_member"]] extends [object] ? U["chat_member"] : undefined;
    chatJoinRequest: [U["chat_join_request"]] extends [object] ? U["chat_join_request"] : undefined;
    chatBoost: [U["chat_boost"]] extends [object] ? U["chat_boost"] : undefined;
    removedChatBoost: [U["removed_chat_boost"]] extends [object] ? U["removed_chat_boost"] : undefined;
    purchasedPaidMedia: [U["purchased_paid_media"]] extends [object] ? U["purchased_paid_media"] : undefined;
    msg: [U["message"]] extends [object] ? U["message"] : [U["edited_message"]] extends [object] ? U["edited_message"] : [U["channel_post"]] extends [object] ? U["channel_post"] : [U["edited_channel_post"]] extends [object] ? U["edited_channel_post"] : [U["business_message"]] extends [object] ? U["business_message"] : [U["edited_business_message"]] extends [object] ? U["edited_business_message"] : [U["callback_query"]] extends [object] ? U["callback_query"]["message"] : undefined;
    chat: [U["callback_query"]] extends [object] ? NonNullable<U["callback_query"]["message"]>["chat"] | undefined : [Shortcuts<U>["msg"]] extends [object] ? Shortcuts<U>["msg"]["chat"] : [U["deleted_business_messages"]] extends [object] ? U["deleted_business_messages"]["chat"] : [U["message_reaction"]] extends [object] ? U["message_reaction"]["chat"] : [U["message_reaction_count"]] extends [object] ? U["message_reaction_count"]["chat"] : [U["my_chat_member"]] extends [object] ? U["my_chat_member"]["chat"] : [U["chat_member"]] extends [object] ? U["chat_member"]["chat"] : [U["chat_join_request"]] extends [object] ? U["chat_join_request"]["chat"] : [U["chat_boost"]] extends [object] ? U["chat_boost"]["chat"] : [U["removed_chat_boost"]] extends [object] ? U["removed_chat_boost"]["chat"] : undefined;
    senderChat: [Shortcuts<U>["msg"]] extends [object] ? Shortcuts<U>["msg"]["sender_chat"] : undefined;
    from: [U["business_connection"]] extends [object] ? U["business_connection"]["user"] : [U["message_reaction"]] extends [object] ? U["message_reaction"]["user"] : [U["chat_boost"]] extends [object] ? U["chat_boost"]["boost"]["source"]["user"] : [U["removed_chat_boost"]] extends [object] ? U["removed_chat_boost"]["source"]["user"] : [U["callback_query"]] extends [object] ? U["callback_query"]["from"] : [Shortcuts<U>["msg"]] extends [object] ? Shortcuts<U>["msg"]["from"] : [U["inline_query"]] extends [object] ? U["inline_query"]["from"] : [U["chosen_inline_result"]] extends [object] ? U["chosen_inline_result"]["from"] : [U["shipping_query"]] extends [object] ? U["shipping_query"]["from"] : [U["pre_checkout_query"]] extends [object] ? U["pre_checkout_query"]["from"] : [U["my_chat_member"]] extends [object] ? U["my_chat_member"]["from"] : [U["chat_member"]] extends [object] ? U["chat_member"]["from"] : [U["chat_join_request"]] extends [object] ? U["chat_join_request"]["from"] : undefined;
    msgId: [U["callback_query"]] extends [object] ? number | undefined : [Shortcuts<U>["msg"]] extends [object] ? number : [U["message_reaction"]] extends [object] ? number : [U["message_reaction_count"]] extends [object] ? number : undefined;
    chatId: [U["callback_query"]] extends [object] ? number | undefined : [Shortcuts<U>["chat"]] extends [object] ? number : [U["business_connection"]] extends [object] ? number : undefined;
    businessConnectionId: [U["callback_query"]] extends [object] ? string | undefined : [Shortcuts<U>["msg"]] extends [object] ? string | undefined : [U["business_connection"]] extends [object] ? string : [U["deleted_business_messages"]] extends [object] ? string : undefined;
}
declare const L1_SHORTCUTS: {
    readonly "": readonly ["message", "channel_post"];
    readonly msg: readonly ["message", "channel_post"];
    readonly edit: readonly ["edited_message", "edited_channel_post"];
};
declare const L2_SHORTCUTS: {
    readonly "": readonly ["entities", "caption_entities"];
    readonly media: readonly ["photo", "video"];
    readonly file: readonly ["photo", "animation", "audio", "document", "video", "video_note", "voice", "sticker"];
};
type L1Shortcuts = KeyOf<typeof L1_SHORTCUTS>;
type L2Shortcuts = KeyOf<typeof L2_SHORTCUTS>;
type ExpandShortcuts<Q extends string> = Q extends `${infer L1}:${infer L2}:${infer L3}` ? `${ExpandL1<L1>}:${ExpandL2<L2>}:${L3}` : Q extends `${infer L1}:${infer L2}` ? `${ExpandL1<L1>}:${ExpandL2<L2>}` : ExpandL1<Q>;
type ExpandL1<S extends string> = S extends L1Shortcuts ? typeof L1_SHORTCUTS[S][number] : S;
type ExpandL2<S extends string> = S extends L2Shortcuts ? typeof L2_SHORTCUTS[S][number] : S;
type AddTwins<L1 extends string, L2 extends string> = TwinsFromL1<L1, L2> | TwinsFromL2<L1, L2>;
type TwinsFromL1<L1 extends string, L2 extends string> = L1 extends KeyOf<L1Equivalents> ? L1Equivalents[L1] : L2;
type L1Equivalents = {
    message: "from";
    edited_message: "from" | "edit_date";
    channel_post: "sender_chat";
    edited_channel_post: "sender_chat" | "edit_date";
    business_message: "from";
    edited_business_message: "from" | "edit_date";
};
type TwinsFromL2<L1 extends string, L2 extends string> = L1 extends KeyOf<L2Equivalents> ? L2 extends KeyOf<L2Equivalents[L1]> ? L2Equivalents[L1][L2] : L2 : L2;
type L2Equivalents = {
    message: MessageEquivalents;
    edited_message: MessageEquivalents;
    channel_post: MessageEquivalents;
    edited_channel_post: MessageEquivalents;
    business_message: MessageEquivalents;
    edited_business_message: MessageEquivalents;
};
type MessageEquivalents = {
    animation: "document";
    entities: "text";
    caption_entities: "caption";
    is_topic_message: "message_thread_id";
};
export {};
