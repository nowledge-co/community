"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultThreadContextStore = void 0;
const Assistant_1 = require("./Assistant");
class DefaultThreadContextStore {
    context = {};
    async get(args) {
        const { context, client, payload, logger } = args;
        logger.debug('DefaultAssistantThreadStore: get method called');
        if (this.context.channel_id) {
            return this.context;
        }
        const { channelId: channel, threadTs: thread_ts } = (0, Assistant_1.extractThreadInfo)(payload);
        // Retrieve the current thread history
        const thread = await client.conversations.replies({
            channel,
            ts: thread_ts,
            oldest: thread_ts,
            include_all_metadata: true,
            limit: 4,
        });
        if (!thread.messages)
            return {};
        // Find the first message in the thread that holds the current context using metadata.
        // See createSaveThreadContext below for a description and explanation for this approach.
        const initialMsg = thread.messages.find((m) => !('subtype' in m) && m.user === context.botUserId);
        const threadContext = initialMsg?.metadata ? initialMsg.metadata.event_payload : null;
        return threadContext || {};
    }
    async save(args) {
        const { context, client, payload, logger } = args;
        const { channelId: channel, threadTs: thread_ts, context: threadContext } = (0, Assistant_1.extractThreadInfo)(payload);
        logger.debug('DefaultAssistantThreadStore: save method called');
        // Retrieve first several messages from the current Assistant thread
        const thread = await client.conversations.replies({
            channel,
            ts: thread_ts,
            oldest: thread_ts,
            include_all_metadata: true,
            limit: 4,
        });
        if (!thread.messages)
            return;
        // Find and update the initial Assistant message with the new context to ensure the
        // thread always contains the most recent context that user is sending messages from.
        const initialMsg = thread.messages.find((m) => !('subtype' in m) && m.user === context.botUserId);
        if (initialMsg?.ts) {
            const params = {
                channel,
                ts: initialMsg.ts,
                text: initialMsg.text,
                blocks: initialMsg.blocks ? initialMsg.blocks : [],
                metadata: {
                    event_type: 'assistant_thread_context',
                    event_payload: threadContext,
                },
            };
            await client.chat.update(params);
        }
        this.context = threadContext;
    }
}
exports.DefaultThreadContextStore = DefaultThreadContextStore;
//# sourceMappingURL=AssistantThreadContextStore.js.map