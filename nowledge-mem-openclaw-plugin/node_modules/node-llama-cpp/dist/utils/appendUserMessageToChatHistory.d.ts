import { ChatHistoryItem } from "../types.js";
/**
 * Appends a user message to the chat history.
 * If the last message in the chat history is also a user message, the new message will be appended to it.
 */
export declare function appendUserMessageToChatHistory(chatHistory: readonly ChatHistoryItem[], message: string): ChatHistoryItem[];
