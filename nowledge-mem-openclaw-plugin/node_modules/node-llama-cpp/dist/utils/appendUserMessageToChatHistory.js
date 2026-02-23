/**
 * Appends a user message to the chat history.
 * If the last message in the chat history is also a user message, the new message will be appended to it.
 */
export function appendUserMessageToChatHistory(chatHistory, message) {
    const newChatHistory = chatHistory.slice();
    if (newChatHistory.length > 0 && newChatHistory[newChatHistory.length - 1].type === "user") {
        const lastUserMessage = newChatHistory[newChatHistory.length - 1];
        newChatHistory[newChatHistory.length - 1] = {
            ...lastUserMessage,
            text: [lastUserMessage.text, message].join("\n\n")
        };
    }
    else {
        newChatHistory.push({
            type: "user",
            text: message
        });
    }
    return newChatHistory;
}
//# sourceMappingURL=appendUserMessageToChatHistory.js.map