import type { AnyMiddlewareArgs, Middleware } from './types';
/**
 * Storage backend used by the conversation context middleware
 */
export interface ConversationStore<ConversationState = any> {
    set(conversationId: string, value: ConversationState, expiresAt?: number): Promise<unknown>;
    get(conversationId: string): Promise<ConversationState>;
}
/**
 * Default implementation of ConversationStore, which stores data in memory.
 *
 * This should not be used in situations where there is more than once instance of the app running because state will
 * not be shared amongst the processes.
 */
export declare class MemoryStore<ConversationState = any> implements ConversationStore<ConversationState> {
    private state;
    set(conversationId: string, value: ConversationState, expiresAt?: number): Promise<void>;
    get(conversationId: string): Promise<ConversationState>;
}
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
export declare function conversationContext<ConversationState = any>(store: ConversationStore<ConversationState>): Middleware<AnyMiddlewareArgs>;
//# sourceMappingURL=conversation-store.d.ts.map