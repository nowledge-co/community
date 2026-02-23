const filterQueryCache = new Map();
function matchFilter(filter) {
    const queries = Array.isArray(filter) ? filter : [
        filter
    ];
    const key = queries.join(",");
    const predicate = filterQueryCache.get(key) ?? (()=>{
        const parsed = parse(queries);
        const pred = compile(parsed);
        filterQueryCache.set(key, pred);
        return pred;
    })();
    return (ctx)=>predicate(ctx);
}
function parse(filter) {
    return Array.isArray(filter) ? filter.map((q)=>q.split(":")) : [
        filter.split(":")
    ];
}
function compile(parsed) {
    const preprocessed = parsed.flatMap((q)=>check(q, preprocess(q)));
    const ltree = treeify(preprocessed);
    const predicate = arborist(ltree);
    return (ctx)=>!!predicate(ctx.update, ctx);
}
function preprocess(filter) {
    const valid = UPDATE_KEYS;
    const expanded = [
        filter
    ].flatMap((q)=>{
        const [l1, l2, l3] = q;
        if (!(l1 in L1_SHORTCUTS)) return [
            q
        ];
        if (!l1 && !l2 && !l3) return [
            q
        ];
        const targets = L1_SHORTCUTS[l1];
        const expanded = targets.map((s)=>[
                s,
                l2,
                l3
            ]);
        if (l2 === undefined) return expanded;
        if (l2 in L2_SHORTCUTS && (l2 || l3)) return expanded;
        return expanded.filter(([s])=>!!valid[s]?.[l2]);
    }).flatMap((q)=>{
        const [l1, l2, l3] = q;
        if (!(l2 in L2_SHORTCUTS)) return [
            q
        ];
        if (!l2 && !l3) return [
            q
        ];
        const targets = L2_SHORTCUTS[l2];
        const expanded = targets.map((s)=>[
                l1,
                s,
                l3
            ]);
        if (l3 === undefined) return expanded;
        return expanded.filter(([, s])=>!!valid[l1]?.[s]?.[l3]);
    });
    if (expanded.length === 0) {
        throw new Error(`Shortcuts in '${filter.join(":")}' do not expand to any valid filter query`);
    }
    return expanded;
}
function check(original, preprocessed) {
    if (preprocessed.length === 0) throw new Error("Empty filter query given");
    const errors = preprocessed.map(checkOne).filter((r)=>r !== true);
    if (errors.length === 0) return preprocessed;
    else if (errors.length === 1) throw new Error(errors[0]);
    else {
        throw new Error(`Invalid filter query '${original.join(":")}'. There are ${errors.length} errors after expanding the contained shortcuts: ${errors.join("; ")}`);
    }
}
function checkOne(filter) {
    const [l1, l2, l3, ...n] = filter;
    if (l1 === undefined) return "Empty filter query given";
    if (!(l1 in UPDATE_KEYS)) {
        const permitted = Object.keys(UPDATE_KEYS);
        return `Invalid L1 filter '${l1}' given in '${filter.join(":")}'. \
Permitted values are: ${permitted.map((k)=>`'${k}'`).join(", ")}.`;
    }
    if (l2 === undefined) return true;
    const l1Obj = UPDATE_KEYS[l1];
    if (!(l2 in l1Obj)) {
        const permitted = Object.keys(l1Obj);
        return `Invalid L2 filter '${l2}' given in '${filter.join(":")}'. \
Permitted values are: ${permitted.map((k)=>`'${k}'`).join(", ")}.`;
    }
    if (l3 === undefined) return true;
    const l2Obj = l1Obj[l2];
    if (!(l3 in l2Obj)) {
        const permitted = Object.keys(l2Obj);
        return `Invalid L3 filter '${l3}' given in '${filter.join(":")}'. ${permitted.length === 0 ? `No further filtering is possible after '${l1}:${l2}'.` : `Permitted values are: ${permitted.map((k)=>`'${k}'`).join(", ")}.`}`;
    }
    if (n.length === 0) return true;
    return `Cannot filter further than three levels, ':${n.join(":")}' is invalid!`;
}
function treeify(paths) {
    const tree = {};
    for (const [l1, l2, l3] of paths){
        const subtree = tree[l1] ??= {};
        if (l2 !== undefined) {
            const set = subtree[l2] ??= new Set();
            if (l3 !== undefined) set.add(l3);
        }
    }
    return tree;
}
function or(left, right) {
    return (obj, ctx)=>left(obj, ctx) || right(obj, ctx);
}
function concat(get, test) {
    return (obj, ctx)=>{
        const nextObj = get(obj, ctx);
        return nextObj && test(nextObj, ctx);
    };
}
function leaf(pred) {
    return (obj, ctx)=>pred(obj, ctx) != null;
}
function arborist(tree) {
    const l1Predicates = Object.entries(tree).map(([l1, subtree])=>{
        const l1Pred = (obj)=>obj[l1];
        const l2Predicates = Object.entries(subtree).map(([l2, set])=>{
            const l2Pred = (obj)=>obj[l2];
            const l3Predicates = Array.from(set).map((l3)=>{
                const l3Pred = l3 === "me" ? (obj, ctx)=>{
                    const me = ctx.me.id;
                    return testMaybeArray(obj, (u)=>u.id === me);
                } : (obj)=>testMaybeArray(obj, (e)=>e[l3] || e.type === l3);
                return l3Pred;
            });
            return l3Predicates.length === 0 ? leaf(l2Pred) : concat(l2Pred, l3Predicates.reduce(or));
        });
        return l2Predicates.length === 0 ? leaf(l1Pred) : concat(l1Pred, l2Predicates.reduce(or));
    });
    if (l1Predicates.length === 0) {
        throw new Error("Cannot create filter function for empty query");
    }
    return l1Predicates.reduce(or);
}
function testMaybeArray(t, pred) {
    const p = (x)=>x != null && pred(x);
    return Array.isArray(t) ? t.some(p) : p(t);
}
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
    custom_emoji: {}
};
const USER_KEYS = {
    me: {},
    is_bot: {},
    is_premium: {},
    added_to_attachment_menu: {}
};
const FORWARD_ORIGIN_KEYS = {
    user: {},
    hidden_user: {},
    chat: {},
    channel: {}
};
const STICKER_KEYS = {
    is_video: {},
    is_animated: {},
    premium_animation: {}
};
const REACTION_KEYS = {
    emoji: {},
    custom_emoji: {},
    paid: {}
};
const GIFT_INFO_KEYS = {
    can_be_upgraded: {},
    is_upgrade_separate: {},
    is_private: {}
};
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
        show_above_text: {}
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
    giveaway: {
        only_new_members: {},
        has_public_winners: {}
    },
    giveaway_winners: {
        only_new_members: {},
        was_refunded: {}
    },
    giveaway_completed: {},
    gift: GIFT_INFO_KEYS,
    gift_upgrade_sent: GIFT_INFO_KEYS,
    unique_gift: {
        transfer_star_count: {}
    },
    paid_message_price_changed: {},
    video_chat_scheduled: {},
    video_chat_started: {},
    video_chat_ended: {},
    video_chat_participants_invited: {},
    web_app_data: {}
};
const MESSAGE_KEYS = {
    ...COMMON_MESSAGE_KEYS,
    direct_messages_topic: {},
    chat_owner_left: {
        new_owner: {}
    },
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
    forum_topic_created: {
        is_name_implicit: {}
    },
    forum_topic_edited: {
        name: {},
        icon_custom_emoji_id: {}
    },
    forum_topic_closed: {},
    forum_topic_reopened: {},
    general_forum_topic_hidden: {},
    general_forum_topic_unhidden: {},
    checklist: {
        others_can_add_tasks: {},
        others_can_mark_tasks_as_done: {}
    },
    checklist_tasks_done: {},
    checklist_tasks_added: {},
    suggested_post_info: {},
    suggested_post_approved: {},
    suggested_post_approval_failed: {},
    suggested_post_declined: {},
    suggested_post_paid: {},
    suggested_post_refunded: {},
    sender_boost_count: {}
};
const CHANNEL_POST_KEYS = {
    ...COMMON_MESSAGE_KEYS,
    channel_chat_created: {},
    direct_message_price_changed: {},
    is_paid_post: {}
};
const BUSINESS_CONNECTION_KEYS = {
    can_reply: {},
    is_enabled: {}
};
const MESSAGE_REACTION_KEYS = {
    old_reaction: REACTION_KEYS,
    new_reaction: REACTION_KEYS
};
const MESSAGE_REACTION_COUNT_UPDATED_KEYS = {
    reactions: REACTION_KEYS
};
const CALLBACK_QUERY_KEYS = {
    data: {},
    game_short_name: {}
};
const CHAT_MEMBER_UPDATED_KEYS = {
    from: USER_KEYS
};
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
    purchased_paid_media: {}
};
const L1_SHORTCUTS = {
    "": [
        "message",
        "channel_post"
    ],
    msg: [
        "message",
        "channel_post"
    ],
    edit: [
        "edited_message",
        "edited_channel_post"
    ]
};
const L2_SHORTCUTS = {
    "": [
        "entities",
        "caption_entities"
    ],
    media: [
        "photo",
        "video"
    ],
    file: [
        "photo",
        "animation",
        "audio",
        "document",
        "video",
        "video_note",
        "voice",
        "sticker"
    ]
};
const checker = {
    filterQuery (filter) {
        const pred = matchFilter(filter);
        return (ctx)=>pred(ctx);
    },
    text (trigger) {
        const hasText = checker.filterQuery([
            ":text",
            ":caption"
        ]);
        const trg = triggerFn(trigger);
        return (ctx)=>{
            if (!hasText(ctx)) return false;
            const msg = ctx.message ?? ctx.channelPost;
            const txt = msg.text ?? msg.caption;
            return match(ctx, txt, trg);
        };
    },
    command (command) {
        const hasEntities = checker.filterQuery(":entities:bot_command");
        const atCommands = new Set();
        const noAtCommands = new Set();
        toArray(command).forEach((cmd)=>{
            if (cmd.startsWith("/")) {
                throw new Error(`Do not include '/' when registering command handlers (use '${cmd.substring(1)}' not '${cmd}')`);
            }
            const set = cmd.includes("@") ? atCommands : noAtCommands;
            set.add(cmd);
        });
        return (ctx)=>{
            if (!hasEntities(ctx)) return false;
            const msg = ctx.message ?? ctx.channelPost;
            const txt = msg.text ?? msg.caption;
            return msg.entities.some((e)=>{
                if (e.type !== "bot_command") return false;
                if (e.offset !== 0) return false;
                const cmd = txt.substring(1, e.length);
                if (noAtCommands.has(cmd) || atCommands.has(cmd)) {
                    ctx.match = txt.substring(cmd.length + 1).trimStart();
                    return true;
                }
                const index = cmd.indexOf("@");
                if (index === -1) return false;
                const atTarget = cmd.substring(index + 1).toLowerCase();
                const username = ctx.me.username.toLowerCase();
                if (atTarget !== username) return false;
                const atCommand = cmd.substring(0, index);
                if (noAtCommands.has(atCommand)) {
                    ctx.match = txt.substring(cmd.length + 1).trimStart();
                    return true;
                }
                return false;
            });
        };
    },
    reaction (reaction) {
        const hasMessageReaction = checker.filterQuery("message_reaction");
        const normalized = typeof reaction === "string" ? [
            {
                type: "emoji",
                emoji: reaction
            }
        ] : (Array.isArray(reaction) ? reaction : [
            reaction
        ]).map((emoji)=>typeof emoji === "string" ? {
                type: "emoji",
                emoji
            } : emoji);
        const emoji = new Set(normalized.filter((r)=>r.type === "emoji").map((r)=>r.emoji));
        const customEmoji = new Set(normalized.filter((r)=>r.type === "custom_emoji").map((r)=>r.custom_emoji_id));
        const paid = normalized.some((r)=>r.type === "paid");
        return (ctx)=>{
            if (!hasMessageReaction(ctx)) return false;
            const { old_reaction, new_reaction } = ctx.messageReaction;
            for (const reaction of new_reaction){
                let isOld = false;
                if (reaction.type === "emoji") {
                    for (const old of old_reaction){
                        if (old.type !== "emoji") continue;
                        if (old.emoji === reaction.emoji) {
                            isOld = true;
                            break;
                        }
                    }
                } else if (reaction.type === "custom_emoji") {
                    for (const old of old_reaction){
                        if (old.type !== "custom_emoji") continue;
                        if (old.custom_emoji_id === reaction.custom_emoji_id) {
                            isOld = true;
                            break;
                        }
                    }
                } else if (reaction.type === "paid") {
                    for (const old of old_reaction){
                        if (old.type !== "paid") continue;
                        isOld = true;
                        break;
                    }
                } else {}
                if (isOld) continue;
                if (reaction.type === "emoji") {
                    if (emoji.has(reaction.emoji)) return true;
                } else if (reaction.type === "custom_emoji") {
                    if (customEmoji.has(reaction.custom_emoji_id)) return true;
                } else if (reaction.type === "paid") {
                    if (paid) return true;
                } else {
                    return true;
                }
            }
            return false;
        };
    },
    chatType (chatType) {
        const set = new Set(toArray(chatType));
        return (ctx)=>ctx.chat?.type !== undefined && set.has(ctx.chat.type);
    },
    callbackQuery (trigger) {
        const hasCallbackQuery = checker.filterQuery("callback_query:data");
        const trg = triggerFn(trigger);
        return (ctx)=>hasCallbackQuery(ctx) && match(ctx, ctx.callbackQuery.data, trg);
    },
    gameQuery (trigger) {
        const hasGameQuery = checker.filterQuery("callback_query:game_short_name");
        const trg = triggerFn(trigger);
        return (ctx)=>hasGameQuery(ctx) && match(ctx, ctx.callbackQuery.game_short_name, trg);
    },
    inlineQuery (trigger) {
        const hasInlineQuery = checker.filterQuery("inline_query");
        const trg = triggerFn(trigger);
        return (ctx)=>hasInlineQuery(ctx) && match(ctx, ctx.inlineQuery.query, trg);
    },
    chosenInlineResult (trigger) {
        const hasChosenInlineResult = checker.filterQuery("chosen_inline_result");
        const trg = triggerFn(trigger);
        return (ctx)=>hasChosenInlineResult(ctx) && match(ctx, ctx.chosenInlineResult.result_id, trg);
    },
    preCheckoutQuery (trigger) {
        const hasPreCheckoutQuery = checker.filterQuery("pre_checkout_query");
        const trg = triggerFn(trigger);
        return (ctx)=>hasPreCheckoutQuery(ctx) && match(ctx, ctx.preCheckoutQuery.invoice_payload, trg);
    },
    shippingQuery (trigger) {
        const hasShippingQuery = checker.filterQuery("shipping_query");
        const trg = triggerFn(trigger);
        return (ctx)=>hasShippingQuery(ctx) && match(ctx, ctx.shippingQuery.invoice_payload, trg);
    }
};
class Context {
    update;
    api;
    me;
    match;
    constructor(update, api, me){
        this.update = update;
        this.api = api;
        this.me = me;
    }
    get message() {
        return this.update.message;
    }
    get editedMessage() {
        return this.update.edited_message;
    }
    get channelPost() {
        return this.update.channel_post;
    }
    get editedChannelPost() {
        return this.update.edited_channel_post;
    }
    get businessConnection() {
        return this.update.business_connection;
    }
    get businessMessage() {
        return this.update.business_message;
    }
    get editedBusinessMessage() {
        return this.update.edited_business_message;
    }
    get deletedBusinessMessages() {
        return this.update.deleted_business_messages;
    }
    get messageReaction() {
        return this.update.message_reaction;
    }
    get messageReactionCount() {
        return this.update.message_reaction_count;
    }
    get inlineQuery() {
        return this.update.inline_query;
    }
    get chosenInlineResult() {
        return this.update.chosen_inline_result;
    }
    get callbackQuery() {
        return this.update.callback_query;
    }
    get shippingQuery() {
        return this.update.shipping_query;
    }
    get preCheckoutQuery() {
        return this.update.pre_checkout_query;
    }
    get poll() {
        return this.update.poll;
    }
    get pollAnswer() {
        return this.update.poll_answer;
    }
    get myChatMember() {
        return this.update.my_chat_member;
    }
    get chatMember() {
        return this.update.chat_member;
    }
    get chatJoinRequest() {
        return this.update.chat_join_request;
    }
    get chatBoost() {
        return this.update.chat_boost;
    }
    get removedChatBoost() {
        return this.update.removed_chat_boost;
    }
    get purchasedPaidMedia() {
        return this.update.purchased_paid_media;
    }
    get msg() {
        return this.message ?? this.editedMessage ?? this.channelPost ?? this.editedChannelPost ?? this.businessMessage ?? this.editedBusinessMessage ?? this.callbackQuery?.message;
    }
    get chat() {
        return (this.msg ?? this.deletedBusinessMessages ?? this.messageReaction ?? this.messageReactionCount ?? this.myChatMember ?? this.chatMember ?? this.chatJoinRequest ?? this.chatBoost ?? this.removedChatBoost)?.chat;
    }
    get senderChat() {
        return this.msg?.sender_chat;
    }
    get from() {
        return (this.businessConnection ?? this.messageReaction ?? (this.chatBoost?.boost ?? this.removedChatBoost)?.source)?.user ?? (this.callbackQuery ?? this.msg ?? this.inlineQuery ?? this.chosenInlineResult ?? this.shippingQuery ?? this.preCheckoutQuery ?? this.myChatMember ?? this.chatMember ?? this.chatJoinRequest ?? this.purchasedPaidMedia)?.from;
    }
    get msgId() {
        return this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id;
    }
    get chatId() {
        return this.chat?.id ?? this.businessConnection?.user_chat_id;
    }
    get inlineMessageId() {
        return this.callbackQuery?.inline_message_id ?? this.chosenInlineResult?.inline_message_id;
    }
    get businessConnectionId() {
        return this.msg?.business_connection_id ?? this.businessConnection?.id ?? this.deletedBusinessMessages?.business_connection_id;
    }
    entities(types) {
        const message = this.msg;
        if (message === undefined) return [];
        const text = message.text ?? message.caption;
        if (text === undefined) return [];
        let entities = message.entities ?? message.caption_entities;
        if (entities === undefined) return [];
        if (types !== undefined) {
            const filters = new Set(toArray(types));
            entities = entities.filter((entity)=>filters.has(entity.type));
        }
        return entities.map((entity)=>({
                ...entity,
                text: text.substring(entity.offset, entity.offset + entity.length)
            }));
    }
    reactions() {
        const emoji = [];
        const emojiAdded = [];
        const emojiKept = [];
        const emojiRemoved = [];
        const customEmoji = [];
        const customEmojiAdded = [];
        const customEmojiKept = [];
        const customEmojiRemoved = [];
        let paid = false;
        let paidAdded = false;
        const r = this.messageReaction;
        if (r !== undefined) {
            const { old_reaction, new_reaction } = r;
            for (const reaction of new_reaction){
                if (reaction.type === "emoji") {
                    emoji.push(reaction.emoji);
                } else if (reaction.type === "custom_emoji") {
                    customEmoji.push(reaction.custom_emoji_id);
                } else if (reaction.type === "paid") {
                    paid = paidAdded = true;
                }
            }
            for (const reaction of old_reaction){
                if (reaction.type === "emoji") {
                    emojiRemoved.push(reaction.emoji);
                } else if (reaction.type === "custom_emoji") {
                    customEmojiRemoved.push(reaction.custom_emoji_id);
                } else if (reaction.type === "paid") {
                    paidAdded = false;
                }
            }
            emojiAdded.push(...emoji);
            customEmojiAdded.push(...customEmoji);
            for(let i = 0; i < emojiRemoved.length; i++){
                const len = emojiAdded.length;
                if (len === 0) break;
                const rem = emojiRemoved[i];
                for(let j = 0; j < len; j++){
                    if (rem === emojiAdded[j]) {
                        emojiKept.push(rem);
                        emojiRemoved.splice(i, 1);
                        emojiAdded.splice(j, 1);
                        i--;
                        break;
                    }
                }
            }
            for(let i = 0; i < customEmojiRemoved.length; i++){
                const len = customEmojiAdded.length;
                if (len === 0) break;
                const rem = customEmojiRemoved[i];
                for(let j = 0; j < len; j++){
                    if (rem === customEmojiAdded[j]) {
                        customEmojiKept.push(rem);
                        customEmojiRemoved.splice(i, 1);
                        customEmojiAdded.splice(j, 1);
                        i--;
                        break;
                    }
                }
            }
        }
        return {
            emoji,
            emojiAdded,
            emojiKept,
            emojiRemoved,
            customEmoji,
            customEmojiAdded,
            customEmojiKept,
            customEmojiRemoved,
            paid,
            paidAdded
        };
    }
    static has = checker;
    has(filter) {
        return Context.has.filterQuery(filter)(this);
    }
    hasText(trigger) {
        return Context.has.text(trigger)(this);
    }
    hasCommand(command) {
        return Context.has.command(command)(this);
    }
    hasReaction(reaction) {
        return Context.has.reaction(reaction)(this);
    }
    hasChatType(chatType) {
        return Context.has.chatType(chatType)(this);
    }
    hasCallbackQuery(trigger) {
        return Context.has.callbackQuery(trigger)(this);
    }
    hasGameQuery(trigger) {
        return Context.has.gameQuery(trigger)(this);
    }
    hasInlineQuery(trigger) {
        return Context.has.inlineQuery(trigger)(this);
    }
    hasChosenInlineResult(trigger) {
        return Context.has.chosenInlineResult(trigger)(this);
    }
    hasPreCheckoutQuery(trigger) {
        return Context.has.preCheckoutQuery(trigger)(this);
    }
    hasShippingQuery(trigger) {
        return Context.has.shippingQuery(trigger)(this);
    }
    reply(text, other, signal) {
        const msg = this.msg;
        return this.api.sendMessage(orThrow(this.chatId, "sendMessage"), text, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithDraft(text, other, signal) {
        const msg = this.msg;
        return this.api.sendMessageDraft(orThrow(this.chatId, "sendMessageDraft"), this.update.update_id, text, {
            ...msg?.is_topic_message ? {
                message_thread_id: msg?.message_thread_id
            } : {},
            ...other
        }, signal);
    }
    forwardMessage(chat_id, other, signal) {
        const msg = this.msg;
        return this.api.forwardMessage(chat_id, orThrow(this.chatId, "forwardMessage"), orThrow(this.msgId, "forwardMessage"), {
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    forwardMessages(chat_id, message_ids, other, signal) {
        const msg = this.msg;
        return this.api.forwardMessages(chat_id, orThrow(this.chatId, "forwardMessages"), message_ids, {
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    copyMessage(chat_id, other, signal) {
        const msg = this.msg;
        return this.api.copyMessage(chat_id, orThrow(this.chatId, "copyMessage"), orThrow(this.msgId, "copyMessage"), {
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    copyMessages(chat_id, message_ids, other, signal) {
        const msg = this.msg;
        return this.api.copyMessages(chat_id, orThrow(this.chatId, "copyMessages"), message_ids, {
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithPhoto(photo, other, signal) {
        const msg = this.msg;
        return this.api.sendPhoto(orThrow(this.chatId, "sendPhoto"), photo, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithAudio(audio, other, signal) {
        const msg = this.msg;
        return this.api.sendAudio(orThrow(this.chatId, "sendAudio"), audio, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithDocument(document1, other, signal) {
        const msg = this.msg;
        return this.api.sendDocument(orThrow(this.chatId, "sendDocument"), document1, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithVideo(video, other, signal) {
        const msg = this.msg;
        return this.api.sendVideo(orThrow(this.chatId, "sendVideo"), video, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithAnimation(animation, other, signal) {
        const msg = this.msg;
        return this.api.sendAnimation(orThrow(this.chatId, "sendAnimation"), animation, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithVoice(voice, other, signal) {
        const msg = this.msg;
        return this.api.sendVoice(orThrow(this.chatId, "sendVoice"), voice, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithVideoNote(video_note, other, signal) {
        const msg = this.msg;
        return this.api.sendVideoNote(orThrow(this.chatId, "sendVideoNote"), video_note, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithMediaGroup(media, other, signal) {
        const msg = this.msg;
        return this.api.sendMediaGroup(orThrow(this.chatId, "sendMediaGroup"), media, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithLocation(latitude, longitude, other, signal) {
        const msg = this.msg;
        return this.api.sendLocation(orThrow(this.chatId, "sendLocation"), latitude, longitude, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    editMessageLiveLocation(latitude, longitude, other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== undefined ? this.api.editMessageLiveLocationInline(inlineId, latitude, longitude, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal) : this.api.editMessageLiveLocation(orThrow(this.chatId, "editMessageLiveLocation"), orThrow(this.msgId, "editMessageLiveLocation"), latitude, longitude, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal);
    }
    stopMessageLiveLocation(other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== undefined ? this.api.stopMessageLiveLocationInline(inlineId, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal) : this.api.stopMessageLiveLocation(orThrow(this.chatId, "stopMessageLiveLocation"), orThrow(this.msgId, "stopMessageLiveLocation"), {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal);
    }
    sendPaidMedia(star_count, media, other, signal) {
        const msg = this.msg;
        return this.api.sendPaidMedia(orThrow(this.chatId, "sendPaidMedia"), star_count, media, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: this.msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithVenue(latitude, longitude, title, address, other, signal) {
        const msg = this.msg;
        return this.api.sendVenue(orThrow(this.chatId, "sendVenue"), latitude, longitude, title, address, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithContact(phone_number, first_name, other, signal) {
        const msg = this.msg;
        return this.api.sendContact(orThrow(this.chatId, "sendContact"), phone_number, first_name, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithPoll(question, options, other, signal) {
        const msg = this.msg;
        return this.api.sendPoll(orThrow(this.chatId, "sendPoll"), question, options, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            ...other
        }, signal);
    }
    replyWithChecklist(checklist, other, signal) {
        return this.api.sendChecklist(orThrow(this.businessConnectionId, "sendChecklist"), orThrow(this.chatId, "sendChecklist"), checklist, other, signal);
    }
    editMessageChecklist(checklist, other, signal) {
        const msg = orThrow(this.msg, "editMessageChecklist");
        const target = msg.checklist_tasks_done?.checklist_message ?? msg.checklist_tasks_added?.checklist_message ?? msg;
        return this.api.editMessageChecklist(orThrow(this.businessConnectionId, "editMessageChecklist"), orThrow(target.chat.id, "editMessageChecklist"), orThrow(target.message_id, "editMessageChecklist"), checklist, other, signal);
    }
    replyWithDice(emoji, other, signal) {
        const msg = this.msg;
        return this.api.sendDice(orThrow(this.chatId, "sendDice"), emoji, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    replyWithChatAction(action, other, signal) {
        const msg = this.msg;
        return this.api.sendChatAction(orThrow(this.chatId, "sendChatAction"), action, {
            business_connection_id: this.businessConnectionId,
            message_thread_id: msg?.message_thread_id,
            ...other
        }, signal);
    }
    react(reaction, other, signal) {
        return this.api.setMessageReaction(orThrow(this.chatId, "setMessageReaction"), orThrow(this.msgId, "setMessageReaction"), typeof reaction === "string" ? [
            {
                type: "emoji",
                emoji: reaction
            }
        ] : (Array.isArray(reaction) ? reaction : [
            reaction
        ]).map((emoji)=>typeof emoji === "string" ? {
                type: "emoji",
                emoji
            } : emoji), other, signal);
    }
    getUserProfilePhotos(other, signal) {
        return this.api.getUserProfilePhotos(orThrow(this.from, "getUserProfilePhotos").id, other, signal);
    }
    getUserProfileAudios(other, signal) {
        return this.api.getUserProfileAudios(orThrow(this.from, "getUserProfileAudios").id, other, signal);
    }
    setUserEmojiStatus(other, signal) {
        return this.api.setUserEmojiStatus(orThrow(this.from, "setUserEmojiStatus").id, other, signal);
    }
    getUserChatBoosts(chat_id, signal) {
        return this.api.getUserChatBoosts(chat_id ?? orThrow(this.chatId, "getUserChatBoosts"), orThrow(this.from, "getUserChatBoosts").id, signal);
    }
    getUserGifts(other, signal) {
        return this.api.getUserGifts(orThrow(this.from, "getUserGifts").id, other, signal);
    }
    getChatGifts(other, signal) {
        return this.api.getChatGifts(orThrow(this.chatId, "getChatGifts"), other, signal);
    }
    getBusinessConnection(signal) {
        return this.api.getBusinessConnection(orThrow(this.businessConnectionId, "getBusinessConnection"), signal);
    }
    getFile(signal) {
        const m = orThrow(this.msg, "getFile");
        const file = m.photo !== undefined ? m.photo[m.photo.length - 1] : m.animation ?? m.audio ?? m.document ?? m.video ?? m.video_note ?? m.voice ?? m.sticker;
        return this.api.getFile(orThrow(file, "getFile").file_id, signal);
    }
    kickAuthor(...args) {
        return this.banAuthor(...args);
    }
    banAuthor(other, signal) {
        return this.api.banChatMember(orThrow(this.chatId, "banAuthor"), orThrow(this.from, "banAuthor").id, other, signal);
    }
    kickChatMember(...args) {
        return this.banChatMember(...args);
    }
    banChatMember(user_id, other, signal) {
        return this.api.banChatMember(orThrow(this.chatId, "banChatMember"), user_id, other, signal);
    }
    unbanChatMember(user_id, other, signal) {
        return this.api.unbanChatMember(orThrow(this.chatId, "unbanChatMember"), user_id, other, signal);
    }
    restrictAuthor(permissions, other, signal) {
        return this.api.restrictChatMember(orThrow(this.chatId, "restrictAuthor"), orThrow(this.from, "restrictAuthor").id, permissions, other, signal);
    }
    restrictChatMember(user_id, permissions, other, signal) {
        return this.api.restrictChatMember(orThrow(this.chatId, "restrictChatMember"), user_id, permissions, other, signal);
    }
    promoteAuthor(other, signal) {
        return this.api.promoteChatMember(orThrow(this.chatId, "promoteAuthor"), orThrow(this.from, "promoteAuthor").id, other, signal);
    }
    promoteChatMember(user_id, other, signal) {
        return this.api.promoteChatMember(orThrow(this.chatId, "promoteChatMember"), user_id, other, signal);
    }
    setChatAdministratorAuthorCustomTitle(custom_title, signal) {
        return this.api.setChatAdministratorCustomTitle(orThrow(this.chatId, "setChatAdministratorAuthorCustomTitle"), orThrow(this.from, "setChatAdministratorAuthorCustomTitle").id, custom_title, signal);
    }
    setChatAdministratorCustomTitle(user_id, custom_title, signal) {
        return this.api.setChatAdministratorCustomTitle(orThrow(this.chatId, "setChatAdministratorCustomTitle"), user_id, custom_title, signal);
    }
    banChatSenderChat(sender_chat_id, signal) {
        return this.api.banChatSenderChat(orThrow(this.chatId, "banChatSenderChat"), sender_chat_id, signal);
    }
    unbanChatSenderChat(sender_chat_id, signal) {
        return this.api.unbanChatSenderChat(orThrow(this.chatId, "unbanChatSenderChat"), sender_chat_id, signal);
    }
    setChatPermissions(permissions, other, signal) {
        return this.api.setChatPermissions(orThrow(this.chatId, "setChatPermissions"), permissions, other, signal);
    }
    exportChatInviteLink(signal) {
        return this.api.exportChatInviteLink(orThrow(this.chatId, "exportChatInviteLink"), signal);
    }
    createChatInviteLink(other, signal) {
        return this.api.createChatInviteLink(orThrow(this.chatId, "createChatInviteLink"), other, signal);
    }
    editChatInviteLink(invite_link, other, signal) {
        return this.api.editChatInviteLink(orThrow(this.chatId, "editChatInviteLink"), invite_link, other, signal);
    }
    createChatSubscriptionInviteLink(subscription_period, subscription_price, other, signal) {
        return this.api.createChatSubscriptionInviteLink(orThrow(this.chatId, "createChatSubscriptionInviteLink"), subscription_period, subscription_price, other, signal);
    }
    editChatSubscriptionInviteLink(invite_link, other, signal) {
        return this.api.editChatSubscriptionInviteLink(orThrow(this.chatId, "editChatSubscriptionInviteLink"), invite_link, other, signal);
    }
    revokeChatInviteLink(invite_link, signal) {
        return this.api.revokeChatInviteLink(orThrow(this.chatId, "editChatInviteLink"), invite_link, signal);
    }
    approveChatJoinRequest(user_id, signal) {
        return this.api.approveChatJoinRequest(orThrow(this.chatId, "approveChatJoinRequest"), user_id, signal);
    }
    declineChatJoinRequest(user_id, signal) {
        return this.api.declineChatJoinRequest(orThrow(this.chatId, "declineChatJoinRequest"), user_id, signal);
    }
    approveSuggestedPost(other, signal) {
        return this.api.approveSuggestedPost(orThrow(this.chatId, "approveSuggestedPost"), orThrow(this.msgId, "approveSuggestedPost"), other, signal);
    }
    declineSuggestedPost(other, signal) {
        return this.api.declineSuggestedPost(orThrow(this.chatId, "declineSuggestedPost"), orThrow(this.msgId, "declineSuggestedPost"), other, signal);
    }
    setChatPhoto(photo, signal) {
        return this.api.setChatPhoto(orThrow(this.chatId, "setChatPhoto"), photo, signal);
    }
    deleteChatPhoto(signal) {
        return this.api.deleteChatPhoto(orThrow(this.chatId, "deleteChatPhoto"), signal);
    }
    setChatTitle(title, signal) {
        return this.api.setChatTitle(orThrow(this.chatId, "setChatTitle"), title, signal);
    }
    setChatDescription(description, signal) {
        return this.api.setChatDescription(orThrow(this.chatId, "setChatDescription"), description, signal);
    }
    pinChatMessage(message_id, other, signal) {
        return this.api.pinChatMessage(orThrow(this.chatId, "pinChatMessage"), message_id, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal);
    }
    unpinChatMessage(message_id, other, signal) {
        return this.api.unpinChatMessage(orThrow(this.chatId, "unpinChatMessage"), message_id, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal);
    }
    unpinAllChatMessages(signal) {
        return this.api.unpinAllChatMessages(orThrow(this.chatId, "unpinAllChatMessages"), signal);
    }
    leaveChat(signal) {
        return this.api.leaveChat(orThrow(this.chatId, "leaveChat"), signal);
    }
    getChat(signal) {
        return this.api.getChat(orThrow(this.chatId, "getChat"), signal);
    }
    getChatAdministrators(signal) {
        return this.api.getChatAdministrators(orThrow(this.chatId, "getChatAdministrators"), signal);
    }
    getChatMembersCount(...args) {
        return this.getChatMemberCount(...args);
    }
    getChatMemberCount(signal) {
        return this.api.getChatMemberCount(orThrow(this.chatId, "getChatMemberCount"), signal);
    }
    getAuthor(signal) {
        return this.api.getChatMember(orThrow(this.chatId, "getAuthor"), orThrow(this.from, "getAuthor").id, signal);
    }
    getChatMember(user_id, signal) {
        return this.api.getChatMember(orThrow(this.chatId, "getChatMember"), user_id, signal);
    }
    setChatStickerSet(sticker_set_name, signal) {
        return this.api.setChatStickerSet(orThrow(this.chatId, "setChatStickerSet"), sticker_set_name, signal);
    }
    deleteChatStickerSet(signal) {
        return this.api.deleteChatStickerSet(orThrow(this.chatId, "deleteChatStickerSet"), signal);
    }
    createForumTopic(name, other, signal) {
        return this.api.createForumTopic(orThrow(this.chatId, "createForumTopic"), name, other, signal);
    }
    editForumTopic(other, signal) {
        const message = orThrow(this.msg, "editForumTopic");
        const thread = orThrow(message.message_thread_id, "editForumTopic");
        return this.api.editForumTopic(message.chat.id, thread, other, signal);
    }
    closeForumTopic(signal) {
        const message = orThrow(this.msg, "closeForumTopic");
        const thread = orThrow(message.message_thread_id, "closeForumTopic");
        return this.api.closeForumTopic(message.chat.id, thread, signal);
    }
    reopenForumTopic(signal) {
        const message = orThrow(this.msg, "reopenForumTopic");
        const thread = orThrow(message.message_thread_id, "reopenForumTopic");
        return this.api.reopenForumTopic(message.chat.id, thread, signal);
    }
    deleteForumTopic(signal) {
        const message = orThrow(this.msg, "deleteForumTopic");
        const thread = orThrow(message.message_thread_id, "deleteForumTopic");
        return this.api.deleteForumTopic(message.chat.id, thread, signal);
    }
    unpinAllForumTopicMessages(signal) {
        const message = orThrow(this.msg, "unpinAllForumTopicMessages");
        const thread = orThrow(message.message_thread_id, "unpinAllForumTopicMessages");
        return this.api.unpinAllForumTopicMessages(message.chat.id, thread, signal);
    }
    editGeneralForumTopic(name, signal) {
        return this.api.editGeneralForumTopic(orThrow(this.chatId, "editGeneralForumTopic"), name, signal);
    }
    closeGeneralForumTopic(signal) {
        return this.api.closeGeneralForumTopic(orThrow(this.chatId, "closeGeneralForumTopic"), signal);
    }
    reopenGeneralForumTopic(signal) {
        return this.api.reopenGeneralForumTopic(orThrow(this.chatId, "reopenGeneralForumTopic"), signal);
    }
    hideGeneralForumTopic(signal) {
        return this.api.hideGeneralForumTopic(orThrow(this.chatId, "hideGeneralForumTopic"), signal);
    }
    unhideGeneralForumTopic(signal) {
        return this.api.unhideGeneralForumTopic(orThrow(this.chatId, "unhideGeneralForumTopic"), signal);
    }
    unpinAllGeneralForumTopicMessages(signal) {
        return this.api.unpinAllGeneralForumTopicMessages(orThrow(this.chatId, "unpinAllGeneralForumTopicMessages"), signal);
    }
    answerCallbackQuery(other, signal) {
        return this.api.answerCallbackQuery(orThrow(this.callbackQuery, "answerCallbackQuery").id, typeof other === "string" ? {
            text: other
        } : other, signal);
    }
    setChatMenuButton(other, signal) {
        return this.api.setChatMenuButton(other, signal);
    }
    getChatMenuButton(other, signal) {
        return this.api.getChatMenuButton(other, signal);
    }
    setMyDefaultAdministratorRights(other, signal) {
        return this.api.setMyDefaultAdministratorRights(other, signal);
    }
    getMyDefaultAdministratorRights(other, signal) {
        return this.api.getMyDefaultAdministratorRights(other, signal);
    }
    editMessageText(text, other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== undefined ? this.api.editMessageTextInline(inlineId, text, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal) : this.api.editMessageText(orThrow(this.chatId, "editMessageText"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "editMessageText"), text, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal);
    }
    editMessageCaption(other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== undefined ? this.api.editMessageCaptionInline(inlineId, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal) : this.api.editMessageCaption(orThrow(this.chatId, "editMessageCaption"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "editMessageCaption"), {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal);
    }
    editMessageMedia(media, other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== undefined ? this.api.editMessageMediaInline(inlineId, media, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal) : this.api.editMessageMedia(orThrow(this.chatId, "editMessageMedia"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "editMessageMedia"), media, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal);
    }
    editMessageReplyMarkup(other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== undefined ? this.api.editMessageReplyMarkupInline(inlineId, {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal) : this.api.editMessageReplyMarkup(orThrow(this.chatId, "editMessageReplyMarkup"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "editMessageReplyMarkup"), {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal);
    }
    stopPoll(other, signal) {
        return this.api.stopPoll(orThrow(this.chatId, "stopPoll"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "stopPoll"), {
            business_connection_id: this.businessConnectionId,
            ...other
        }, signal);
    }
    deleteMessage(signal) {
        return this.api.deleteMessage(orThrow(this.chatId, "deleteMessage"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "deleteMessage"), signal);
    }
    deleteMessages(message_ids, signal) {
        return this.api.deleteMessages(orThrow(this.chatId, "deleteMessages"), message_ids, signal);
    }
    deleteBusinessMessages(message_ids, signal) {
        return this.api.deleteBusinessMessages(orThrow(this.businessConnectionId, "deleteBusinessMessages"), message_ids, signal);
    }
    setBusinessAccountName(first_name, other, signal) {
        return this.api.setBusinessAccountName(orThrow(this.businessConnectionId, "setBusinessAccountName"), first_name, other, signal);
    }
    setBusinessAccountUsername(username, signal) {
        return this.api.setBusinessAccountUsername(orThrow(this.businessConnectionId, "setBusinessAccountUsername"), username, signal);
    }
    setBusinessAccountBio(bio, signal) {
        return this.api.setBusinessAccountBio(orThrow(this.businessConnectionId, "setBusinessAccountBio"), bio, signal);
    }
    setBusinessAccountProfilePhoto(photo, other, signal) {
        return this.api.setBusinessAccountProfilePhoto(orThrow(this.businessConnectionId, "setBusinessAccountProfilePhoto"), photo, other, signal);
    }
    removeBusinessAccountProfilePhoto(other, signal) {
        return this.api.removeBusinessAccountProfilePhoto(orThrow(this.businessConnectionId, "removeBusinessAccountProfilePhoto"), other, signal);
    }
    setBusinessAccountGiftSettings(show_gift_button, accepted_gift_types, signal) {
        return this.api.setBusinessAccountGiftSettings(orThrow(this.businessConnectionId, "setBusinessAccountGiftSettings"), show_gift_button, accepted_gift_types, signal);
    }
    getBusinessAccountStarBalance(signal) {
        return this.api.getBusinessAccountStarBalance(orThrow(this.businessConnectionId, "getBusinessAccountStarBalance"), signal);
    }
    transferBusinessAccountStars(star_count, signal) {
        return this.api.transferBusinessAccountStars(orThrow(this.businessConnectionId, "transferBusinessAccountStars"), star_count, signal);
    }
    getBusinessAccountGifts(other, signal) {
        return this.api.getBusinessAccountGifts(orThrow(this.businessConnectionId, "getBusinessAccountGifts"), other, signal);
    }
    convertGiftToStars(owned_gift_id, signal) {
        return this.api.convertGiftToStars(orThrow(this.businessConnectionId, "convertGiftToStars"), owned_gift_id, signal);
    }
    upgradeGift(owned_gift_id, other, signal) {
        return this.api.upgradeGift(orThrow(this.businessConnectionId, "upgradeGift"), owned_gift_id, other, signal);
    }
    transferGift(owned_gift_id, new_owner_chat_id, star_count, signal) {
        return this.api.transferGift(orThrow(this.businessConnectionId, "transferGift"), owned_gift_id, new_owner_chat_id, star_count, signal);
    }
    postStory(content, active_period, other, signal) {
        return this.api.postStory(orThrow(this.businessConnectionId, "postStory"), content, active_period, other, signal);
    }
    repostStory(active_period, other, signal) {
        const story = orThrow(this.msg?.story, "repostStory");
        return this.api.repostStory(orThrow(this.businessConnectionId, "repostStory"), story.chat.id, story.id, active_period, other, signal);
    }
    editStory(story_id, content, other, signal) {
        return this.api.editStory(orThrow(this.businessConnectionId, "editStory"), story_id, content, other, signal);
    }
    deleteStory(story_id, signal) {
        return this.api.deleteStory(orThrow(this.businessConnectionId, "deleteStory"), story_id, signal);
    }
    replyWithSticker(sticker, other, signal) {
        const msg = this.msg;
        return this.api.sendSticker(orThrow(this.chatId, "sendSticker"), sticker, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    getCustomEmojiStickers(signal) {
        return this.api.getCustomEmojiStickers((this.msg?.entities ?? []).filter((e)=>e.type === "custom_emoji").map((e)=>e.custom_emoji_id), signal);
    }
    replyWithGift(gift_id, other, signal) {
        return this.api.sendGift(orThrow(this.from, "sendGift").id, gift_id, other, signal);
    }
    giftPremiumSubscription(month_count, star_count, other, signal) {
        return this.api.giftPremiumSubscription(orThrow(this.from, "giftPremiumSubscription").id, month_count, star_count, other, signal);
    }
    replyWithGiftToChannel(gift_id, other, signal) {
        return this.api.sendGiftToChannel(orThrow(this.chat, "sendGift").id, gift_id, other, signal);
    }
    answerInlineQuery(results, other, signal) {
        return this.api.answerInlineQuery(orThrow(this.inlineQuery, "answerInlineQuery").id, results, other, signal);
    }
    savePreparedInlineMessage(result, other, signal) {
        return this.api.savePreparedInlineMessage(orThrow(this.from, "savePreparedInlineMessage").id, result, other, signal);
    }
    replyWithInvoice(title, description, payload, currency, prices, other, signal) {
        const msg = this.msg;
        return this.api.sendInvoice(orThrow(this.chatId, "sendInvoice"), title, description, payload, currency, prices, {
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
            ...other
        }, signal);
    }
    answerShippingQuery(ok, other, signal) {
        return this.api.answerShippingQuery(orThrow(this.shippingQuery, "answerShippingQuery").id, ok, other, signal);
    }
    answerPreCheckoutQuery(ok, other, signal) {
        return this.api.answerPreCheckoutQuery(orThrow(this.preCheckoutQuery, "answerPreCheckoutQuery").id, ok, typeof other === "string" ? {
            error_message: other
        } : other, signal);
    }
    refundStarPayment(signal) {
        return this.api.refundStarPayment(orThrow(this.from, "refundStarPayment").id, orThrow(this.msg?.successful_payment, "refundStarPayment").telegram_payment_charge_id, signal);
    }
    editUserStarSubscription(telegram_payment_charge_id, is_canceled, signal) {
        return this.api.editUserStarSubscription(orThrow(this.from, "editUserStarSubscription").id, telegram_payment_charge_id, is_canceled, signal);
    }
    verifyUser(other, signal) {
        return this.api.verifyUser(orThrow(this.from, "verifyUser").id, other, signal);
    }
    verifyChat(other, signal) {
        return this.api.verifyChat(orThrow(this.chatId, "verifyChat"), other, signal);
    }
    removeUserVerification(signal) {
        return this.api.removeUserVerification(orThrow(this.from, "removeUserVerification").id, signal);
    }
    removeChatVerification(signal) {
        return this.api.removeChatVerification(orThrow(this.chatId, "removeChatVerification"), signal);
    }
    readBusinessMessage(signal) {
        return this.api.readBusinessMessage(orThrow(this.businessConnectionId, "readBusinessMessage"), orThrow(this.chatId, "readBusinessMessage"), orThrow(this.msgId, "readBusinessMessage"), signal);
    }
    setPassportDataErrors(errors, signal) {
        return this.api.setPassportDataErrors(orThrow(this.from, "setPassportDataErrors").id, errors, signal);
    }
    replyWithGame(game_short_name, other, signal) {
        const msg = this.msg;
        return this.api.sendGame(orThrow(this.chatId, "sendGame"), game_short_name, {
            business_connection_id: this.businessConnectionId,
            ...msg?.is_topic_message ? {
                message_thread_id: msg.message_thread_id
            } : {},
            ...other
        }, signal);
    }
}
function orThrow(value, method) {
    if (value === undefined) {
        throw new Error(`Missing information for API call to ${method}`);
    }
    return value;
}
function triggerFn(trigger) {
    return toArray(trigger).map((t)=>typeof t === "string" ? (txt)=>txt === t ? t : null : (txt)=>txt.match(t));
}
function match(ctx, content, triggers) {
    for (const t of triggers){
        const res = t(content);
        if (res) {
            ctx.match = res;
            return true;
        }
    }
    return false;
}
function toArray(e) {
    return Array.isArray(e) ? e : [
        e
    ];
}
class BotError extends Error {
    error;
    ctx;
    constructor(error, ctx){
        super(generateBotErrorMessage(error));
        this.error = error;
        this.ctx = ctx;
        this.name = "BotError";
        if (error instanceof Error) this.stack = error.stack;
    }
}
function generateBotErrorMessage(error) {
    let msg;
    if (error instanceof Error) {
        msg = `${error.name} in middleware: ${error.message}`;
    } else {
        const type = typeof error;
        msg = `Non-error value of type ${type} thrown in middleware`;
        switch(type){
            case "bigint":
            case "boolean":
            case "number":
            case "symbol":
                msg += `: ${error}`;
                break;
            case "string":
                msg += `: ${String(error).substring(0, 50)}`;
                break;
            default:
                msg += "!";
                break;
        }
    }
    return msg;
}
function flatten(mw) {
    return typeof mw === "function" ? mw : (ctx, next)=>mw.middleware()(ctx, next);
}
function concat1(first, andThen) {
    return async (ctx, next)=>{
        let nextCalled = false;
        await first(ctx, async ()=>{
            if (nextCalled) throw new Error("`next` already called before!");
            else nextCalled = true;
            await andThen(ctx, next);
        });
    };
}
function pass(_ctx, next) {
    return next();
}
const leaf1 = ()=>Promise.resolve();
async function run(middleware, ctx) {
    await middleware(ctx, leaf1);
}
class Composer {
    handler;
    constructor(...middleware){
        this.handler = middleware.length === 0 ? pass : middleware.map(flatten).reduce(concat1);
    }
    middleware() {
        return this.handler;
    }
    use(...middleware) {
        const composer = new Composer(...middleware);
        this.handler = concat1(this.handler, flatten(composer));
        return composer;
    }
    on(filter, ...middleware) {
        return this.filter(Context.has.filterQuery(filter), ...middleware);
    }
    hears(trigger, ...middleware) {
        return this.filter(Context.has.text(trigger), ...middleware);
    }
    command(command, ...middleware) {
        return this.filter(Context.has.command(command), ...middleware);
    }
    reaction(reaction, ...middleware) {
        return this.filter(Context.has.reaction(reaction), ...middleware);
    }
    chatType(chatType, ...middleware) {
        return this.filter(Context.has.chatType(chatType), ...middleware);
    }
    callbackQuery(trigger, ...middleware) {
        return this.filter(Context.has.callbackQuery(trigger), ...middleware);
    }
    gameQuery(trigger, ...middleware) {
        return this.filter(Context.has.gameQuery(trigger), ...middleware);
    }
    inlineQuery(trigger, ...middleware) {
        return this.filter(Context.has.inlineQuery(trigger), ...middleware);
    }
    chosenInlineResult(resultId, ...middleware) {
        return this.filter(Context.has.chosenInlineResult(resultId), ...middleware);
    }
    preCheckoutQuery(trigger, ...middleware) {
        return this.filter(Context.has.preCheckoutQuery(trigger), ...middleware);
    }
    shippingQuery(trigger, ...middleware) {
        return this.filter(Context.has.shippingQuery(trigger), ...middleware);
    }
    filter(predicate, ...middleware) {
        const composer = new Composer(...middleware);
        this.branch(predicate, composer, pass);
        return composer;
    }
    drop(predicate, ...middleware) {
        return this.filter(async (ctx)=>!await predicate(ctx), ...middleware);
    }
    fork(...middleware) {
        const composer = new Composer(...middleware);
        const fork = flatten(composer);
        this.use((ctx, next)=>Promise.all([
                next(),
                run(fork, ctx)
            ]));
        return composer;
    }
    lazy(middlewareFactory) {
        return this.use(async (ctx, next)=>{
            const middleware = await middlewareFactory(ctx);
            const arr = Array.isArray(middleware) ? middleware : [
                middleware
            ];
            await flatten(new Composer(...arr))(ctx, next);
        });
    }
    route(router, routeHandlers, fallback = pass) {
        return this.lazy(async (ctx)=>{
            const route = await router(ctx);
            return (route === undefined || !routeHandlers[route] ? fallback : routeHandlers[route]) ?? [];
        });
    }
    branch(predicate, trueMiddleware, falseMiddleware) {
        return this.lazy(async (ctx)=>await predicate(ctx) ? trueMiddleware : falseMiddleware);
    }
    errorBoundary(errorHandler, ...middleware) {
        const composer = new Composer(...middleware);
        const bound = flatten(composer);
        this.use(async (ctx, next)=>{
            let nextCalled = false;
            const cont = ()=>(nextCalled = true, Promise.resolve());
            try {
                await bound(ctx, cont);
            } catch (err) {
                nextCalled = false;
                await errorHandler(new BotError(err, ctx), cont);
            }
            if (nextCalled) await next();
        });
        return composer;
    }
}
var s = 1e3;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;
var ms = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
        return parse1(val);
    } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
};
function parse1(str) {
    str = String(str);
    if (str.length > 100) {
        return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
        return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch(type){
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
            return n * y;
        case "weeks":
        case "week":
        case "w":
            return n * w;
        case "days":
        case "day":
        case "d":
            return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
            return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
            return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
            return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
            return n;
        default:
            return void 0;
    }
}
function fmtShort(ms2) {
    var msAbs = Math.abs(ms2);
    if (msAbs >= d) {
        return Math.round(ms2 / d) + "d";
    }
    if (msAbs >= h) {
        return Math.round(ms2 / h) + "h";
    }
    if (msAbs >= m) {
        return Math.round(ms2 / m) + "m";
    }
    if (msAbs >= s) {
        return Math.round(ms2 / s) + "s";
    }
    return ms2 + "ms";
}
function fmtLong(ms2) {
    var msAbs = Math.abs(ms2);
    if (msAbs >= d) {
        return plural(ms2, msAbs, d, "day");
    }
    if (msAbs >= h) {
        return plural(ms2, msAbs, h, "hour");
    }
    if (msAbs >= m) {
        return plural(ms2, msAbs, m, "minute");
    }
    if (msAbs >= s) {
        return plural(ms2, msAbs, s, "second");
    }
    return ms2 + " ms";
}
function plural(ms2, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms2 / n) + " " + name + (isPlural ? "s" : "");
}
function defaultSetTimout() {
    throw new Error("setTimeout has not been defined");
}
function defaultClearTimeout() {
    throw new Error("clearTimeout has not been defined");
}
var cachedSetTimeout = defaultSetTimout;
var cachedClearTimeout = defaultClearTimeout;
var globalContext;
if (typeof window !== "undefined") {
    globalContext = window;
} else if (typeof self !== "undefined") {
    globalContext = self;
} else {
    globalContext = {};
}
if (typeof globalContext.setTimeout === "function") {
    cachedSetTimeout = setTimeout;
}
if (typeof globalContext.clearTimeout === "function") {
    cachedClearTimeout = clearTimeout;
}
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        return setTimeout(fun, 0);
    }
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        return cachedSetTimeout(fun, 0);
    } catch (e) {
        try {
            return cachedSetTimeout.call(null, fun, 0);
        } catch (e2) {
            return cachedSetTimeout.call(this, fun, 0);
        }
    }
}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        return clearTimeout(marker);
    }
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        return cachedClearTimeout(marker);
    } catch (e) {
        try {
            return cachedClearTimeout.call(null, marker);
        } catch (e2) {
            return cachedClearTimeout.call(this, marker);
        }
    }
}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;
function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}
function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;
    var len = queue.length;
    while(len){
        currentQueue = queue;
        queue = [];
        while(++queueIndex < len){
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}
function nextTick(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for(var i = 1; i < arguments.length; i++){
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
}
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function() {
    this.fun.apply(null, this.array);
};
var title = "browser";
var platform = "browser";
var browser = true;
var argv = [];
var version = "";
var versions = {};
var release = {};
var config = {};
function noop() {}
var on = noop;
var addListener = noop;
var once = noop;
var off = noop;
var removeListener = noop;
var removeAllListeners = noop;
var emit = noop;
function binding(name) {
    throw new Error("process.binding is not supported");
}
function cwd() {
    return "/";
}
function chdir(dir) {
    throw new Error("process.chdir is not supported");
}
function umask() {
    return 0;
}
var performance = globalContext.performance || {};
var performanceNow = performance.now || performance.mozNow || performance.msNow || performance.oNow || performance.webkitNow || function() {
    return new Date().getTime();
};
function hrtime(previousTimestamp) {
    var clocktime = performanceNow.call(performance) * 1e-3;
    var seconds = Math.floor(clocktime);
    var nanoseconds = Math.floor(clocktime % 1 * 1e9);
    if (previousTimestamp) {
        seconds = seconds - previousTimestamp[0];
        nanoseconds = nanoseconds - previousTimestamp[1];
        if (nanoseconds < 0) {
            seconds--;
            nanoseconds += 1e9;
        }
    }
    return [
        seconds,
        nanoseconds
    ];
}
var startTime = new Date();
function uptime() {
    var currentTime = new Date();
    var dif = currentTime - startTime;
    return dif / 1e3;
}
var process = {
    nextTick,
    title,
    browser,
    env: {
        NODE_ENV: "production"
    },
    argv,
    version,
    versions,
    on,
    addListener,
    once,
    off,
    removeListener,
    removeAllListeners,
    emit,
    binding,
    cwd,
    chdir,
    umask,
    hrtime,
    platform,
    release,
    config,
    uptime
};
function createCommonjsModule(fn, basedir, module) {
    return module = {
        path: basedir,
        exports: {},
        require: function(path, base) {
            return commonjsRequire(path, base === void 0 || base === null ? module.path : base);
        }
    }, fn(module, module.exports), module.exports;
}
function commonjsRequire() {
    throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
}
function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = ms;
    createDebug.destroy = destroy2;
    Object.keys(env).forEach((key)=>{
        createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
        let hash = 0;
        for(let i = 0; i < namespace.length; i++){
            hash = (hash << 5) - hash + namespace.charCodeAt(i);
            hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
            if (!debug.enabled) {
                return;
            }
            const self2 = debug;
            const curr = Number(new Date());
            const ms2 = curr - (prevTime || curr);
            self2.diff = ms2;
            self2.prev = prevTime;
            self2.curr = curr;
            prevTime = curr;
            args[0] = createDebug.coerce(args[0]);
            if (typeof args[0] !== "string") {
                args.unshift("%O");
            }
            let index = 0;
            args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format)=>{
                if (match === "%%") {
                    return "%";
                }
                index++;
                const formatter = createDebug.formatters[format];
                if (typeof formatter === "function") {
                    const val = args[index];
                    match = formatter.call(self2, val);
                    args.splice(index, 1);
                    index--;
                }
                return match;
            });
            createDebug.formatArgs.call(self2, args);
            const logFn = self2.log || createDebug.log;
            logFn.apply(self2, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy;
        Object.defineProperty(debug, "enabled", {
            enumerable: true,
            configurable: false,
            get: ()=>{
                if (enableOverride !== null) {
                    return enableOverride;
                }
                if (namespacesCache !== createDebug.namespaces) {
                    namespacesCache = createDebug.namespaces;
                    enabledCache = createDebug.enabled(namespace);
                }
                return enabledCache;
            },
            set: (v)=>{
                enableOverride = v;
            }
        });
        if (typeof createDebug.init === "function") {
            createDebug.init(debug);
        }
        return debug;
    }
    function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
    }
    function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split){
            if (ns[0] === "-") {
                createDebug.skips.push(ns.slice(1));
            } else {
                createDebug.names.push(ns);
            }
        }
    }
    function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while(searchIndex < search.length){
            if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
                if (template[templateIndex] === "*") {
                    starIndex = templateIndex;
                    matchIndex = searchIndex;
                    templateIndex++;
                } else {
                    searchIndex++;
                    templateIndex++;
                }
            } else if (starIndex !== -1) {
                templateIndex = starIndex + 1;
                matchIndex++;
                searchIndex = matchIndex;
            } else {
                return false;
            }
        }
        while(templateIndex < template.length && template[templateIndex] === "*"){
            templateIndex++;
        }
        return templateIndex === template.length;
    }
    function disable() {
        const namespaces = [
            ...createDebug.names,
            ...createDebug.skips.map((namespace)=>"-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
    }
    function enabled(name) {
        for (const skip of createDebug.skips){
            if (matchesTemplate(name, skip)) {
                return false;
            }
        }
        for (const ns of createDebug.names){
            if (matchesTemplate(name, ns)) {
                return true;
            }
        }
        return false;
    }
    function coerce(val) {
        if (val instanceof Error) {
            return val.stack || val.message;
        }
        return val;
    }
    function destroy2() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
}
var common = setup;
var browser$1 = createCommonjsModule(function(module, exports) {
    exports.formatArgs = formatArgs2;
    exports.save = save2;
    exports.load = load2;
    exports.useColors = useColors2;
    exports.storage = localstorage();
    exports.destroy = (()=>{
        let warned = false;
        return ()=>{
            if (!warned) {
                warned = true;
                console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
            }
        };
    })();
    exports.colors = [
        "#0000CC",
        "#0000FF",
        "#0033CC",
        "#0033FF",
        "#0066CC",
        "#0066FF",
        "#0099CC",
        "#0099FF",
        "#00CC00",
        "#00CC33",
        "#00CC66",
        "#00CC99",
        "#00CCCC",
        "#00CCFF",
        "#3300CC",
        "#3300FF",
        "#3333CC",
        "#3333FF",
        "#3366CC",
        "#3366FF",
        "#3399CC",
        "#3399FF",
        "#33CC00",
        "#33CC33",
        "#33CC66",
        "#33CC99",
        "#33CCCC",
        "#33CCFF",
        "#6600CC",
        "#6600FF",
        "#6633CC",
        "#6633FF",
        "#66CC00",
        "#66CC33",
        "#9900CC",
        "#9900FF",
        "#9933CC",
        "#9933FF",
        "#99CC00",
        "#99CC33",
        "#CC0000",
        "#CC0033",
        "#CC0066",
        "#CC0099",
        "#CC00CC",
        "#CC00FF",
        "#CC3300",
        "#CC3333",
        "#CC3366",
        "#CC3399",
        "#CC33CC",
        "#CC33FF",
        "#CC6600",
        "#CC6633",
        "#CC9900",
        "#CC9933",
        "#CCCC00",
        "#CCCC33",
        "#FF0000",
        "#FF0033",
        "#FF0066",
        "#FF0099",
        "#FF00CC",
        "#FF00FF",
        "#FF3300",
        "#FF3333",
        "#FF3366",
        "#FF3399",
        "#FF33CC",
        "#FF33FF",
        "#FF6600",
        "#FF6633",
        "#FF9900",
        "#FF9933",
        "#FFCC00",
        "#FFCC33"
    ];
    function useColors2() {
        if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
            return true;
        }
        if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
            return false;
        }
        let m;
        return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs2(args) {
        args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
        if (!this.useColors) {
            return;
        }
        const c = "color: " + this.color;
        args.splice(1, 0, c, "color: inherit");
        let index = 0;
        let lastC = 0;
        args[0].replace(/%[a-zA-Z%]/g, (match)=>{
            if (match === "%%") {
                return;
            }
            index++;
            if (match === "%c") {
                lastC = index;
            }
        });
        args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (()=>{});
    function save2(namespaces) {
        try {
            if (namespaces) {
                exports.storage.setItem("debug", namespaces);
            } else {
                exports.storage.removeItem("debug");
            }
        } catch (error) {}
    }
    function load2() {
        let r;
        try {
            r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
        } catch (error) {}
        if (!r && typeof process !== "undefined" && "env" in process) {
            r = process.env.DEBUG;
        }
        return r;
    }
    function localstorage() {
        try {
            return localStorage;
        } catch (error) {}
    }
    module.exports = common(exports);
    const { formatters } = module.exports;
    formatters.j = function(v) {
        try {
            return JSON.stringify(v);
        } catch (error) {
            return "[UnexpectedJSONParseError]: " + error.message;
        }
    };
});
browser$1.colors;
browser$1.destroy;
browser$1.formatArgs;
browser$1.load;
browser$1.log;
browser$1.save;
browser$1.storage;
browser$1.useColors;
const itrToStream = (itr)=>{
    const it = itr[Symbol.asyncIterator]();
    return new ReadableStream({
        async pull (controller) {
            const chunk = await it.next();
            if (chunk.done) controller.close();
            else controller.enqueue(chunk.value);
        }
    });
};
const baseFetchConfig = (_apiRoot)=>({});
const defaultAdapter = "cloudflare";
const debug = browser$1("grammy:warn");
class GrammyError extends Error {
    method;
    payload;
    ok;
    error_code;
    description;
    parameters;
    constructor(message, err, method, payload){
        super(`${message} (${err.error_code}: ${err.description})`);
        this.method = method;
        this.payload = payload;
        this.ok = false;
        this.name = "GrammyError";
        this.error_code = err.error_code;
        this.description = err.description;
        this.parameters = err.parameters ?? {};
    }
}
function toGrammyError(err, method, payload) {
    switch(err.error_code){
        case 401:
            debug("Error 401 means that your bot token is wrong, talk to https://t.me/BotFather to check it.");
            break;
        case 409:
            debug("Error 409 means that you are running your bot several times on long polling. Consider revoking the bot token if you believe that no other instance is running.");
            break;
    }
    return new GrammyError(`Call to '${method}' failed!`, err, method, payload);
}
class HttpError extends Error {
    error;
    constructor(message, error){
        super(message);
        this.error = error;
        this.name = "HttpError";
    }
}
function isTelegramError(err) {
    return typeof err === "object" && err !== null && "status" in err && "statusText" in err;
}
function toHttpError(method, sensitiveLogs) {
    return (err)=>{
        let msg = `Network request for '${method}' failed!`;
        if (isTelegramError(err)) msg += ` (${err.status}: ${err.statusText})`;
        if (sensitiveLogs && err instanceof Error) msg += ` ${err.message}`;
        throw new HttpError(msg, err);
    };
}
function checkWindows() {
    const global = globalThis;
    const os = global.Deno?.build?.os;
    return typeof os === "string" ? os === "windows" : global.navigator?.platform?.startsWith("Win") ?? global.process?.platform?.startsWith("win") ?? false;
}
const isWindows = checkWindows();
function assertPath(path) {
    if (typeof path !== "string") {
        throw new TypeError(`Path must be a string, received "${JSON.stringify(path)}"`);
    }
}
function stripSuffix(name, suffix) {
    if (suffix.length >= name.length) {
        return name;
    }
    const lenDiff = name.length - suffix.length;
    for(let i = suffix.length - 1; i >= 0; --i){
        if (name.charCodeAt(lenDiff + i) !== suffix.charCodeAt(i)) {
            return name;
        }
    }
    return name.slice(0, -suffix.length);
}
function lastPathSegment(path, isSep, start = 0) {
    let matchedNonSeparator = false;
    let end = path.length;
    for(let i = path.length - 1; i >= start; --i){
        if (isSep(path.charCodeAt(i))) {
            if (matchedNonSeparator) {
                start = i + 1;
                break;
            }
        } else if (!matchedNonSeparator) {
            matchedNonSeparator = true;
            end = i + 1;
        }
    }
    return path.slice(start, end);
}
function assertArgs(path, suffix) {
    assertPath(path);
    if (path.length === 0) return path;
    if (typeof suffix !== "string") {
        throw new TypeError(`Suffix must be a string, received "${JSON.stringify(suffix)}"`);
    }
}
function assertArg(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol !== "file:") {
        throw new TypeError(`URL must be a file URL: received "${url.protocol}"`);
    }
    return url;
}
function fromFileUrl(url) {
    url = assertArg(url);
    return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}
function stripTrailingSeparators(segment, isSep) {
    if (segment.length <= 1) {
        return segment;
    }
    let end = segment.length;
    for(let i = segment.length - 1; i > 0; i--){
        if (isSep(segment.charCodeAt(i))) {
            end = i;
        } else {
            break;
        }
    }
    return segment.slice(0, end);
}
function isPosixPathSeparator(code) {
    return code === 47;
}
function basename(path, suffix = "") {
    if (path instanceof URL) {
        path = fromFileUrl(path);
    }
    assertArgs(path, suffix);
    const lastSegment = lastPathSegment(path, isPosixPathSeparator);
    const strippedSegment = stripTrailingSeparators(lastSegment, isPosixPathSeparator);
    return suffix ? stripSuffix(strippedSegment, suffix) : strippedSegment;
}
function isPathSeparator(code) {
    return code === 47 || code === 92;
}
function isWindowsDeviceRoot(code) {
    return code >= 97 && code <= 122 || code >= 65 && code <= 90;
}
function fromFileUrl1(url) {
    url = assertArg(url);
    let path = decodeURIComponent(url.pathname.replace(/\//g, "\\").replace(/%(?![0-9A-Fa-f]{2})/g, "%25")).replace(/^\\*([A-Za-z]:)(\\|$)/, "$1\\");
    if (url.hostname !== "") {
        path = `\\\\${url.hostname}${path}`;
    }
    return path;
}
function basename1(path, suffix = "") {
    if (path instanceof URL) {
        path = fromFileUrl1(path);
    }
    assertArgs(path, suffix);
    let start = 0;
    if (path.length >= 2) {
        const drive = path.charCodeAt(0);
        if (isWindowsDeviceRoot(drive)) {
            if (path.charCodeAt(1) === 58) start = 2;
        }
    }
    const lastSegment = lastPathSegment(path, isPathSeparator, start);
    const strippedSegment = stripTrailingSeparators(lastSegment, isPathSeparator);
    return suffix ? stripSuffix(strippedSegment, suffix) : strippedSegment;
}
function basename2(path, suffix = "") {
    return isWindows ? basename1(path, suffix) : basename(path, suffix);
}
class InputFile {
    consumed = false;
    fileData;
    filename;
    constructor(file, filename){
        this.fileData = file;
        filename ??= this.guessFilename(file);
        this.filename = filename;
    }
    guessFilename(file) {
        if (typeof file === "string") return basename2(file);
        if (typeof file !== "object") return undefined;
        if ("url" in file) return basename2(file.url);
        if (!(file instanceof URL)) return undefined;
        return basename2(file.pathname) || basename2(file.hostname);
    }
    toRaw() {
        if (this.consumed) {
            throw new Error("Cannot reuse InputFile data source!");
        }
        const data = this.fileData;
        if (data instanceof Blob) return data.stream();
        if (data instanceof URL) return fetchFile(data);
        if ("url" in data) return fetchFile(data.url);
        if (!(data instanceof Uint8Array)) this.consumed = true;
        return data;
    }
    toJSON() {
        throw new Error("InputFile instances must be sent via grammY");
    }
}
async function* fetchFile(url) {
    const { body } = await fetch(url);
    if (body === null) {
        throw new Error(`Download failed, no response body from '${url}'`);
    }
    yield* body;
}
function requiresFormDataUpload(payload) {
    return payload instanceof InputFile || typeof payload === "object" && payload !== null && Object.values(payload).some((v)=>Array.isArray(v) ? v.some(requiresFormDataUpload) : v instanceof InputFile || requiresFormDataUpload(v));
}
function str(value) {
    return JSON.stringify(value, (_, v)=>v ?? undefined);
}
function createJsonPayload(payload) {
    return {
        method: "POST",
        headers: {
            "content-type": "application/json",
            connection: "keep-alive"
        },
        body: str(payload)
    };
}
async function* protectItr(itr, onError) {
    try {
        yield* itr;
    } catch (err) {
        onError(err);
    }
}
function createFormDataPayload(payload, onError) {
    const boundary = createBoundary();
    const itr = payloadToMultipartItr(payload, boundary);
    const safeItr = protectItr(itr, onError);
    const stream = itrToStream(safeItr);
    return {
        method: "POST",
        headers: {
            "content-type": `multipart/form-data; boundary=${boundary}`,
            connection: "keep-alive"
        },
        body: stream
    };
}
function createBoundary() {
    return "----------" + randomId(32);
}
function randomId(length = 16) {
    return Array.from(Array(length)).map(()=>Math.random().toString(36)[2] || 0).join("");
}
const enc = new TextEncoder();
async function* payloadToMultipartItr(payload, boundary) {
    const files = collectFiles(payload);
    yield enc.encode(`--${boundary}\r\n`);
    const separator = enc.encode(`\r\n--${boundary}\r\n`);
    let first = true;
    for (const [key, value] of Object.entries(payload)){
        if (value == null) continue;
        if (!first) yield separator;
        yield valuePart(key, value instanceof InputFile ? value.toJSON() : typeof value === "object" ? str(value) : value);
        first = false;
    }
    for (const { id, origin, file } of files){
        if (!first) yield separator;
        yield* filePart(id, origin, file);
        first = false;
    }
    yield enc.encode(`\r\n--${boundary}--\r\n`);
}
function collectFiles(value) {
    if (typeof value !== "object" || value === null) return [];
    return Object.entries(value).flatMap(([k, v])=>{
        if (Array.isArray(v)) return v.flatMap((p)=>collectFiles(p));
        else if (v instanceof InputFile) {
            const id = randomId();
            Object.assign(v, {
                toJSON: ()=>`attach://${id}`
            });
            const origin = k === "media" && "type" in value && typeof value.type === "string" ? value.type : k;
            return {
                id,
                origin,
                file: v
            };
        } else return collectFiles(v);
    });
}
function valuePart(key, value) {
    return enc.encode(`content-disposition:form-data;name="${key}"\r\n\r\n${value}`);
}
async function* filePart(id, origin, input) {
    const filename = input.filename || `${origin}.${getExt(origin)}`;
    if (filename.includes("\r") || filename.includes("\n")) {
        throw new Error(`File paths cannot contain carriage-return (\\r) \
or newline (\\n) characters! Filename for property '${origin}' was:
"""
${filename}
"""`);
    }
    yield enc.encode(`content-disposition:form-data;name="${id}";filename=${filename}\r\ncontent-type:application/octet-stream\r\n\r\n`);
    const data = await input.toRaw();
    if (data instanceof Uint8Array) yield data;
    else yield* data;
}
function getExt(key) {
    switch(key){
        case "certificate":
            return "pem";
        case "photo":
        case "thumbnail":
            return "jpg";
        case "voice":
            return "ogg";
        case "audio":
            return "mp3";
        case "animation":
        case "video":
        case "video_note":
            return "mp4";
        case "sticker":
            return "webp";
        default:
            return "dat";
    }
}
const debug1 = browser$1("grammy:core");
function concatTransformer(prev, trans) {
    return (method, payload, signal)=>trans(prev, method, payload, signal);
}
class ApiClient {
    token;
    webhookReplyEnvelope;
    options;
    fetch;
    hasUsedWebhookReply;
    installedTransformers;
    constructor(token, options = {}, webhookReplyEnvelope = {}){
        this.token = token;
        this.webhookReplyEnvelope = webhookReplyEnvelope;
        this.hasUsedWebhookReply = false;
        this.installedTransformers = [];
        this.call = async (method, p, signal)=>{
            const payload = p ?? {};
            debug1(`Calling ${method}`);
            if (signal !== undefined) validateSignal(method, payload, signal);
            const opts = this.options;
            const formDataRequired = requiresFormDataUpload(payload);
            if (this.webhookReplyEnvelope.send !== undefined && !this.hasUsedWebhookReply && !formDataRequired && opts.canUseWebhookReply(method)) {
                this.hasUsedWebhookReply = true;
                const config = createJsonPayload({
                    ...payload,
                    method
                });
                await this.webhookReplyEnvelope.send(config.body);
                return {
                    ok: true,
                    result: true
                };
            }
            const controller = createAbortControllerFromSignal(signal);
            const timeout = createTimeout(controller, opts.timeoutSeconds, method);
            const streamErr = createStreamError(controller);
            const url = opts.buildUrl(opts.apiRoot, this.token, method, opts.environment);
            const config = formDataRequired ? createFormDataPayload(payload, (err)=>streamErr.catch(err)) : createJsonPayload(payload);
            const sig = controller.signal;
            const options = {
                ...opts.baseFetchConfig,
                signal: sig,
                ...config
            };
            const successPromise = this.fetch(url instanceof URL ? url.href : url, options).catch(toHttpError(method, opts.sensitiveLogs));
            const operations = [
                successPromise,
                streamErr.promise,
                timeout.promise
            ];
            try {
                const res = await Promise.race(operations);
                return await res.json();
            } finally{
                if (timeout.handle !== undefined) clearTimeout(timeout.handle);
            }
        };
        const apiRoot = options.apiRoot ?? "https://api.telegram.org";
        const environment = options.environment ?? "prod";
        const { fetch: customFetch } = options;
        const fetchFn = customFetch ?? fetch;
        this.options = {
            apiRoot,
            environment,
            buildUrl: options.buildUrl ?? defaultBuildUrl,
            timeoutSeconds: options.timeoutSeconds ?? 500,
            baseFetchConfig: {
                ...baseFetchConfig(apiRoot),
                ...options.baseFetchConfig
            },
            canUseWebhookReply: options.canUseWebhookReply ?? (()=>false),
            sensitiveLogs: options.sensitiveLogs ?? false,
            fetch: (...args)=>fetchFn(...args)
        };
        this.fetch = this.options.fetch;
        if (this.options.apiRoot.endsWith("/")) {
            throw new Error(`Remove the trailing '/' from the 'apiRoot' option (use '${this.options.apiRoot.substring(0, this.options.apiRoot.length - 1)}' instead of '${this.options.apiRoot}')`);
        }
    }
    call;
    use(...transformers) {
        this.call = transformers.reduce(concatTransformer, this.call);
        this.installedTransformers.push(...transformers);
        return this;
    }
    async callApi(method, payload, signal) {
        const data = await this.call(method, payload, signal);
        if (data.ok) return data.result;
        else throw toGrammyError(data, method, payload);
    }
}
function createRawApi(token, options, webhookReplyEnvelope) {
    const client = new ApiClient(token, options, webhookReplyEnvelope);
    const proxyHandler = {
        get (_, m) {
            return m === "toJSON" ? "__internal" : m === "getMe" || m === "getWebhookInfo" || m === "getForumTopicIconStickers" || m === "getAvailableGifts" || m === "logOut" || m === "close" || m === "getMyStarBalance" || m === "removeMyProfilePhoto" ? client.callApi.bind(client, m, {}) : client.callApi.bind(client, m);
        },
        ...proxyMethods
    };
    const raw = new Proxy({}, proxyHandler);
    const installedTransformers = client.installedTransformers;
    const api = {
        raw,
        installedTransformers,
        use: (...t)=>{
            client.use(...t);
            return api;
        }
    };
    return api;
}
const defaultBuildUrl = (root, token, method, env)=>{
    const prefix = env === "test" ? "test/" : "";
    return `${root}/bot${token}/${prefix}${method}`;
};
const proxyMethods = {
    set () {
        return false;
    },
    defineProperty () {
        return false;
    },
    deleteProperty () {
        return false;
    },
    ownKeys () {
        return [];
    }
};
function createTimeout(controller, seconds, method) {
    let handle = undefined;
    const promise = new Promise((_, reject)=>{
        handle = setTimeout(()=>{
            const msg = `Request to '${method}' timed out after ${seconds} seconds`;
            reject(new Error(msg));
            controller.abort();
        }, 1000 * seconds);
    });
    return {
        promise,
        handle
    };
}
function createStreamError(abortController) {
    let onError = (err)=>{
        throw err;
    };
    const promise = new Promise((_, reject)=>{
        onError = (err)=>{
            reject(err);
            abortController.abort();
        };
    });
    return {
        promise,
        catch: onError
    };
}
function createAbortControllerFromSignal(signal) {
    const abortController = new AbortController();
    if (signal === undefined) return abortController;
    const sig = signal;
    function abort() {
        abortController.abort();
        sig.removeEventListener("abort", abort);
    }
    if (sig.aborted) abort();
    else sig.addEventListener("abort", abort);
    return {
        abort,
        signal: abortController.signal
    };
}
function validateSignal(method, payload, signal) {
    if (typeof signal?.addEventListener === "function") {
        return;
    }
    let payload0 = JSON.stringify(payload);
    if (payload0.length > 20) {
        payload0 = payload0.substring(0, 16) + " ...";
    }
    let payload1 = JSON.stringify(signal);
    if (payload1.length > 20) {
        payload1 = payload1.substring(0, 16) + " ...";
    }
    throw new Error(`Incorrect abort signal instance found! \
You passed two payloads to '${method}' but you should merge \
the second one containing '${payload1}' into the first one \
containing '${payload0}'! If you are using context shortcuts, \
you may want to use a method on 'ctx.api' instead.

If you want to prevent such mistakes in the future, \
consider using TypeScript. https://www.typescriptlang.org/`);
}
class Api {
    token;
    options;
    raw;
    config;
    constructor(token, options, webhookReplyEnvelope){
        this.token = token;
        this.options = options;
        const { raw, use, installedTransformers } = createRawApi(token, options, webhookReplyEnvelope);
        this.raw = raw;
        this.config = {
            use,
            installedTransformers: ()=>installedTransformers.slice()
        };
    }
    getUpdates(other, signal) {
        return this.raw.getUpdates({
            ...other
        }, signal);
    }
    setWebhook(url, other, signal) {
        return this.raw.setWebhook({
            url,
            ...other
        }, signal);
    }
    deleteWebhook(other, signal) {
        return this.raw.deleteWebhook({
            ...other
        }, signal);
    }
    getWebhookInfo(signal) {
        return this.raw.getWebhookInfo(signal);
    }
    getMe(signal) {
        return this.raw.getMe(signal);
    }
    logOut(signal) {
        return this.raw.logOut(signal);
    }
    close(signal) {
        return this.raw.close(signal);
    }
    sendMessage(chat_id, text, other, signal) {
        return this.raw.sendMessage({
            chat_id,
            text,
            ...other
        }, signal);
    }
    sendMessageDraft(chat_id, draft_id, text, other, signal) {
        return this.raw.sendMessageDraft({
            chat_id,
            draft_id,
            text,
            ...other
        }, signal);
    }
    forwardMessage(chat_id, from_chat_id, message_id, other, signal) {
        return this.raw.forwardMessage({
            chat_id,
            from_chat_id,
            message_id,
            ...other
        }, signal);
    }
    forwardMessages(chat_id, from_chat_id, message_ids, other, signal) {
        return this.raw.forwardMessages({
            chat_id,
            from_chat_id,
            message_ids,
            ...other
        }, signal);
    }
    copyMessage(chat_id, from_chat_id, message_id, other, signal) {
        return this.raw.copyMessage({
            chat_id,
            from_chat_id,
            message_id,
            ...other
        }, signal);
    }
    copyMessages(chat_id, from_chat_id, message_ids, other, signal) {
        return this.raw.copyMessages({
            chat_id,
            from_chat_id,
            message_ids,
            ...other
        }, signal);
    }
    sendPhoto(chat_id, photo, other, signal) {
        return this.raw.sendPhoto({
            chat_id,
            photo,
            ...other
        }, signal);
    }
    sendAudio(chat_id, audio, other, signal) {
        return this.raw.sendAudio({
            chat_id,
            audio,
            ...other
        }, signal);
    }
    sendDocument(chat_id, document1, other, signal) {
        return this.raw.sendDocument({
            chat_id,
            document: document1,
            ...other
        }, signal);
    }
    sendVideo(chat_id, video, other, signal) {
        return this.raw.sendVideo({
            chat_id,
            video,
            ...other
        }, signal);
    }
    sendAnimation(chat_id, animation, other, signal) {
        return this.raw.sendAnimation({
            chat_id,
            animation,
            ...other
        }, signal);
    }
    sendVoice(chat_id, voice, other, signal) {
        return this.raw.sendVoice({
            chat_id,
            voice,
            ...other
        }, signal);
    }
    sendVideoNote(chat_id, video_note, other, signal) {
        return this.raw.sendVideoNote({
            chat_id,
            video_note,
            ...other
        }, signal);
    }
    sendMediaGroup(chat_id, media, other, signal) {
        return this.raw.sendMediaGroup({
            chat_id,
            media,
            ...other
        }, signal);
    }
    sendLocation(chat_id, latitude, longitude, other, signal) {
        return this.raw.sendLocation({
            chat_id,
            latitude,
            longitude,
            ...other
        }, signal);
    }
    editMessageLiveLocation(chat_id, message_id, latitude, longitude, other, signal) {
        return this.raw.editMessageLiveLocation({
            chat_id,
            message_id,
            latitude,
            longitude,
            ...other
        }, signal);
    }
    editMessageLiveLocationInline(inline_message_id, latitude, longitude, other, signal) {
        return this.raw.editMessageLiveLocation({
            inline_message_id,
            latitude,
            longitude,
            ...other
        }, signal);
    }
    stopMessageLiveLocation(chat_id, message_id, other, signal) {
        return this.raw.stopMessageLiveLocation({
            chat_id,
            message_id,
            ...other
        }, signal);
    }
    stopMessageLiveLocationInline(inline_message_id, other, signal) {
        return this.raw.stopMessageLiveLocation({
            inline_message_id,
            ...other
        }, signal);
    }
    sendPaidMedia(chat_id, star_count, media, other, signal) {
        return this.raw.sendPaidMedia({
            chat_id,
            star_count,
            media,
            ...other
        }, signal);
    }
    sendVenue(chat_id, latitude, longitude, title, address, other, signal) {
        return this.raw.sendVenue({
            chat_id,
            latitude,
            longitude,
            title,
            address,
            ...other
        }, signal);
    }
    sendContact(chat_id, phone_number, first_name, other, signal) {
        return this.raw.sendContact({
            chat_id,
            phone_number,
            first_name,
            ...other
        }, signal);
    }
    sendPoll(chat_id, question, options, other, signal) {
        const opts = options.map((o)=>typeof o === "string" ? {
                text: o
            } : o);
        return this.raw.sendPoll({
            chat_id,
            question,
            options: opts,
            ...other
        }, signal);
    }
    sendChecklist(business_connection_id, chat_id, checklist, other, signal) {
        return this.raw.sendChecklist({
            business_connection_id,
            chat_id,
            checklist,
            ...other
        }, signal);
    }
    editMessageChecklist(business_connection_id, chat_id, message_id, checklist, other, signal) {
        return this.raw.editMessageChecklist({
            business_connection_id,
            chat_id,
            message_id,
            checklist,
            ...other
        }, signal);
    }
    sendDice(chat_id, emoji, other, signal) {
        return this.raw.sendDice({
            chat_id,
            emoji,
            ...other
        }, signal);
    }
    setMessageReaction(chat_id, message_id, reaction, other, signal) {
        return this.raw.setMessageReaction({
            chat_id,
            message_id,
            reaction,
            ...other
        }, signal);
    }
    sendChatAction(chat_id, action, other, signal) {
        return this.raw.sendChatAction({
            chat_id,
            action,
            ...other
        }, signal);
    }
    getUserProfilePhotos(user_id, other, signal) {
        return this.raw.getUserProfilePhotos({
            user_id,
            ...other
        }, signal);
    }
    getUserProfileAudios(user_id, other, signal) {
        return this.raw.getUserProfileAudios({
            user_id,
            ...other
        }, signal);
    }
    setUserEmojiStatus(user_id, other, signal) {
        return this.raw.setUserEmojiStatus({
            user_id,
            ...other
        }, signal);
    }
    getUserChatBoosts(chat_id, user_id, signal) {
        return this.raw.getUserChatBoosts({
            chat_id,
            user_id
        }, signal);
    }
    getUserGifts(user_id, other, signal) {
        return this.raw.getUserGifts({
            user_id,
            ...other
        }, signal);
    }
    getChatGifts(chat_id, other, signal) {
        return this.raw.getChatGifts({
            chat_id,
            ...other
        }, signal);
    }
    getBusinessConnection(business_connection_id, signal) {
        return this.raw.getBusinessConnection({
            business_connection_id
        }, signal);
    }
    getFile(file_id, signal) {
        return this.raw.getFile({
            file_id
        }, signal);
    }
    kickChatMember(...args) {
        return this.banChatMember(...args);
    }
    banChatMember(chat_id, user_id, other, signal) {
        return this.raw.banChatMember({
            chat_id,
            user_id,
            ...other
        }, signal);
    }
    unbanChatMember(chat_id, user_id, other, signal) {
        return this.raw.unbanChatMember({
            chat_id,
            user_id,
            ...other
        }, signal);
    }
    restrictChatMember(chat_id, user_id, permissions, other, signal) {
        return this.raw.restrictChatMember({
            chat_id,
            user_id,
            permissions,
            ...other
        }, signal);
    }
    promoteChatMember(chat_id, user_id, other, signal) {
        return this.raw.promoteChatMember({
            chat_id,
            user_id,
            ...other
        }, signal);
    }
    setChatAdministratorCustomTitle(chat_id, user_id, custom_title, signal) {
        return this.raw.setChatAdministratorCustomTitle({
            chat_id,
            user_id,
            custom_title
        }, signal);
    }
    banChatSenderChat(chat_id, sender_chat_id, signal) {
        return this.raw.banChatSenderChat({
            chat_id,
            sender_chat_id
        }, signal);
    }
    unbanChatSenderChat(chat_id, sender_chat_id, signal) {
        return this.raw.unbanChatSenderChat({
            chat_id,
            sender_chat_id
        }, signal);
    }
    setChatPermissions(chat_id, permissions, other, signal) {
        return this.raw.setChatPermissions({
            chat_id,
            permissions,
            ...other
        }, signal);
    }
    exportChatInviteLink(chat_id, signal) {
        return this.raw.exportChatInviteLink({
            chat_id
        }, signal);
    }
    createChatInviteLink(chat_id, other, signal) {
        return this.raw.createChatInviteLink({
            chat_id,
            ...other
        }, signal);
    }
    editChatInviteLink(chat_id, invite_link, other, signal) {
        return this.raw.editChatInviteLink({
            chat_id,
            invite_link,
            ...other
        }, signal);
    }
    createChatSubscriptionInviteLink(chat_id, subscription_period, subscription_price, other, signal) {
        return this.raw.createChatSubscriptionInviteLink({
            chat_id,
            subscription_period,
            subscription_price,
            ...other
        }, signal);
    }
    editChatSubscriptionInviteLink(chat_id, invite_link, other, signal) {
        return this.raw.editChatSubscriptionInviteLink({
            chat_id,
            invite_link,
            ...other
        }, signal);
    }
    revokeChatInviteLink(chat_id, invite_link, signal) {
        return this.raw.revokeChatInviteLink({
            chat_id,
            invite_link
        }, signal);
    }
    approveChatJoinRequest(chat_id, user_id, signal) {
        return this.raw.approveChatJoinRequest({
            chat_id,
            user_id
        }, signal);
    }
    declineChatJoinRequest(chat_id, user_id, signal) {
        return this.raw.declineChatJoinRequest({
            chat_id,
            user_id
        }, signal);
    }
    approveSuggestedPost(chat_id, message_id, other, signal) {
        return this.raw.approveSuggestedPost({
            chat_id,
            message_id,
            ...other
        }, signal);
    }
    declineSuggestedPost(chat_id, message_id, other, signal) {
        return this.raw.declineSuggestedPost({
            chat_id,
            message_id,
            ...other
        }, signal);
    }
    setChatPhoto(chat_id, photo, signal) {
        return this.raw.setChatPhoto({
            chat_id,
            photo
        }, signal);
    }
    deleteChatPhoto(chat_id, signal) {
        return this.raw.deleteChatPhoto({
            chat_id
        }, signal);
    }
    setChatTitle(chat_id, title, signal) {
        return this.raw.setChatTitle({
            chat_id,
            title
        }, signal);
    }
    setChatDescription(chat_id, description, signal) {
        return this.raw.setChatDescription({
            chat_id,
            description
        }, signal);
    }
    pinChatMessage(chat_id, message_id, other, signal) {
        return this.raw.pinChatMessage({
            chat_id,
            message_id,
            ...other
        }, signal);
    }
    unpinChatMessage(chat_id, message_id, other, signal) {
        return this.raw.unpinChatMessage({
            chat_id,
            message_id,
            ...other
        }, signal);
    }
    unpinAllChatMessages(chat_id, signal) {
        return this.raw.unpinAllChatMessages({
            chat_id
        }, signal);
    }
    leaveChat(chat_id, signal) {
        return this.raw.leaveChat({
            chat_id
        }, signal);
    }
    getChat(chat_id, signal) {
        return this.raw.getChat({
            chat_id
        }, signal);
    }
    getChatAdministrators(chat_id, signal) {
        return this.raw.getChatAdministrators({
            chat_id
        }, signal);
    }
    getChatMembersCount(...args) {
        return this.getChatMemberCount(...args);
    }
    getChatMemberCount(chat_id, signal) {
        return this.raw.getChatMemberCount({
            chat_id
        }, signal);
    }
    getChatMember(chat_id, user_id, signal) {
        return this.raw.getChatMember({
            chat_id,
            user_id
        }, signal);
    }
    setChatStickerSet(chat_id, sticker_set_name, signal) {
        return this.raw.setChatStickerSet({
            chat_id,
            sticker_set_name
        }, signal);
    }
    deleteChatStickerSet(chat_id, signal) {
        return this.raw.deleteChatStickerSet({
            chat_id
        }, signal);
    }
    getForumTopicIconStickers(signal) {
        return this.raw.getForumTopicIconStickers(signal);
    }
    createForumTopic(chat_id, name, other, signal) {
        return this.raw.createForumTopic({
            chat_id,
            name,
            ...other
        }, signal);
    }
    editForumTopic(chat_id, message_thread_id, other, signal) {
        return this.raw.editForumTopic({
            chat_id,
            message_thread_id,
            ...other
        }, signal);
    }
    closeForumTopic(chat_id, message_thread_id, signal) {
        return this.raw.closeForumTopic({
            chat_id,
            message_thread_id
        }, signal);
    }
    reopenForumTopic(chat_id, message_thread_id, signal) {
        return this.raw.reopenForumTopic({
            chat_id,
            message_thread_id
        }, signal);
    }
    deleteForumTopic(chat_id, message_thread_id, signal) {
        return this.raw.deleteForumTopic({
            chat_id,
            message_thread_id
        }, signal);
    }
    unpinAllForumTopicMessages(chat_id, message_thread_id, signal) {
        return this.raw.unpinAllForumTopicMessages({
            chat_id,
            message_thread_id
        }, signal);
    }
    editGeneralForumTopic(chat_id, name, signal) {
        return this.raw.editGeneralForumTopic({
            chat_id,
            name
        }, signal);
    }
    closeGeneralForumTopic(chat_id, signal) {
        return this.raw.closeGeneralForumTopic({
            chat_id
        }, signal);
    }
    reopenGeneralForumTopic(chat_id, signal) {
        return this.raw.reopenGeneralForumTopic({
            chat_id
        }, signal);
    }
    hideGeneralForumTopic(chat_id, signal) {
        return this.raw.hideGeneralForumTopic({
            chat_id
        }, signal);
    }
    unhideGeneralForumTopic(chat_id, signal) {
        return this.raw.unhideGeneralForumTopic({
            chat_id
        }, signal);
    }
    unpinAllGeneralForumTopicMessages(chat_id, signal) {
        return this.raw.unpinAllGeneralForumTopicMessages({
            chat_id
        }, signal);
    }
    answerCallbackQuery(callback_query_id, other, signal) {
        return this.raw.answerCallbackQuery({
            callback_query_id,
            ...other
        }, signal);
    }
    setMyName(name, other, signal) {
        return this.raw.setMyName({
            name,
            ...other
        }, signal);
    }
    getMyName(other, signal) {
        return this.raw.getMyName(other ?? {}, signal);
    }
    setMyCommands(commands, other, signal) {
        return this.raw.setMyCommands({
            commands,
            ...other
        }, signal);
    }
    deleteMyCommands(other, signal) {
        return this.raw.deleteMyCommands({
            ...other
        }, signal);
    }
    getMyCommands(other, signal) {
        return this.raw.getMyCommands({
            ...other
        }, signal);
    }
    setMyDescription(description, other, signal) {
        return this.raw.setMyDescription({
            description,
            ...other
        }, signal);
    }
    getMyDescription(other, signal) {
        return this.raw.getMyDescription({
            ...other
        }, signal);
    }
    setMyShortDescription(short_description, other, signal) {
        return this.raw.setMyShortDescription({
            short_description,
            ...other
        }, signal);
    }
    getMyShortDescription(other, signal) {
        return this.raw.getMyShortDescription({
            ...other
        }, signal);
    }
    setMyProfilePhoto(photo, signal) {
        return this.raw.setMyProfilePhoto({
            photo
        }, signal);
    }
    removeMyProfilePhoto(signal) {
        return this.raw.removeMyProfilePhoto(signal);
    }
    setChatMenuButton(other, signal) {
        return this.raw.setChatMenuButton({
            ...other
        }, signal);
    }
    getChatMenuButton(other, signal) {
        return this.raw.getChatMenuButton({
            ...other
        }, signal);
    }
    setMyDefaultAdministratorRights(other, signal) {
        return this.raw.setMyDefaultAdministratorRights({
            ...other
        }, signal);
    }
    getMyDefaultAdministratorRights(other, signal) {
        return this.raw.getMyDefaultAdministratorRights({
            ...other
        }, signal);
    }
    getMyStarBalance(signal) {
        return this.raw.getMyStarBalance(signal);
    }
    editMessageText(chat_id, message_id, text, other, signal) {
        return this.raw.editMessageText({
            chat_id,
            message_id,
            text,
            ...other
        }, signal);
    }
    editMessageTextInline(inline_message_id, text, other, signal) {
        return this.raw.editMessageText({
            inline_message_id,
            text,
            ...other
        }, signal);
    }
    editMessageCaption(chat_id, message_id, other, signal) {
        return this.raw.editMessageCaption({
            chat_id,
            message_id,
            ...other
        }, signal);
    }
    editMessageCaptionInline(inline_message_id, other, signal) {
        return this.raw.editMessageCaption({
            inline_message_id,
            ...other
        }, signal);
    }
    editMessageMedia(chat_id, message_id, media, other, signal) {
        return this.raw.editMessageMedia({
            chat_id,
            message_id,
            media,
            ...other
        }, signal);
    }
    editMessageMediaInline(inline_message_id, media, other, signal) {
        return this.raw.editMessageMedia({
            inline_message_id,
            media,
            ...other
        }, signal);
    }
    editMessageReplyMarkup(chat_id, message_id, other, signal) {
        return this.raw.editMessageReplyMarkup({
            chat_id,
            message_id,
            ...other
        }, signal);
    }
    editMessageReplyMarkupInline(inline_message_id, other, signal) {
        return this.raw.editMessageReplyMarkup({
            inline_message_id,
            ...other
        }, signal);
    }
    stopPoll(chat_id, message_id, other, signal) {
        return this.raw.stopPoll({
            chat_id,
            message_id,
            ...other
        }, signal);
    }
    deleteMessage(chat_id, message_id, signal) {
        return this.raw.deleteMessage({
            chat_id,
            message_id
        }, signal);
    }
    deleteMessages(chat_id, message_ids, signal) {
        return this.raw.deleteMessages({
            chat_id,
            message_ids
        }, signal);
    }
    deleteBusinessMessages(business_connection_id, message_ids, signal) {
        return this.raw.deleteBusinessMessages({
            business_connection_id,
            message_ids
        }, signal);
    }
    setBusinessAccountName(business_connection_id, first_name, other, signal) {
        return this.raw.setBusinessAccountName({
            business_connection_id,
            first_name,
            ...other
        }, signal);
    }
    setBusinessAccountUsername(business_connection_id, username, signal) {
        return this.raw.setBusinessAccountUsername({
            business_connection_id,
            username
        }, signal);
    }
    setBusinessAccountBio(business_connection_id, bio, signal) {
        return this.raw.setBusinessAccountBio({
            business_connection_id,
            bio
        }, signal);
    }
    setBusinessAccountProfilePhoto(business_connection_id, photo, other, signal) {
        return this.raw.setBusinessAccountProfilePhoto({
            business_connection_id,
            photo,
            ...other
        }, signal);
    }
    removeBusinessAccountProfilePhoto(business_connection_id, other, signal) {
        return this.raw.removeBusinessAccountProfilePhoto({
            business_connection_id,
            ...other
        }, signal);
    }
    setBusinessAccountGiftSettings(business_connection_id, show_gift_button, accepted_gift_types, signal) {
        return this.raw.setBusinessAccountGiftSettings({
            business_connection_id,
            show_gift_button,
            accepted_gift_types
        }, signal);
    }
    getBusinessAccountStarBalance(business_connection_id, signal) {
        return this.raw.getBusinessAccountStarBalance({
            business_connection_id
        }, signal);
    }
    transferBusinessAccountStars(business_connection_id, star_count, signal) {
        return this.raw.transferBusinessAccountStars({
            business_connection_id,
            star_count
        }, signal);
    }
    getBusinessAccountGifts(business_connection_id, other, signal) {
        return this.raw.getBusinessAccountGifts({
            business_connection_id,
            ...other
        }, signal);
    }
    convertGiftToStars(business_connection_id, owned_gift_id, signal) {
        return this.raw.convertGiftToStars({
            business_connection_id,
            owned_gift_id
        }, signal);
    }
    upgradeGift(business_connection_id, owned_gift_id, other, signal) {
        return this.raw.upgradeGift({
            business_connection_id,
            owned_gift_id,
            ...other
        }, signal);
    }
    transferGift(business_connection_id, owned_gift_id, new_owner_chat_id, star_count, signal) {
        return this.raw.transferGift({
            business_connection_id,
            owned_gift_id,
            new_owner_chat_id,
            star_count
        }, signal);
    }
    postStory(business_connection_id, content, active_period, other, signal) {
        return this.raw.postStory({
            business_connection_id,
            content,
            active_period,
            ...other
        }, signal);
    }
    repostStory(business_connection_id, from_chat_id, from_story_id, active_period, other, signal) {
        return this.raw.repostStory({
            business_connection_id,
            from_chat_id,
            from_story_id,
            active_period,
            ...other
        }, signal);
    }
    editStory(business_connection_id, story_id, content, other, signal) {
        return this.raw.editStory({
            business_connection_id,
            story_id,
            content,
            ...other
        }, signal);
    }
    deleteStory(business_connection_id, story_id, signal) {
        return this.raw.deleteStory({
            business_connection_id,
            story_id
        }, signal);
    }
    sendSticker(chat_id, sticker, other, signal) {
        return this.raw.sendSticker({
            chat_id,
            sticker,
            ...other
        }, signal);
    }
    getStickerSet(name, signal) {
        return this.raw.getStickerSet({
            name
        }, signal);
    }
    getCustomEmojiStickers(custom_emoji_ids, signal) {
        return this.raw.getCustomEmojiStickers({
            custom_emoji_ids
        }, signal);
    }
    uploadStickerFile(user_id, sticker_format, sticker, signal) {
        return this.raw.uploadStickerFile({
            user_id,
            sticker_format,
            sticker
        }, signal);
    }
    createNewStickerSet(user_id, name, title, stickers, other, signal) {
        return this.raw.createNewStickerSet({
            user_id,
            name,
            title,
            stickers,
            ...other
        }, signal);
    }
    addStickerToSet(user_id, name, sticker, signal) {
        return this.raw.addStickerToSet({
            user_id,
            name,
            sticker
        }, signal);
    }
    setStickerPositionInSet(sticker, position, signal) {
        return this.raw.setStickerPositionInSet({
            sticker,
            position
        }, signal);
    }
    deleteStickerFromSet(sticker, signal) {
        return this.raw.deleteStickerFromSet({
            sticker
        }, signal);
    }
    replaceStickerInSet(user_id, name, old_sticker, sticker, signal) {
        return this.raw.replaceStickerInSet({
            user_id,
            name,
            old_sticker,
            sticker
        }, signal);
    }
    setStickerEmojiList(sticker, emoji_list, signal) {
        return this.raw.setStickerEmojiList({
            sticker,
            emoji_list
        }, signal);
    }
    setStickerKeywords(sticker, keywords, signal) {
        return this.raw.setStickerKeywords({
            sticker,
            keywords
        }, signal);
    }
    setStickerMaskPosition(sticker, mask_position, signal) {
        return this.raw.setStickerMaskPosition({
            sticker,
            mask_position
        }, signal);
    }
    setStickerSetTitle(name, title, signal) {
        return this.raw.setStickerSetTitle({
            name,
            title
        }, signal);
    }
    deleteStickerSet(name, signal) {
        return this.raw.deleteStickerSet({
            name
        }, signal);
    }
    setStickerSetThumbnail(name, user_id, thumbnail, format, signal) {
        return this.raw.setStickerSetThumbnail({
            name,
            user_id,
            thumbnail,
            format
        }, signal);
    }
    setCustomEmojiStickerSetThumbnail(name, custom_emoji_id, signal) {
        return this.raw.setCustomEmojiStickerSetThumbnail({
            name,
            custom_emoji_id
        }, signal);
    }
    getAvailableGifts(signal) {
        return this.raw.getAvailableGifts(signal);
    }
    sendGift(user_id, gift_id, other, signal) {
        return this.raw.sendGift({
            user_id,
            gift_id,
            ...other
        }, signal);
    }
    giftPremiumSubscription(user_id, month_count, star_count, other, signal) {
        return this.raw.giftPremiumSubscription({
            user_id,
            month_count,
            star_count,
            ...other
        }, signal);
    }
    sendGiftToChannel(chat_id, gift_id, other, signal) {
        return this.raw.sendGift({
            chat_id,
            gift_id,
            ...other
        }, signal);
    }
    answerInlineQuery(inline_query_id, results, other, signal) {
        return this.raw.answerInlineQuery({
            inline_query_id,
            results,
            ...other
        }, signal);
    }
    answerWebAppQuery(web_app_query_id, result, signal) {
        return this.raw.answerWebAppQuery({
            web_app_query_id,
            result
        }, signal);
    }
    savePreparedInlineMessage(user_id, result, other, signal) {
        return this.raw.savePreparedInlineMessage({
            user_id,
            result,
            ...other
        }, signal);
    }
    sendInvoice(chat_id, title, description, payload, currency, prices, other, signal) {
        return this.raw.sendInvoice({
            chat_id,
            title,
            description,
            payload,
            currency,
            prices,
            ...other
        }, signal);
    }
    createInvoiceLink(title, description, payload, provider_token, currency, prices, other, signal) {
        return this.raw.createInvoiceLink({
            title,
            description,
            payload,
            provider_token,
            currency,
            prices,
            ...other
        }, signal);
    }
    answerShippingQuery(shipping_query_id, ok, other, signal) {
        return this.raw.answerShippingQuery({
            shipping_query_id,
            ok,
            ...other
        }, signal);
    }
    answerPreCheckoutQuery(pre_checkout_query_id, ok, other, signal) {
        return this.raw.answerPreCheckoutQuery({
            pre_checkout_query_id,
            ok,
            ...other
        }, signal);
    }
    getStarTransactions(other, signal) {
        return this.raw.getStarTransactions({
            ...other
        }, signal);
    }
    refundStarPayment(user_id, telegram_payment_charge_id, signal) {
        return this.raw.refundStarPayment({
            user_id,
            telegram_payment_charge_id
        }, signal);
    }
    editUserStarSubscription(user_id, telegram_payment_charge_id, is_canceled, signal) {
        return this.raw.editUserStarSubscription({
            user_id,
            telegram_payment_charge_id,
            is_canceled
        }, signal);
    }
    verifyUser(user_id, other, signal) {
        return this.raw.verifyUser({
            user_id,
            ...other
        }, signal);
    }
    verifyChat(chat_id, other, signal) {
        return this.raw.verifyChat({
            chat_id,
            ...other
        }, signal);
    }
    removeUserVerification(user_id, signal) {
        return this.raw.removeUserVerification({
            user_id
        }, signal);
    }
    removeChatVerification(chat_id, signal) {
        return this.raw.removeChatVerification({
            chat_id
        }, signal);
    }
    readBusinessMessage(business_connection_id, chat_id, message_id, signal) {
        return this.raw.readBusinessMessage({
            business_connection_id,
            chat_id,
            message_id
        }, signal);
    }
    setPassportDataErrors(user_id, errors, signal) {
        return this.raw.setPassportDataErrors({
            user_id,
            errors
        }, signal);
    }
    sendGame(chat_id, game_short_name, other, signal) {
        return this.raw.sendGame({
            chat_id,
            game_short_name,
            ...other
        }, signal);
    }
    setGameScore(chat_id, message_id, user_id, score, other, signal) {
        return this.raw.setGameScore({
            chat_id,
            message_id,
            user_id,
            score,
            ...other
        }, signal);
    }
    setGameScoreInline(inline_message_id, user_id, score, other, signal) {
        return this.raw.setGameScore({
            inline_message_id,
            user_id,
            score,
            ...other
        }, signal);
    }
    getGameHighScores(chat_id, message_id, user_id, signal) {
        return this.raw.getGameHighScores({
            chat_id,
            message_id,
            user_id
        }, signal);
    }
    getGameHighScoresInline(inline_message_id, user_id, signal) {
        return this.raw.getGameHighScores({
            inline_message_id,
            user_id
        }, signal);
    }
}
const debug2 = browser$1("grammy:bot");
const debugWarn = browser$1("grammy:warn");
const debugErr = browser$1("grammy:error");
const DEFAULT_UPDATE_TYPES = [
    "message",
    "edited_message",
    "channel_post",
    "edited_channel_post",
    "business_connection",
    "business_message",
    "edited_business_message",
    "deleted_business_messages",
    "inline_query",
    "chosen_inline_result",
    "callback_query",
    "shipping_query",
    "pre_checkout_query",
    "purchased_paid_media",
    "poll",
    "poll_answer",
    "my_chat_member",
    "chat_join_request",
    "chat_boost",
    "removed_chat_boost"
];
class Bot extends Composer {
    token;
    pollingRunning;
    pollingAbortController;
    lastTriedUpdateId;
    api;
    me;
    mePromise;
    clientConfig;
    ContextConstructor;
    observedUpdateTypes;
    errorHandler;
    constructor(token, config){
        super();
        this.token = token;
        this.pollingRunning = false;
        this.lastTriedUpdateId = 0;
        this.observedUpdateTypes = new Set();
        this.errorHandler = async (err)=>{
            console.error("Error in middleware while handling update", err.ctx?.update?.update_id, err.error);
            console.error("No error handler was set!");
            console.error("Set your own error handler with `bot.catch = ...`");
            if (this.pollingRunning) {
                console.error("Stopping bot");
                await this.stop();
            }
            throw err;
        };
        if (!token) throw new Error("Empty token!");
        this.me = config?.botInfo;
        this.clientConfig = config?.client;
        this.ContextConstructor = config?.ContextConstructor ?? Context;
        this.api = new Api(token, this.clientConfig);
    }
    set botInfo(botInfo) {
        this.me = botInfo;
    }
    get botInfo() {
        if (this.me === undefined) {
            throw new Error("Bot information unavailable! Make sure to call `await bot.init()` before accessing `bot.botInfo`!");
        }
        return this.me;
    }
    on(filter, ...middleware) {
        for (const [u] of parse(filter).flatMap(preprocess)){
            this.observedUpdateTypes.add(u);
        }
        return super.on(filter, ...middleware);
    }
    reaction(reaction, ...middleware) {
        this.observedUpdateTypes.add("message_reaction");
        return super.reaction(reaction, ...middleware);
    }
    isInited() {
        return this.me !== undefined;
    }
    async init(signal) {
        if (!this.isInited()) {
            debug2("Initializing bot");
            this.mePromise ??= withRetries(()=>this.api.getMe(signal), signal);
            let me;
            try {
                me = await this.mePromise;
            } finally{
                this.mePromise = undefined;
            }
            if (this.me === undefined) this.me = me;
            else debug2("Bot info was set by now, will not overwrite");
        }
        debug2(`I am ${this.me.username}!`);
    }
    async handleUpdates(updates) {
        for (const update of updates){
            this.lastTriedUpdateId = update.update_id;
            try {
                await this.handleUpdate(update);
            } catch (err) {
                if (err instanceof BotError) {
                    await this.errorHandler(err);
                } else {
                    console.error("FATAL: grammY unable to handle:", err);
                    throw err;
                }
            }
        }
    }
    async handleUpdate(update, webhookReplyEnvelope) {
        if (this.me === undefined) {
            throw new Error("Bot not initialized! Either call `await bot.init()`, \
or directly set the `botInfo` option in the `Bot` constructor to specify \
a known bot info object.");
        }
        debug2(`Processing update ${update.update_id}`);
        const api = new Api(this.token, this.clientConfig, webhookReplyEnvelope);
        const t = this.api.config.installedTransformers();
        if (t.length > 0) api.config.use(...t);
        const ctx = new this.ContextConstructor(update, api, this.me);
        try {
            await run(this.middleware(), ctx);
        } catch (err) {
            debugErr(`Error in middleware for update ${update.update_id}`);
            throw new BotError(err, ctx);
        }
    }
    async start(options) {
        const setup = [];
        if (!this.isInited()) {
            setup.push(this.init(this.pollingAbortController?.signal));
        }
        if (this.pollingRunning) {
            await Promise.all(setup);
            debug2("Simple long polling already running!");
            return;
        }
        this.pollingRunning = true;
        this.pollingAbortController = new AbortController();
        try {
            setup.push(withRetries(async ()=>{
                await this.api.deleteWebhook({
                    drop_pending_updates: options?.drop_pending_updates
                }, this.pollingAbortController?.signal);
            }, this.pollingAbortController?.signal));
            await Promise.all(setup);
            await options?.onStart?.(this.botInfo);
        } catch (err) {
            this.pollingRunning = false;
            this.pollingAbortController = undefined;
            throw err;
        }
        if (!this.pollingRunning) return;
        validateAllowedUpdates(this.observedUpdateTypes, options?.allowed_updates);
        this.use = noUseFunction;
        debug2("Starting simple long polling");
        await this.loop(options);
        debug2("Middleware is done running");
    }
    async stop() {
        if (this.pollingRunning) {
            debug2("Stopping bot, saving update offset");
            this.pollingRunning = false;
            this.pollingAbortController?.abort();
            const offset = this.lastTriedUpdateId + 1;
            await this.api.getUpdates({
                offset,
                limit: 1
            }).finally(()=>this.pollingAbortController = undefined);
        } else {
            debug2("Bot is not running!");
        }
    }
    isRunning() {
        return this.pollingRunning;
    }
    catch(errorHandler) {
        this.errorHandler = errorHandler;
    }
    async loop(options) {
        const limit = options?.limit;
        const timeout = options?.timeout ?? 30;
        let allowed_updates = options?.allowed_updates ?? [];
        try {
            while(this.pollingRunning){
                const updates = await this.fetchUpdates({
                    limit,
                    timeout,
                    allowed_updates
                });
                if (updates === undefined) break;
                await this.handleUpdates(updates);
                allowed_updates = undefined;
            }
        } finally{
            this.pollingRunning = false;
        }
    }
    async fetchUpdates({ limit, timeout, allowed_updates }) {
        const offset = this.lastTriedUpdateId + 1;
        let updates = undefined;
        do {
            try {
                updates = await this.api.getUpdates({
                    offset,
                    limit,
                    timeout,
                    allowed_updates
                }, this.pollingAbortController?.signal);
            } catch (error) {
                await this.handlePollingError(error);
            }
        }while (updates === undefined && this.pollingRunning)
        return updates;
    }
    async handlePollingError(error) {
        if (!this.pollingRunning) {
            debug2("Pending getUpdates request cancelled");
            return;
        }
        let sleepSeconds = 3;
        if (error instanceof GrammyError) {
            debugErr(error.message);
            if (error.error_code === 401 || error.error_code === 409) {
                throw error;
            } else if (error.error_code === 429) {
                debugErr("Bot API server is closing.");
                sleepSeconds = error.parameters.retry_after ?? sleepSeconds;
            }
        } else debugErr(error);
        debugErr(`Call to getUpdates failed, retrying in ${sleepSeconds} seconds ...`);
        await sleep(sleepSeconds);
    }
}
async function withRetries(task, signal) {
    const INITIAL_DELAY = 50;
    let lastDelay = 50;
    async function handleError(error) {
        let delay = false;
        let strategy = "rethrow";
        if (error instanceof HttpError) {
            delay = true;
            strategy = "retry";
        } else if (error instanceof GrammyError) {
            if (error.error_code >= 500) {
                delay = true;
                strategy = "retry";
            } else if (error.error_code === 429) {
                const retryAfter = error.parameters.retry_after;
                if (typeof retryAfter === "number") {
                    await sleep(retryAfter, signal);
                    lastDelay = INITIAL_DELAY;
                } else {
                    delay = true;
                }
                strategy = "retry";
            }
        }
        if (delay) {
            if (lastDelay !== 50) {
                await sleep(lastDelay, signal);
            }
            const TWENTY_MINUTES = 20 * 60 * 1000;
            lastDelay = Math.min(TWENTY_MINUTES, 2 * lastDelay);
        }
        return strategy;
    }
    let result = {
        ok: false
    };
    while(!result.ok){
        try {
            result = {
                ok: true,
                value: await task()
            };
        } catch (error) {
            debugErr(error);
            const strategy = await handleError(error);
            switch(strategy){
                case "retry":
                    continue;
                case "rethrow":
                    throw error;
            }
        }
    }
    return result.value;
}
async function sleep(seconds, signal) {
    let handle;
    let reject;
    function abort() {
        reject?.(new Error("Aborted delay"));
        if (handle !== undefined) clearTimeout(handle);
    }
    try {
        await new Promise((res, rej)=>{
            reject = rej;
            if (signal?.aborted) {
                abort();
                return;
            }
            signal?.addEventListener("abort", abort);
            handle = setTimeout(res, 1000 * seconds);
        });
    } finally{
        signal?.removeEventListener("abort", abort);
    }
}
function validateAllowedUpdates(updates, allowed = DEFAULT_UPDATE_TYPES) {
    const impossible = Array.from(updates).filter((u)=>!allowed.includes(u));
    if (impossible.length > 0) {
        debugWarn(`You registered listeners for the following update types, \
but you did not specify them in \`allowed_updates\` \
so they may not be received: ${impossible.map((u)=>`'${u}'`).join(", ")}`);
    }
}
function noUseFunction() {
    throw new Error(`It looks like you are registering more listeners \
on your bot from within other listeners! This means that every time your bot \
handles a message like this one, new listeners will be added. This list grows until \
your machine crashes, so grammY throws this error to tell you that you should \
probably do things a bit differently. If you're unsure how to resolve this problem, \
you can ask in the group chat: https://telegram.me/grammyjs

On the other hand, if you actually know what you're doing and you do need to install \
further middleware while your bot is running, consider installing a composer \
instance on your bot, and in turn augment the composer after the fact. This way, \
you can circumvent this protection against memory leaks.`);
}
const ALL_UPDATE_TYPES = [
    ...DEFAULT_UPDATE_TYPES,
    "chat_member",
    "message_reaction",
    "message_reaction_count"
];
const ALL_CHAT_PERMISSIONS = {
    is_anonymous: true,
    can_manage_chat: true,
    can_delete_messages: true,
    can_manage_video_chats: true,
    can_restrict_members: true,
    can_promote_members: true,
    can_change_info: true,
    can_invite_users: true,
    can_post_stories: true,
    can_edit_stories: true,
    can_delete_stories: true,
    can_post_messages: true,
    can_edit_messages: true,
    can_pin_messages: true,
    can_manage_topics: true
};
const API_CONSTANTS = {
    DEFAULT_UPDATE_TYPES,
    ALL_UPDATE_TYPES,
    ALL_CHAT_PERMISSIONS
};
Object.freeze(API_CONSTANTS);
export { API_CONSTANTS as API_CONSTANTS };
function inputMessage(queryTemplate) {
    return {
        ...queryTemplate,
        ...inputMessageMethods(queryTemplate)
    };
}
function inputMessageMethods(queryTemplate) {
    return {
        text (message_text, options = {}) {
            const content = {
                message_text,
                ...options
            };
            return {
                ...queryTemplate,
                input_message_content: content
            };
        },
        location (latitude, longitude, options = {}) {
            const content = {
                latitude,
                longitude,
                ...options
            };
            return {
                ...queryTemplate,
                input_message_content: content
            };
        },
        venue (title, latitude, longitude, address, options) {
            const content = {
                title,
                latitude,
                longitude,
                address,
                ...options
            };
            return {
                ...queryTemplate,
                input_message_content: content
            };
        },
        contact (first_name, phone_number, options = {}) {
            const content = {
                first_name,
                phone_number,
                ...options
            };
            return {
                ...queryTemplate,
                input_message_content: content
            };
        },
        invoice (title, description, payload, provider_token, currency, prices, options = {}) {
            const content = {
                title,
                description,
                payload,
                provider_token,
                currency,
                prices,
                ...options
            };
            return {
                ...queryTemplate,
                input_message_content: content
            };
        }
    };
}
const InlineQueryResultBuilder = {
    article (id, title, options = {}) {
        return inputMessageMethods({
            type: "article",
            id,
            title,
            ...options
        });
    },
    audio (id, title, audio_url, options = {}) {
        return inputMessage({
            type: "audio",
            id,
            title,
            audio_url: typeof audio_url === "string" ? audio_url : audio_url.href,
            ...options
        });
    },
    audioCached (id, audio_file_id, options = {}) {
        return inputMessage({
            type: "audio",
            id,
            audio_file_id,
            ...options
        });
    },
    contact (id, phone_number, first_name, options = {}) {
        return inputMessage({
            type: "contact",
            id,
            phone_number,
            first_name,
            ...options
        });
    },
    documentPdf (id, title, document_url, options = {}) {
        return inputMessage({
            type: "document",
            mime_type: "application/pdf",
            id,
            title,
            document_url: typeof document_url === "string" ? document_url : document_url.href,
            ...options
        });
    },
    documentZip (id, title, document_url, options = {}) {
        return inputMessage({
            type: "document",
            mime_type: "application/zip",
            id,
            title,
            document_url: typeof document_url === "string" ? document_url : document_url.href,
            ...options
        });
    },
    documentCached (id, title, document_file_id, options = {}) {
        return inputMessage({
            type: "document",
            id,
            title,
            document_file_id,
            ...options
        });
    },
    game (id, game_short_name, options = {}) {
        return {
            type: "game",
            id,
            game_short_name,
            ...options
        };
    },
    gif (id, gif_url, thumbnail_url, options = {}) {
        return inputMessage({
            type: "gif",
            id,
            gif_url: typeof gif_url === "string" ? gif_url : gif_url.href,
            thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
            ...options
        });
    },
    gifCached (id, gif_file_id, options = {}) {
        return inputMessage({
            type: "gif",
            id,
            gif_file_id,
            ...options
        });
    },
    location (id, title, latitude, longitude, options = {}) {
        return inputMessage({
            type: "location",
            id,
            title,
            latitude,
            longitude,
            ...options
        });
    },
    mpeg4gif (id, mpeg4_url, thumbnail_url, options = {}) {
        return inputMessage({
            type: "mpeg4_gif",
            id,
            mpeg4_url: typeof mpeg4_url === "string" ? mpeg4_url : mpeg4_url.href,
            thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
            ...options
        });
    },
    mpeg4gifCached (id, mpeg4_file_id, options = {}) {
        return inputMessage({
            type: "mpeg4_gif",
            id,
            mpeg4_file_id,
            ...options
        });
    },
    photo (id, photo_url, options = {
        thumbnail_url: typeof photo_url === "string" ? photo_url : photo_url.href
    }) {
        return inputMessage({
            type: "photo",
            id,
            photo_url: typeof photo_url === "string" ? photo_url : photo_url.href,
            ...options
        });
    },
    photoCached (id, photo_file_id, options = {}) {
        return inputMessage({
            type: "photo",
            id,
            photo_file_id,
            ...options
        });
    },
    stickerCached (id, sticker_file_id, options = {}) {
        return inputMessage({
            type: "sticker",
            id,
            sticker_file_id,
            ...options
        });
    },
    venue (id, title, latitude, longitude, address, options = {}) {
        return inputMessage({
            type: "venue",
            id,
            title,
            latitude,
            longitude,
            address,
            ...options
        });
    },
    videoHtml (id, title, video_url, thumbnail_url, options = {}) {
        return inputMessageMethods({
            type: "video",
            mime_type: "text/html",
            id,
            title,
            video_url: typeof video_url === "string" ? video_url : video_url.href,
            thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
            ...options
        });
    },
    videoMp4 (id, title, video_url, thumbnail_url, options = {}) {
        return inputMessage({
            type: "video",
            mime_type: "video/mp4",
            id,
            title,
            video_url: typeof video_url === "string" ? video_url : video_url.href,
            thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
            ...options
        });
    },
    videoCached (id, title, video_file_id, options = {}) {
        return inputMessage({
            type: "video",
            id,
            title,
            video_file_id,
            ...options
        });
    },
    voice (id, title, voice_url, options = {}) {
        return inputMessage({
            type: "voice",
            id,
            title,
            voice_url: typeof voice_url === "string" ? voice_url : voice_url.href,
            ...options
        });
    },
    voiceCached (id, title, voice_file_id, options = {}) {
        return inputMessage({
            type: "voice",
            id,
            title,
            voice_file_id,
            ...options
        });
    }
};
export { InlineQueryResultBuilder as InlineQueryResultBuilder };
const InputMediaBuilder = {
    photo (media, options = {}) {
        return {
            type: "photo",
            media,
            ...options
        };
    },
    video (media, options = {}) {
        return {
            type: "video",
            media,
            ...options
        };
    },
    animation (media, options = {}) {
        return {
            type: "animation",
            media,
            ...options
        };
    },
    audio (media, options = {}) {
        return {
            type: "audio",
            media,
            ...options
        };
    },
    document (media, options = {}) {
        return {
            type: "document",
            media,
            ...options
        };
    }
};
export { InputMediaBuilder as InputMediaBuilder };
class Keyboard {
    keyboard;
    is_persistent;
    selective;
    one_time_keyboard;
    resize_keyboard;
    input_field_placeholder;
    constructor(keyboard = [
        []
    ]){
        this.keyboard = keyboard;
    }
    add(...buttons) {
        this.keyboard[this.keyboard.length - 1]?.push(...buttons);
        return this;
    }
    row(...buttons) {
        this.keyboard.push(buttons);
        return this;
    }
    text(text, options) {
        return this.add(Keyboard.text(text, options));
    }
    static text(text, options) {
        return typeof options === "string" ? {
            text,
            style: options
        } : {
            text,
            ...options
        };
    }
    requestUsers(text, requestId, options = {}) {
        return this.add(Keyboard.requestUsers(text, requestId, options));
    }
    static requestUsers(text, requestId, options = {}) {
        return typeof text === "string" ? {
            text,
            request_users: {
                request_id: requestId,
                ...options
            }
        } : {
            ...text,
            request_users: {
                request_id: requestId,
                ...options
            }
        };
    }
    requestChat(text, requestId, options = {
        chat_is_channel: false
    }) {
        return this.add(Keyboard.requestChat(text, requestId, options));
    }
    static requestChat(text, requestId, options = {
        chat_is_channel: false
    }) {
        const request_chat = {
            request_id: requestId,
            ...options
        };
        return typeof text === "string" ? {
            text,
            request_chat
        } : {
            ...text,
            request_chat
        };
    }
    requestContact(text) {
        return this.add(Keyboard.requestContact(text));
    }
    static requestContact(text) {
        return typeof text === "string" ? {
            text,
            request_contact: true
        } : {
            ...text,
            request_contact: true
        };
    }
    requestLocation(text) {
        return this.add(Keyboard.requestLocation(text));
    }
    static requestLocation(text) {
        return typeof text === "string" ? {
            text,
            request_location: true
        } : {
            ...text,
            request_location: true
        };
    }
    requestPoll(text, type) {
        return this.add(Keyboard.requestPoll(text, type));
    }
    static requestPoll(text, type) {
        const request_poll = {
            type
        };
        return typeof text === "string" ? {
            text,
            request_poll
        } : {
            ...text,
            request_poll
        };
    }
    webApp(text, url) {
        return this.add(Keyboard.webApp(text, url));
    }
    static webApp(text, url) {
        const web_app = {
            url
        };
        return typeof text === "string" ? {
            text,
            web_app
        } : {
            ...text,
            web_app
        };
    }
    style(style) {
        const rows = this.keyboard.length;
        if (rows === 0) {
            throw new Error("Need to add a button before applying a style!");
        }
        const lastRow = this.keyboard[rows - 1];
        const cols = lastRow.length;
        if (cols === 0) {
            throw new Error("Need to add a button before applying a style!");
        }
        let lastButton = lastRow[cols - 1];
        if (typeof lastButton === "string") {
            lastButton = {
                text: lastButton
            };
            lastRow[cols - 1] = lastButton;
        }
        lastButton.style = style;
        return this;
    }
    danger() {
        return this.style("danger");
    }
    success() {
        return this.style("success");
    }
    primary() {
        return this.style("primary");
    }
    icon(icon) {
        const rows = this.keyboard.length;
        if (rows === 0) {
            throw new Error("Need to add a button before adding an icon!");
        }
        const lastRow = this.keyboard[rows - 1];
        const cols = lastRow.length;
        if (cols === 0) {
            throw new Error("Need to add a button before adding an icon!");
        }
        let lastButton = lastRow[cols - 1];
        if (typeof lastButton === "string") {
            lastButton = {
                text: lastButton
            };
            lastRow[cols - 1] = lastButton;
        }
        lastButton.icon_custom_emoji_id = icon;
        return this;
    }
    persistent(isEnabled = true) {
        this.is_persistent = isEnabled;
        return this;
    }
    selected(isEnabled = true) {
        this.selective = isEnabled;
        return this;
    }
    oneTime(isEnabled = true) {
        this.one_time_keyboard = isEnabled;
        return this;
    }
    resized(isEnabled = true) {
        this.resize_keyboard = isEnabled;
        return this;
    }
    placeholder(value) {
        this.input_field_placeholder = value;
        return this;
    }
    toTransposed() {
        const original = this.keyboard;
        const transposed = transpose(original);
        return this.clone(transposed);
    }
    toFlowed(columns, options = {}) {
        const original = this.keyboard;
        const flowed = reflow(original, columns, options);
        return this.clone(flowed);
    }
    clone(keyboard = this.keyboard) {
        const clone = new Keyboard(keyboard.map((row)=>row.slice()));
        clone.is_persistent = this.is_persistent;
        clone.selective = this.selective;
        clone.one_time_keyboard = this.one_time_keyboard;
        clone.resize_keyboard = this.resize_keyboard;
        clone.input_field_placeholder = this.input_field_placeholder;
        return clone;
    }
    append(...sources) {
        for (const source of sources){
            const keyboard = Keyboard.from(source);
            this.keyboard.push(...keyboard.keyboard.map((row)=>row.slice()));
        }
        return this;
    }
    build() {
        return this.keyboard;
    }
    static from(source) {
        if (source instanceof Keyboard) return source.clone();
        function toButton(btn) {
            return typeof btn === "string" ? Keyboard.text(btn) : btn;
        }
        return new Keyboard(source.map((row)=>row.map(toButton)));
    }
}
class InlineKeyboard {
    inline_keyboard;
    constructor(inline_keyboard = [
        []
    ]){
        this.inline_keyboard = inline_keyboard;
    }
    add(...buttons) {
        this.inline_keyboard[this.inline_keyboard.length - 1]?.push(...buttons);
        return this;
    }
    row(...buttons) {
        this.inline_keyboard.push(buttons);
        return this;
    }
    url(text, url) {
        return this.add(InlineKeyboard.url(text, url));
    }
    static url(text, url) {
        return typeof text === "string" ? {
            text,
            url
        } : {
            ...text,
            url
        };
    }
    text(text, data = typeof text === "string" ? text : text.text) {
        return this.add(InlineKeyboard.text(text, data));
    }
    static text(text, data = typeof text === "string" ? text : text.text) {
        return typeof text === "string" ? {
            text,
            callback_data: data
        } : {
            ...text,
            callback_data: data
        };
    }
    webApp(text, url) {
        return this.add(InlineKeyboard.webApp(text, url));
    }
    static webApp(text, url) {
        const web_app = typeof url === "string" ? {
            url
        } : url;
        return typeof text === "string" ? {
            text,
            web_app
        } : {
            ...text,
            web_app
        };
    }
    login(text, loginUrl) {
        return this.add(InlineKeyboard.login(text, loginUrl));
    }
    static login(text, loginUrl) {
        const login_url = typeof loginUrl === "string" ? {
            url: loginUrl
        } : loginUrl;
        return typeof text === "string" ? {
            text,
            login_url
        } : {
            ...text,
            login_url
        };
    }
    switchInline(text, query = "") {
        return this.add(InlineKeyboard.switchInline(text, query));
    }
    static switchInline(text, query = "") {
        return typeof text === "string" ? {
            text,
            switch_inline_query: query
        } : {
            ...text,
            switch_inline_query: query
        };
    }
    switchInlineCurrent(text, query = "") {
        return this.add(InlineKeyboard.switchInlineCurrent(text, query));
    }
    static switchInlineCurrent(text, query = "") {
        return typeof text === "string" ? {
            text,
            switch_inline_query_current_chat: query
        } : {
            ...text,
            switch_inline_query_current_chat: query
        };
    }
    switchInlineChosen(text, query = {}) {
        return this.add(InlineKeyboard.switchInlineChosen(text, query));
    }
    static switchInlineChosen(text, query = {}) {
        return typeof text === "string" ? {
            text,
            switch_inline_query_chosen_chat: query
        } : {
            ...text,
            switch_inline_query_chosen_chat: query
        };
    }
    copyText(text, copyText) {
        return this.add(InlineKeyboard.copyText(text, copyText));
    }
    static copyText(text, copyText) {
        const copy_text = typeof copyText === "string" ? {
            text: copyText
        } : copyText;
        return typeof text === "string" ? {
            text,
            copy_text
        } : {
            ...text,
            copy_text
        };
    }
    game(text) {
        return this.add(InlineKeyboard.game(text));
    }
    static game(text) {
        const callback_game = {};
        return typeof text === "string" ? {
            text,
            callback_game
        } : {
            ...text,
            callback_game
        };
    }
    pay(text) {
        return this.add(InlineKeyboard.pay(text));
    }
    static pay(text) {
        return typeof text === "string" ? {
            text,
            pay: true
        } : {
            ...text,
            pay: true
        };
    }
    style(style) {
        const rows = this.inline_keyboard.length;
        if (rows === 0) {
            throw new Error("Need to add a button before applying a style!");
        }
        const lastRow = this.inline_keyboard[rows - 1];
        const cols = lastRow.length;
        if (cols === 0) {
            throw new Error("Need to add a button before applying a style!");
        }
        lastRow[cols - 1].style = style;
        return this;
    }
    danger() {
        return this.style("danger");
    }
    success() {
        return this.style("success");
    }
    primary() {
        return this.style("primary");
    }
    icon(icon) {
        const rows = this.inline_keyboard.length;
        if (rows === 0) {
            throw new Error("Need to add a button before adding an icon!");
        }
        const lastRow = this.inline_keyboard[rows - 1];
        const cols = lastRow.length;
        if (cols === 0) {
            throw new Error("Need to add a button before adding an icon!");
        }
        lastRow[cols - 1].icon_custom_emoji_id = icon;
        return this;
    }
    toTransposed() {
        const original = this.inline_keyboard;
        const transposed = transpose(original);
        return new InlineKeyboard(transposed);
    }
    toFlowed(columns, options = {}) {
        const original = this.inline_keyboard;
        const flowed = reflow(original, columns, options);
        return new InlineKeyboard(flowed);
    }
    clone() {
        return new InlineKeyboard(this.inline_keyboard.map((row)=>row.slice()));
    }
    append(...sources) {
        for (const source of sources){
            const keyboard = InlineKeyboard.from(source);
            this.inline_keyboard.push(...keyboard.inline_keyboard.map((row)=>row.slice()));
        }
        return this;
    }
    static from(source) {
        if (source instanceof InlineKeyboard) return source.clone();
        return new InlineKeyboard(source.map((row)=>row.slice()));
    }
}
function transpose(grid) {
    const transposed = [];
    for(let i = 0; i < grid.length; i++){
        const row = grid[i];
        for(let j = 0; j < row.length; j++){
            const button = row[j];
            (transposed[j] ??= []).push(button);
        }
    }
    return transposed;
}
function reflow(grid, columns, { fillLastRow = false }) {
    let first = columns;
    if (fillLastRow) {
        const buttonCount = grid.map((row)=>row.length).reduce((a, b)=>a + b, 0);
        first = buttonCount % columns;
    }
    const reflowed = [];
    for (const row of grid){
        for (const button of row){
            const at = Math.max(0, reflowed.length - 1);
            const max = at === 0 ? first : columns;
            let next = reflowed[at] ??= [];
            if (next.length === max) {
                next = [];
                reflowed.push(next);
            }
            next.push(button);
        }
    }
    return reflowed;
}
export { Keyboard as Keyboard };
export { InlineKeyboard as InlineKeyboard };
const debug3 = browser$1("grammy:session");
function session(options = {}) {
    return options.type === "multi" ? strictMultiSession(options) : strictSingleSession(options);
}
function strictSingleSession(options) {
    const { initial, storage, getSessionKey, custom } = fillDefaults(options);
    return async (ctx, next)=>{
        const propSession = new PropertySession(storage, ctx, "session", initial);
        const key = await getSessionKey(ctx);
        await propSession.init(key, {
            custom,
            lazy: false
        });
        await next();
        await propSession.finish();
    };
}
function strictMultiSession(options) {
    const props = Object.keys(options).filter((k)=>k !== "type");
    const defaults = Object.fromEntries(props.map((prop)=>[
            prop,
            fillDefaults(options[prop])
        ]));
    return async (ctx, next)=>{
        ctx.session = {};
        const propSessions = await Promise.all(props.map(async (prop)=>{
            const { initial, storage, getSessionKey, custom } = defaults[prop];
            const s = new PropertySession(storage, ctx.session, prop, initial);
            const key = await getSessionKey(ctx);
            await s.init(key, {
                custom,
                lazy: false
            });
            return s;
        }));
        await next();
        if (ctx.session == null) propSessions.forEach((s)=>s.delete());
        await Promise.all(propSessions.map((s)=>s.finish()));
    };
}
function lazySession(options = {}) {
    if (options.type !== undefined && options.type !== "single") {
        throw new Error("Cannot use lazy multi sessions!");
    }
    const { initial, storage, getSessionKey, custom } = fillDefaults(options);
    return async (ctx, next)=>{
        const propSession = new PropertySession(storage, ctx, "session", initial);
        const key = await getSessionKey(ctx);
        await propSession.init(key, {
            custom,
            lazy: true
        });
        await next();
        await propSession.finish();
    };
}
class PropertySession {
    storage;
    obj;
    prop;
    initial;
    key;
    value;
    promise;
    fetching;
    read;
    wrote;
    constructor(storage, obj, prop, initial){
        this.storage = storage;
        this.obj = obj;
        this.prop = prop;
        this.initial = initial;
        this.fetching = false;
        this.read = false;
        this.wrote = false;
    }
    load() {
        if (this.key === undefined) {
            return;
        }
        if (this.wrote) {
            return;
        }
        if (this.promise === undefined) {
            this.fetching = true;
            this.promise = Promise.resolve(this.storage.read(this.key)).then((val)=>{
                this.fetching = false;
                if (this.wrote) {
                    return this.value;
                }
                if (val !== undefined) {
                    this.value = val;
                    return val;
                }
                val = this.initial?.();
                if (val !== undefined) {
                    this.wrote = true;
                    this.value = val;
                }
                return val;
            });
        }
        return this.promise;
    }
    async init(key, opts) {
        this.key = key;
        if (!opts.lazy) await this.load();
        Object.defineProperty(this.obj, this.prop, {
            enumerable: true,
            get: ()=>{
                if (key === undefined) {
                    const msg = undef("access", opts);
                    throw new Error(msg);
                }
                this.read = true;
                if (!opts.lazy || this.wrote) return this.value;
                this.load();
                return this.fetching ? this.promise : this.value;
            },
            set: (v)=>{
                if (key === undefined) {
                    const msg = undef("assign", opts);
                    throw new Error(msg);
                }
                this.wrote = true;
                this.fetching = false;
                this.value = v;
            }
        });
    }
    delete() {
        Object.assign(this.obj, {
            [this.prop]: undefined
        });
    }
    async finish() {
        if (this.key !== undefined) {
            if (this.read) await this.load();
            if (this.read || this.wrote) {
                const value = await this.value;
                if (value == null) await this.storage.delete(this.key);
                else await this.storage.write(this.key, value);
            }
        }
    }
}
function fillDefaults(opts = {}) {
    let { prefix = "", getSessionKey = defaultGetSessionKey, initial, storage } = opts;
    if (storage == null) {
        debug3("Storing session data in memory, all data will be lost when the bot restarts.");
        storage = new MemorySessionStorage();
    }
    const custom = getSessionKey !== defaultGetSessionKey;
    return {
        initial,
        storage,
        getSessionKey: async (ctx)=>{
            const key = await getSessionKey(ctx);
            return key === undefined ? undefined : prefix + key;
        },
        custom
    };
}
function defaultGetSessionKey(ctx) {
    return ctx.chatId?.toString();
}
function undef(op, opts) {
    const { lazy = false, custom } = opts;
    const reason = custom ? "the custom `getSessionKey` function returned undefined for this update" : "this update does not belong to a chat, so the session key is undefined";
    return `Cannot ${op} ${lazy ? "lazy " : ""}session data because ${reason}!`;
}
function isEnhance(value) {
    return value === undefined || typeof value === "object" && value !== null && "__d" in value;
}
function enhanceStorage(options) {
    let { storage, millisecondsToLive, migrations } = options;
    storage = compatStorage(storage);
    if (millisecondsToLive !== undefined) {
        storage = timeoutStorage(storage, millisecondsToLive);
    }
    if (migrations !== undefined) {
        storage = migrationStorage(storage, migrations);
    }
    return wrapStorage(storage);
}
function compatStorage(storage) {
    return {
        read: async (k)=>{
            const v = await storage.read(k);
            return isEnhance(v) ? v : {
                __d: v
            };
        },
        write: (k, v)=>storage.write(k, v),
        delete: (k)=>storage.delete(k)
    };
}
function timeoutStorage(storage, millisecondsToLive) {
    const ttlStorage = {
        read: async (k)=>{
            const value = await storage.read(k);
            if (value === undefined) return undefined;
            if (value.e === undefined) {
                await ttlStorage.write(k, value);
                return value;
            }
            if (value.e < Date.now()) {
                await ttlStorage.delete(k);
                return undefined;
            }
            return value;
        },
        write: async (k, v)=>{
            v.e = addExpiryDate(v, millisecondsToLive).expires;
            await storage.write(k, v);
        },
        delete: (k)=>storage.delete(k)
    };
    return ttlStorage;
}
function migrationStorage(storage, migrations) {
    const versions = Object.keys(migrations).map((v)=>parseInt(v)).sort((a, b)=>a - b);
    const count = versions.length;
    if (count === 0) throw new Error("No migrations given!");
    const earliest = versions[0];
    const last = count - 1;
    const latest = versions[last];
    const index = new Map();
    versions.forEach((v, i)=>index.set(v, i));
    function nextAfter(current) {
        let i = last;
        while(current <= versions[i])i--;
        return i;
    }
    return {
        read: async (k)=>{
            const val = await storage.read(k);
            if (val === undefined) return val;
            let { __d: value, v: current = earliest - 1 } = val;
            let i = 1 + (index.get(current) ?? nextAfter(current));
            for(; i < count; i++)value = migrations[versions[i]](value);
            return {
                ...val,
                v: latest,
                __d: value
            };
        },
        write: (k, v)=>storage.write(k, {
                v: latest,
                ...v
            }),
        delete: (k)=>storage.delete(k)
    };
}
function wrapStorage(storage) {
    return {
        read: (k)=>Promise.resolve(storage.read(k)).then((v)=>v?.__d),
        write: (k, v)=>storage.write(k, {
                __d: v
            }),
        delete: (k)=>storage.delete(k)
    };
}
class MemorySessionStorage {
    timeToLive;
    storage;
    constructor(timeToLive){
        this.timeToLive = timeToLive;
        this.storage = new Map();
    }
    read(key) {
        const value = this.storage.get(key);
        if (value === undefined) return undefined;
        if (value.expires !== undefined && value.expires < Date.now()) {
            this.delete(key);
            return undefined;
        }
        return value.session;
    }
    readAll() {
        return this.readAllValues();
    }
    readAllKeys() {
        return Array.from(this.storage.keys());
    }
    readAllValues() {
        return Array.from(this.storage.keys()).map((key)=>this.read(key)).filter((value)=>value !== undefined);
    }
    readAllEntries() {
        return Array.from(this.storage.keys()).map((key)=>[
                key,
                this.read(key)
            ]).filter((pair)=>pair[1] !== undefined);
    }
    has(key) {
        return this.storage.has(key);
    }
    write(key, value) {
        this.storage.set(key, addExpiryDate(value, this.timeToLive));
    }
    delete(key) {
        this.storage.delete(key);
    }
}
function addExpiryDate(value, ttl) {
    if (ttl !== undefined && ttl < Infinity) {
        const now = Date.now();
        return {
            session: value,
            expires: now + ttl
        };
    } else {
        return {
            session: value
        };
    }
}
export { session as session };
export { lazySession as lazySession };
export { enhanceStorage as enhanceStorage };
export { MemorySessionStorage as MemorySessionStorage };
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const SECRET_HEADER_LOWERCASE = SECRET_HEADER.toLowerCase();
const WRONG_TOKEN_ERROR = "secret token is wrong";
const ok = ()=>new Response(null, {
        status: 200
    });
const okJson = (json)=>new Response(json, {
        status: 200,
        headers: {
            "Content-Type": "application/json"
        }
    });
const unauthorized = ()=>new Response('"unauthorized"', {
        status: 401,
        statusText: WRONG_TOKEN_ERROR
    });
const awsLambda = (event, _context, callback)=>({
        get update () {
            return JSON.parse(event.body ?? "{}");
        },
        header: event.headers[SECRET_HEADER],
        end: ()=>callback(null, {
                statusCode: 200
            }),
        respond: (json)=>callback(null, {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json"
                },
                body: json
            }),
        unauthorized: ()=>callback(null, {
                statusCode: 401
            })
    });
const awsLambdaAsync = (event, _context)=>{
    let resolveResponse;
    return {
        get update () {
            return JSON.parse(event.body ?? "{}");
        },
        header: event.headers[SECRET_HEADER],
        end: ()=>resolveResponse({
                statusCode: 200
            }),
        respond: (json)=>resolveResponse({
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json"
                },
                body: json
            }),
        unauthorized: ()=>resolveResponse({
                statusCode: 401
            }),
        handlerReturn: new Promise((res)=>resolveResponse = res)
    };
};
const azure = (context, request)=>({
        get update () {
            return request.body;
        },
        header: context.res?.headers?.[SECRET_HEADER],
        end: ()=>context.res = {
                status: 200,
                body: ""
            },
        respond: (json)=>{
            context.res?.set?.("Content-Type", "application/json");
            context.res?.send?.(json);
        },
        unauthorized: ()=>{
            context.res?.send?.(401, WRONG_TOKEN_ERROR);
        }
    });
const azureV4 = (request)=>{
    let resolveResponse;
    return {
        get update () {
            return request.json();
        },
        header: request.headers.get(SECRET_HEADER) || undefined,
        end: ()=>resolveResponse({
                status: 204
            }),
        respond: (json)=>resolveResponse({
                jsonBody: json
            }),
        unauthorized: ()=>resolveResponse({
                status: 401,
                body: WRONG_TOKEN_ERROR
            }),
        handlerReturn: new Promise((resolve)=>resolveResponse = resolve)
    };
};
const bun = (request)=>{
    let resolveResponse;
    return {
        get update () {
            return request.json();
        },
        header: request.headers.get(SECRET_HEADER) || undefined,
        end: ()=>{
            resolveResponse(ok());
        },
        respond: (json)=>{
            resolveResponse(okJson(json));
        },
        unauthorized: ()=>{
            resolveResponse(unauthorized());
        },
        handlerReturn: new Promise((res)=>resolveResponse = res)
    };
};
const cloudflare = (event)=>{
    let resolveResponse;
    event.respondWith(new Promise((resolve)=>{
        resolveResponse = resolve;
    }));
    return {
        get update () {
            return event.request.json();
        },
        header: event.request.headers.get(SECRET_HEADER) || undefined,
        end: ()=>{
            resolveResponse(ok());
        },
        respond: (json)=>{
            resolveResponse(okJson(json));
        },
        unauthorized: ()=>{
            resolveResponse(unauthorized());
        }
    };
};
const cloudflareModule = (request)=>{
    let resolveResponse;
    return {
        get update () {
            return request.json();
        },
        header: request.headers.get(SECRET_HEADER) || undefined,
        end: ()=>{
            resolveResponse(ok());
        },
        respond: (json)=>{
            resolveResponse(okJson(json));
        },
        unauthorized: ()=>{
            resolveResponse(unauthorized());
        },
        handlerReturn: new Promise((res)=>resolveResponse = res)
    };
};
const express = (req, res)=>({
        get update () {
            return req.body;
        },
        header: req.header(SECRET_HEADER),
        end: ()=>res.end(),
        respond: (json)=>{
            res.set("Content-Type", "application/json");
            res.send(json);
        },
        unauthorized: ()=>{
            res.status(401).send(WRONG_TOKEN_ERROR);
        }
    });
const fastify = (request, reply)=>({
        get update () {
            return request.body;
        },
        header: request.headers[SECRET_HEADER_LOWERCASE],
        end: ()=>reply.send(""),
        respond: (json)=>reply.headers({
                "Content-Type": "application/json"
            }).send(json),
        unauthorized: ()=>reply.code(401).send(WRONG_TOKEN_ERROR)
    });
const hono = (c)=>{
    let resolveResponse;
    return {
        get update () {
            return c.req.json();
        },
        header: c.req.header(SECRET_HEADER),
        end: ()=>{
            resolveResponse(c.body(""));
        },
        respond: (json)=>{
            resolveResponse(c.json(json));
        },
        unauthorized: ()=>{
            c.status(401);
            resolveResponse(c.body(""));
        },
        handlerReturn: new Promise((res)=>resolveResponse = res)
    };
};
const http = (req, res)=>{
    const secretHeaderFromRequest = req.headers[SECRET_HEADER_LOWERCASE];
    return {
        get update () {
            return new Promise((resolve, reject)=>{
                const chunks = [];
                req.on("data", (chunk)=>chunks.push(chunk)).once("end", ()=>{
                    const raw = Buffer.concat(chunks).toString("utf-8");
                    resolve(JSON.parse(raw));
                }).once("error", reject);
            });
        },
        header: Array.isArray(secretHeaderFromRequest) ? secretHeaderFromRequest[0] : secretHeaderFromRequest,
        end: ()=>res.end(),
        respond: (json)=>res.writeHead(200, {
                "Content-Type": "application/json"
            }).end(json),
        unauthorized: ()=>res.writeHead(401).end(WRONG_TOKEN_ERROR)
    };
};
const koa = (ctx)=>({
        get update () {
            return ctx.request.body;
        },
        header: ctx.get(SECRET_HEADER) || undefined,
        end: ()=>{
            ctx.body = "";
        },
        respond: (json)=>{
            ctx.set("Content-Type", "application/json");
            ctx.response.body = json;
        },
        unauthorized: ()=>{
            ctx.status = 401;
        }
    });
const nextJs = (request, response)=>({
        get update () {
            return request.body;
        },
        header: request.headers[SECRET_HEADER_LOWERCASE],
        end: ()=>response.end(),
        respond: (json)=>response.status(200).json(json),
        unauthorized: ()=>response.status(401).send(WRONG_TOKEN_ERROR)
    });
const nhttp = (rev)=>({
        get update () {
            return rev.body;
        },
        header: rev.headers.get(SECRET_HEADER) || undefined,
        end: ()=>rev.response.sendStatus(200),
        respond: (json)=>rev.response.status(200).send(json),
        unauthorized: ()=>rev.response.status(401).send(WRONG_TOKEN_ERROR)
    });
const oak = (ctx)=>({
        get update () {
            return ctx.request.body.json();
        },
        header: ctx.request.headers.get(SECRET_HEADER) || undefined,
        end: ()=>{
            ctx.response.status = 200;
        },
        respond: (json)=>{
            ctx.response.type = "json";
            ctx.response.body = json;
        },
        unauthorized: ()=>{
            ctx.response.status = 401;
        }
    });
const serveHttp = (requestEvent)=>({
        get update () {
            return requestEvent.request.json();
        },
        header: requestEvent.request.headers.get(SECRET_HEADER) || undefined,
        end: ()=>requestEvent.respondWith(ok()),
        respond: (json)=>requestEvent.respondWith(okJson(json)),
        unauthorized: ()=>requestEvent.respondWith(unauthorized())
    });
const stdHttp = (req)=>{
    let resolveResponse;
    return {
        get update () {
            return req.json();
        },
        header: req.headers.get(SECRET_HEADER) || undefined,
        end: ()=>{
            if (resolveResponse) resolveResponse(ok());
        },
        respond: (json)=>{
            if (resolveResponse) resolveResponse(okJson(json));
        },
        unauthorized: ()=>{
            if (resolveResponse) resolveResponse(unauthorized());
        },
        handlerReturn: new Promise((res)=>resolveResponse = res)
    };
};
const sveltekit = ({ request })=>{
    let resolveResponse;
    return {
        get update () {
            return request.json();
        },
        header: request.headers.get(SECRET_HEADER) || undefined,
        end: ()=>{
            if (resolveResponse) resolveResponse(ok());
        },
        respond: (json)=>{
            if (resolveResponse) resolveResponse(okJson(json));
        },
        unauthorized: ()=>{
            if (resolveResponse) resolveResponse(unauthorized());
        },
        handlerReturn: new Promise((res)=>resolveResponse = res)
    };
};
const worktop = (req, res)=>({
        get update () {
            return req.json();
        },
        header: req.headers.get(SECRET_HEADER) ?? undefined,
        end: ()=>res.end(null),
        respond: (json)=>res.send(200, json),
        unauthorized: ()=>res.send(401, WRONG_TOKEN_ERROR)
    });
const elysia = (ctx)=>{
    let resolveResponse;
    return {
        get update () {
            return ctx.body;
        },
        header: ctx.headers[SECRET_HEADER_LOWERCASE],
        end () {
            resolveResponse("");
        },
        respond (json) {
            ctx.set.headers["content-type"] = "application/json";
            resolveResponse(json);
        },
        unauthorized () {
            ctx.set.status = 401;
            resolveResponse("");
        },
        handlerReturn: new Promise((res)=>resolveResponse = res)
    };
};
const adapters = {
    "aws-lambda": awsLambda,
    "aws-lambda-async": awsLambdaAsync,
    azure,
    "azure-v4": azureV4,
    bun,
    cloudflare,
    "cloudflare-mod": cloudflareModule,
    elysia,
    express,
    fastify,
    hono,
    http,
    https: http,
    koa,
    "next-js": nextJs,
    nhttp,
    oak,
    serveHttp,
    "std/http": stdHttp,
    sveltekit,
    worktop
};
const debugErr1 = browser$1("grammy:error");
const callbackAdapter = (update, callback, header, unauthorized = ()=>callback('"unauthorized"'))=>({
        update: Promise.resolve(update),
        respond: callback,
        header,
        unauthorized
    });
const adapters1 = {
    ...adapters,
    callback: callbackAdapter
};
function compareSecretToken(header, token) {
    if (token === undefined) {
        return true;
    }
    if (header === undefined) {
        return false;
    }
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(header);
    const tokenBytes = encoder.encode(token);
    if (headerBytes.length !== tokenBytes.length) {
        return false;
    }
    let hasDifference = 0;
    for(let i = 0; i < tokenBytes.length; i++){
        const headerByte = i < headerBytes.length ? headerBytes[i] : 0;
        const tokenByte = tokenBytes[i];
        hasDifference |= headerByte ^ tokenByte;
    }
    return hasDifference === 0;
}
function webhookCallback(bot, adapter = defaultAdapter, onTimeout, timeoutMilliseconds, secretToken) {
    if (bot.isRunning()) {
        throw new Error("Bot is already running via long polling, the webhook setup won't receive any updates!");
    } else {
        bot.start = ()=>{
            throw new Error("You already started the bot via webhooks, calling `bot.start()` starts the bot with long polling and this will prevent your webhook setup from receiving any updates!");
        };
    }
    const { onTimeout: timeout = "throw", timeoutMilliseconds: ms = 10_000, secretToken: token } = typeof onTimeout === "object" ? onTimeout : {
        onTimeout,
        timeoutMilliseconds,
        secretToken
    };
    let initialized = false;
    const server = typeof adapter === "string" ? adapters1[adapter] : adapter;
    return async (...args)=>{
        const handler = server(...args);
        if (!initialized) {
            await bot.init();
            initialized = true;
        }
        if (!compareSecretToken(handler.header, token)) {
            await handler.unauthorized();
            return handler.handlerReturn;
        }
        let usedWebhookReply = false;
        const webhookReplyEnvelope = {
            async send (json) {
                usedWebhookReply = true;
                await handler.respond(json);
            }
        };
        await timeoutIfNecessary(bot.handleUpdate(await handler.update, webhookReplyEnvelope), typeof timeout === "function" ? ()=>timeout(...args) : timeout, ms);
        if (!usedWebhookReply) handler.end?.();
        return handler.handlerReturn;
    };
}
function timeoutIfNecessary(task, onTimeout, timeout) {
    if (timeout === Infinity) return task;
    return new Promise((resolve, reject)=>{
        const handle = setTimeout(()=>{
            debugErr1(`Request timed out after ${timeout} ms`);
            if (onTimeout === "throw") {
                reject(new Error(`Request timed out after ${timeout} ms`));
            } else {
                if (typeof onTimeout === "function") onTimeout();
                resolve();
            }
            const now = Date.now();
            task.finally(()=>{
                const diff = Date.now() - now;
                debugErr1(`Request completed ${diff} ms after timeout!`);
            });
        }, timeout);
        task.then(resolve).catch(reject).finally(()=>clearTimeout(handle));
    });
}
export { webhookCallback as webhookCallback };
export { Bot as Bot, BotError as BotError };
export { InputFile as InputFile };
export { Context as Context };
export { Composer as Composer };
export { matchFilter as matchFilter };
export { Api as Api };
export { GrammyError as GrammyError, HttpError as HttpError };
