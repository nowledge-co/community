"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchFilter = matchFilter;
exports.parse = parse;
exports.preprocess = preprocess;
const filterQueryCache = new Map();
// === Obtain O(1) filter function from query
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
function matchFilter(filter) {
    var _a;
    const queries = Array.isArray(filter) ? filter : [filter];
    const key = queries.join(",");
    const predicate = (_a = filterQueryCache.get(key)) !== null && _a !== void 0 ? _a : (() => {
        const parsed = parse(queries);
        const pred = compile(parsed);
        filterQueryCache.set(key, pred);
        return pred;
    })();
    return (ctx) => predicate(ctx);
}
function parse(filter) {
    return Array.isArray(filter)
        ? filter.map((q) => q.split(":"))
        : [filter.split(":")];
}
function compile(parsed) {
    const preprocessed = parsed.flatMap((q) => check(q, preprocess(q)));
    const ltree = treeify(preprocessed);
    const predicate = arborist(ltree); // arborists check trees
    return (ctx) => !!predicate(ctx.update, ctx);
}
function preprocess(filter) {
    const valid = UPDATE_KEYS;
    const expanded = [filter]
        // expand L1
        .flatMap((q) => {
        const [l1, l2, l3] = q;
        // only expand if shortcut is given
        if (!(l1 in L1_SHORTCUTS))
            return [q];
        // only expand for at least one non-empty part
        if (!l1 && !l2 && !l3)
            return [q];
        // perform actual expansion
        const targets = L1_SHORTCUTS[l1];
        const expanded = targets.map((s) => [s, l2, l3]);
        // assume that bare L1 expansions are always correct
        if (l2 === undefined)
            return expanded;
        // only filter out invalid expansions if we don't do this later
        if (l2 in L2_SHORTCUTS && (l2 || l3))
            return expanded;
        // filter out invalid expansions, e.g. `channel_post:new_chat_member` for empty L1
        return expanded.filter(([s]) => { var _a; return !!((_a = valid[s]) === null || _a === void 0 ? void 0 : _a[l2]); });
    })
        // expand L2
        .flatMap((q) => {
        const [l1, l2, l3] = q;
        // only expand if shortcut is given
        if (!(l2 in L2_SHORTCUTS))
            return [q];
        // only expand for at least one non-empty part
        if (!l2 && !l3)
            return [q];
        // perform actual expansion
        const targets = L2_SHORTCUTS[l2];
        const expanded = targets.map((s) => [l1, s, l3]);
        // assume that bare L2 expansions are always correct
        if (l3 === undefined)
            return expanded;
        // filter out invalid expansions
        return expanded.filter(([, s]) => { var _a, _b; return !!((_b = (_a = valid[l1]) === null || _a === void 0 ? void 0 : _a[s]) === null || _b === void 0 ? void 0 : _b[l3]); });
    });
    if (expanded.length === 0) {
        throw new Error(`Shortcuts in '${filter.join(":")}' do not expand to any valid filter query`);
    }
    return expanded;
}
function check(original, preprocessed) {
    if (preprocessed.length === 0)
        throw new Error("Empty filter query given");
    const errors = preprocessed
        .map(checkOne)
        .filter((r) => r !== true);
    if (errors.length === 0)
        return preprocessed;
    else if (errors.length === 1)
        throw new Error(errors[0]);
    else {
        throw new Error(`Invalid filter query '${original.join(":")}'. There are ${errors.length} errors after expanding the contained shortcuts: ${errors.join("; ")}`);
    }
}
function checkOne(filter) {
    const [l1, l2, l3, ...n] = filter;
    if (l1 === undefined)
        return "Empty filter query given";
    if (!(l1 in UPDATE_KEYS)) {
        const permitted = Object.keys(UPDATE_KEYS);
        return `Invalid L1 filter '${l1}' given in '${filter.join(":")}'. \
Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`;
    }
    if (l2 === undefined)
        return true;
    const l1Obj = UPDATE_KEYS[l1];
    if (!(l2 in l1Obj)) {
        const permitted = Object.keys(l1Obj);
        return `Invalid L2 filter '${l2}' given in '${filter.join(":")}'. \
Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`;
    }
    if (l3 === undefined)
        return true;
    const l2Obj = l1Obj[l2];
    if (!(l3 in l2Obj)) {
        const permitted = Object.keys(l2Obj);
        return `Invalid L3 filter '${l3}' given in '${filter.join(":")}'. ${permitted.length === 0
            ? `No further filtering is possible after '${l1}:${l2}'.`
            : `Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`}`;
    }
    if (n.length === 0)
        return true;
    return `Cannot filter further than three levels, ':${n.join(":")}' is invalid!`;
}
function treeify(paths) {
    var _a, _b;
    const tree = {};
    for (const [l1, l2, l3] of paths) {
        const subtree = ((_a = tree[l1]) !== null && _a !== void 0 ? _a : (tree[l1] = {}));
        if (l2 !== undefined) {
            const set = ((_b = subtree[l2]) !== null && _b !== void 0 ? _b : (subtree[l2] = new Set()));
            if (l3 !== undefined)
                set.add(l3);
        }
    }
    return tree;
}
function or(left, right) {
    return (obj, ctx) => left(obj, ctx) || right(obj, ctx);
}
function concat(get, test) {
    return (obj, ctx) => {
        const nextObj = get(obj, ctx);
        return nextObj && test(nextObj, ctx);
    };
}
function leaf(pred) {
    return (obj, ctx) => pred(obj, ctx) != null;
}
function arborist(tree) {
    const l1Predicates = Object.entries(tree).map(([l1, subtree]) => {
        const l1Pred = (obj) => obj[l1];
        const l2Predicates = Object.entries(subtree).map(([l2, set]) => {
            const l2Pred = (obj) => obj[l2];
            const l3Predicates = Array.from(set).map((l3) => {
                const l3Pred = l3 === "me" // special handling for `me` shortcut
                    ? (obj, ctx) => {
                        const me = ctx.me.id;
                        return testMaybeArray(obj, (u) => u.id === me);
                    }
                    : (obj) => testMaybeArray(obj, (e) => e[l3] || e.type === l3);
                return l3Pred;
            });
            return l3Predicates.length === 0
                ? leaf(l2Pred)
                : concat(l2Pred, l3Predicates.reduce(or));
        });
        return l2Predicates.length === 0
            ? leaf(l1Pred)
            : concat(l1Pred, l2Predicates.reduce(or));
    });
    if (l1Predicates.length === 0) {
        throw new Error("Cannot create filter function for empty query");
    }
    return l1Predicates.reduce(or);
}
function testMaybeArray(t, pred) {
    const p = (x) => x != null && pred(x);
    return Array.isArray(t) ? t.some(p) : p(t);
}
// === Define a structure to validate the queries
// L3
const ENTITY_KEYS = {
    mention: {},
    hashtag: {},
    cashtag: {},
    bot_command: {},
    url: {},
    email: {},
    phone_number: {},
    bold: {},
    italic: {},
    underline: {},
    strikethrough: {},
    spoiler: {},
    blockquote: {},
    expandable_blockquote: {},
    code: {},
    pre: {},
    text_link: {},
    text_mention: {},
    custom_emoji: {},
};
const USER_KEYS = {
    me: {},
    is_bot: {},
    is_premium: {},
    added_to_attachment_menu: {},
};
const FORWARD_ORIGIN_KEYS = {
    user: {},
    hidden_user: {},
    chat: {},
    channel: {},
};
const STICKER_KEYS = {
    is_video: {},
    is_animated: {},
    premium_animation: {},
};
const REACTION_KEYS = {
    emoji: {},
    custom_emoji: {},
    paid: {},
};
const GIFT_INFO_KEYS = {
    can_be_upgraded: {},
    is_upgrade_separate: {},
    is_private: {},
};
// L2
const COMMON_MESSAGE_KEYS = {
    forward_origin: FORWARD_ORIGIN_KEYS,
    is_topic_message: {},
    is_automatic_forward: {},
    business_connection_id: {},
    text: {},
    animation: {},
    audio: {},
    document: {},
    paid_media: {},
    photo: {},
    sticker: STICKER_KEYS,
    story: {},
    video: {},
    video_note: {},
    voice: {},
    contact: {},
    dice: {},
    game: {},
    poll: {},
    venue: {},
    location: {},
    entities: ENTITY_KEYS,
    caption_entities: ENTITY_KEYS,
    caption: {},
    link_preview_options: {
        url: {},
        prefer_small_media: {},
        prefer_large_media: {},
        show_above_text: {},
    },
    effect_id: {},
    paid_star_count: {},
    has_media_spoiler: {},
    new_chat_title: {},
    new_chat_photo: {},
    delete_chat_photo: {},
    message_auto_delete_timer_changed: {},
    pinned_message: {},
    invoice: {},
    proximity_alert_triggered: {},
    chat_background_set: {},
    giveaway_created: {},
    giveaway: { only_new_members: {}, has_public_winners: {} },
    giveaway_winners: { only_new_members: {}, was_refunded: {} },
    giveaway_completed: {},
    gift: GIFT_INFO_KEYS,
    gift_upgrade_sent: GIFT_INFO_KEYS,
    unique_gift: { transfer_star_count: {} },
    paid_message_price_changed: {},
    video_chat_scheduled: {},
    video_chat_started: {},
    video_chat_ended: {},
    video_chat_participants_invited: {},
    web_app_data: {},
};
const MESSAGE_KEYS = {
    ...COMMON_MESSAGE_KEYS,
    direct_messages_topic: {},
    chat_owner_left: { new_owner: {} },
    chat_owner_changd: {},
    new_chat_members: USER_KEYS,
    left_chat_member: USER_KEYS,
    group_chat_created: {},
    supergroup_chat_created: {},
    migrate_to_chat_id: {},
    migrate_from_chat_id: {},
    successful_payment: {},
    refunded_payment: {},
    users_shared: {},
    chat_shared: {},
    connected_website: {},
    write_access_allowed: {},
    passport_data: {},
    boost_added: {},
    forum_topic_created: { is_name_implicit: {} },
    forum_topic_edited: { name: {}, icon_custom_emoji_id: {} },
    forum_topic_closed: {},
    forum_topic_reopened: {},
    general_forum_topic_hidden: {},
    general_forum_topic_unhidden: {},
    checklist: { others_can_add_tasks: {}, others_can_mark_tasks_as_done: {} },
    checklist_tasks_done: {},
    checklist_tasks_added: {},
    suggested_post_info: {},
    suggested_post_approved: {},
    suggested_post_approval_failed: {},
    suggested_post_declined: {},
    suggested_post_paid: {},
    suggested_post_refunded: {},
    sender_boost_count: {},
};
const CHANNEL_POST_KEYS = {
    ...COMMON_MESSAGE_KEYS,
    channel_chat_created: {},
    direct_message_price_changed: {},
    is_paid_post: {},
};
const BUSINESS_CONNECTION_KEYS = {
    can_reply: {},
    is_enabled: {},
};
const MESSAGE_REACTION_KEYS = {
    old_reaction: REACTION_KEYS,
    new_reaction: REACTION_KEYS,
};
const MESSAGE_REACTION_COUNT_UPDATED_KEYS = {
    reactions: REACTION_KEYS,
};
const CALLBACK_QUERY_KEYS = { data: {}, game_short_name: {} };
const CHAT_MEMBER_UPDATED_KEYS = { from: USER_KEYS };
// L1
const UPDATE_KEYS = {
    message: MESSAGE_KEYS,
    edited_message: MESSAGE_KEYS,
    channel_post: CHANNEL_POST_KEYS,
    edited_channel_post: CHANNEL_POST_KEYS,
    business_connection: BUSINESS_CONNECTION_KEYS,
    business_message: MESSAGE_KEYS,
    edited_business_message: MESSAGE_KEYS,
    deleted_business_messages: {},
    inline_query: {},
    chosen_inline_result: {},
    callback_query: CALLBACK_QUERY_KEYS,
    shipping_query: {},
    pre_checkout_query: {},
    poll: {},
    poll_answer: {},
    my_chat_member: CHAT_MEMBER_UPDATED_KEYS,
    chat_member: CHAT_MEMBER_UPDATED_KEYS,
    chat_join_request: {},
    message_reaction: MESSAGE_REACTION_KEYS,
    message_reaction_count: MESSAGE_REACTION_COUNT_UPDATED_KEYS,
    chat_boost: {},
    removed_chat_boost: {},
    purchased_paid_media: {},
};
// === Define some helpers for handling shortcuts, e.g. in 'edit:photo'
const L1_SHORTCUTS = {
    "": ["message", "channel_post"],
    msg: ["message", "channel_post"],
    edit: ["edited_message", "edited_channel_post"],
};
const L2_SHORTCUTS = {
    "": ["entities", "caption_entities"],
    media: ["photo", "video"],
    file: [
        "photo",
        "animation",
        "audio",
        "document",
        "video",
        "video_note",
        "voice",
        "sticker",
    ],
};
