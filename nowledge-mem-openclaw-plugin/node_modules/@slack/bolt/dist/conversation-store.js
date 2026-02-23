"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationContext = exports.MemoryStore = void 0;
const helpers_1 = require("./helpers");
/**
 * Default implementation of ConversationStore, which stores data in memory.
 *
 * This should not be used in situations where there is more than once instance of the app running because state will
 * not be shared amongst the processes.
 */
// biome-ignore lint/suspicious/noExplicitAny: user-defined convo values can be anything
class MemoryStore {
    state = new Map();
    set(conversationId, value, expiresAt) {
        return new Promise((resolve) => {
            this.state.set(conversationId, { value, expiresAt });
            resolve();
        });
    }
    get(conversationId) {
        return new Promise((resolve, reject) => {
            const entry = this.state.get(conversationId);
            if (entry !== undefined) {
                if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
                    // release the memory
                    this.state.delete(conversationId);
                    reject(new Error('Conversation expired'));
                }
                resolve(entry.value);
            }
            reject(new Error('Conversation not found'));
        });
    }
}
exports.MemoryStore = MemoryStore;
/**
 * Conversation context global middleware.
 *
 * This middleware allows listeners (and other middleware) to store state related to the conversationId of an incoming
 * event using the `context.updateConversation()` function. That state will be made available in future events that
 * take place in the same conversation by reading from `context.conversation`.
 *
 * @param store storage backend used to store and retrieve all conversation state
 * @param logger a logger
 */
// biome-ignore lint/suspicious/noExplicitAny: user-defined convo values can be anything
function conversationContext(store) {
    return async ({ body, context, next, logger }) => {
        const { conversationId } = (0, helpers_1.getTypeAndConversation)(body);
        if (conversationId !== undefined) {
            context.updateConversation = (conversation, expiresAt) => store.set(conversationId, conversation, expiresAt);
            try {
                context.conversation = await store.get(conversationId);
                logger.debug(`Conversation context loaded for ID: ${conversationId}`);
            }
            catch (error) {
                const e = error;
                if (e.message !== undefined && e.message !== 'Conversation not found') {
                    // The conversation data can be expired - error: Conversation expired
                    logger.debug(`Conversation context failed loading for ID: ${conversationId}, error: ${e.message}`);
                }
            }
        }
        else {
            logger.debug('No conversation ID for incoming event');
        }
        await next();
    };
}
exports.conversationContext = conversationContext;
//# sourceMappingURL=conversation-store.js.map